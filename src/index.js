import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { discordAuth, loadConfig, validateToken, ensureFreshToken } from './auth-discord.js';
import { fetchGenerations, fetchAllPlaylists, fetchAllPlaylistTracks, fetchAllFavorites, fetchTrackById } from './api.js';
import { downloadTrackWithRetry } from './downloader.js';
import { loadState, saveState, loadPlaylistState, savePlaylistState, cleanupDownloadingFiles, loadFavoritesState, saveFavoritesState } from './state.js';
import { createPlaylistDirectory } from './utils.js';
import { promptDownloadMode, promptPlaylistSelection, promptFormatSelection, closeReadline } from './cli.js';
import { collectMetadata, exportMetadata, exportTrackMetadata, rebuildGlobalIndex, scanIntegrityIssues, updateTrackMetadata, syncAllStatuses } from './metadata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(process.cwd(), 'config.json');

/**
 * Main orchestrator for BulkDownloadProducerAi
 */
async function main() {
  console.log('🎵 BulkDownloadProducerAi - Producer.ai Music Library Downloader\n');

  try {
    // Step 1: Load or authenticate
    console.log('📋 Step 1: Authentication\n');
    let config = await loadConfig(CONFIG_PATH);

    if (!config) {
      console.log('⚠️  No valid config found. Starting Discord authentication...\n');
      const auth = await discordAuth({
        headless: false,
        timeout: 120000,
        saveToConfig: true,
        configPath: CONFIG_PATH,
      });

      config = {
        token: auth.token,
        refreshToken: auth.refreshToken,
        userId: auth.userId,
        outputDir: './downloads',
        format: 'mp3',
        authMethod: 'discord',
      };
    }

    // Step 2: Validate token
    console.log('\n📋 Step 2: Token Validation\n');
    const isTokenValid = await validateToken(config.token);
    if (!isTokenValid) {
      throw new Error('Token is invalid. Please re-authenticate.');
    }

    // Step 2.5: Download mode selection
    console.log('\n📋 Step 2.5: Download Mode Selection\n');
    const mode = await promptDownloadMode();

    // Step 2.6: Format selection (skip for repair mode)
    if (mode !== 'repair') {
      console.log('\n📋 Step 2.6: Format Selection\n');
      config.format = await promptFormatSelection();
      console.log(`\n✅ Format: ${config.format.toUpperCase()}`);
    }

    let selectedPlaylists = [];
    if (mode === 'playlists') {
      console.log('\n📥 Fetching playlists...');
      const allPlaylists = await fetchAllPlaylists(config.token, config.userId);
      console.log(`   Found ${allPlaylists.length} playlists`);

      selectedPlaylists = await promptPlaylistSelection(allPlaylists);
      console.log(`\n✅ Selected ${selectedPlaylists.length} playlist(s)`);
    }

    // Close readline only after all prompts are done
    closeReadline();

    // Step 3: Setup output directory
    console.log('\n📋 Step 3: Setup\n');
    console.log(`📁 Output directory: ${path.resolve(config.outputDir)}`);

    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
      console.log('   Created');
    } else {
      console.log('   Exists');
    }

     // Cleanup orphaned .downloading files
     console.log('\n🧹 Cleaning up orphaned .downloading files');
     cleanupDownloadingFiles(config.outputDir);

     // Show download delay configuration
     const downloadDelay = config.downloadDelay || 500;
     console.log(`\n⏱️ Download delay: ${downloadDelay}ms`);

     // Execute download based on mode
    if (mode === 'all') {
      await downloadLibrary(config);
    } else if (mode === 'playlists') {
      await downloadPlaylists(config, selectedPlaylists);
    } else if (mode === 'favorites') {
      await downloadFavorites(config);
    } else if (mode === 'repair') {
      await repairDownloads(config);
    }
  } catch (error) {
    closeReadline();
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Download entire library (all generations)
 */
async function downloadLibrary(config) {
  // Step 4: Load state
  console.log('\n📋 Step 4: Load Progress State\n');
  let state = loadState();
  const libState = state.library || state; // Handle migration

  console.log(`Last offset: ${libState.lastOffset}`);
  console.log(`Downloaded: ${libState.downloaded}`);
  console.log(`Skipped: ${libState.skipped}`);
  console.log(`Failed: ${libState.failed.length}`);

  // Step 5: Download loop
  console.log('\n📋 Step 5: Download Tracks\n');
  console.log('Starting download process...\n');

  const stats = {
    downloaded: libState.downloaded,
    skipped: libState.skipped,
    failed: libState.failed.length,
  };

  let offset = libState.lastOffset;
  const limit = 20;
  let hasMore = true;
  let totalProcessed = 0;

  while (hasMore) {
    config = await ensureFreshToken(config, CONFIG_PATH);

    console.log(`\n📥 Fetching page offset=${offset}...`);

    try {
      const response = await fetchGenerations(config.token, config.userId, offset, limit);
      const generations = response.generations || [];

      if (generations.length === 0) {
        console.log('   No more tracks');
        hasMore = false;
        break;
      }

      console.log(`   Found ${generations.length} tracks`);

      // Download each track
      for (const generation of generations) {
        try {
          const result = await downloadTrackWithRetry(
            generation,
            config.token,
            config.outputDir,
            config.format,
            {
              maxRetries: 2,
            }
          );

          totalProcessed++;

          await exportTrackMetadata(config.outputDir, generation, result);

          if (result.status === 'success') {
            stats.downloaded++;
            console.log(`✅ ${result.file}`);
          } else if (result.status === 'skipped') {
            stats.skipped++;
            console.log(`⏭️  ${result.file}`);
           } else if (result.status === 'failed') {
             stats.failed++;
             libState.failed.push(generation.id);
             console.log(`❌ ${result.file} - ${result.message}`);
           }

           // Apply rate limiting delay between downloads
           await new Promise(resolve => setTimeout(resolve, config.downloadDelay || 500));

           // Save state every 10 tracks
          if (totalProcessed % 10 === 0) {
            libState.lastOffset = offset;
            libState.downloaded = stats.downloaded;
            libState.skipped = stats.skipped;
            state.library = libState;
            saveState(state);
          }
        } catch (error) {
          console.error(`   Error processing track: ${error.message}`);
          stats.failed++;
          libState.failed.push(generation.id);
        }
      }

      offset += limit;
      libState.lastOffset = offset;
      libState.downloaded = stats.downloaded;
      libState.skipped = stats.skipped;
      state.library = libState;
      saveState(state);
    } catch (error) {
      console.error(`\n⚠️  Error fetching generations: ${error.message}`);
      console.log('   Retrying in 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Step 6: Final summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 Download Complete!');
  console.log('='.repeat(60));
  console.log(`\nDownloaded: ${stats.downloaded}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Total: ${stats.downloaded + stats.skipped + stats.failed}`);

  if (stats.failed > 0) {
    console.log(`\n⚠️  ${stats.failed} track(s) failed:`);
    libState.failed.forEach(id => console.log(`   - ${id}`));
    console.log('\nRun again to retry failed tracks.');
  }

  console.log(`\n📁 Files saved to: ${path.resolve(config.outputDir)}`);

  await rebuildGlobalIndex(config.outputDir);

   // Reset state on complete success
   if (stats.failed === 0 && !hasMore) {
     console.log('✅ All tracks downloaded successfully!');
     libState.lastOffset = 0;
     libState.downloaded = 0;
     libState.skipped = 0;
     libState.failed = [];
     libState.lastCompletedAt = new Date().toISOString();
     state.library = libState;
     saveState(state);
     console.log('   Progress reset for next sync');
   }
}

/**
 * Download from selected playlists
 */
async function downloadPlaylists(config, selectedPlaylists) {
  console.log('\n📋 Step 4: Download Playlists\n');

  const globalStats = [];
  let globalDownloaded = 0;
  let globalSkipped = 0;
  let globalFailed = 0;

  for (const playlist of selectedPlaylists) {
    console.log('\n' + '='.repeat(60));
    console.log(`📂 Playlist: ${playlist.name}`);
    console.log('='.repeat(60));

    // Create playlist subdirectory
    const playlistDir = createPlaylistDirectory(config.outputDir, playlist.name);
    console.log(`📁 Directory: ${path.resolve(playlistDir)}`);

    // Load playlist-specific state
    let playlistState = loadPlaylistState(playlist.id);

    config = await ensureFreshToken(config, CONFIG_PATH);

    console.log('📥 Fetching tracks from playlist...');
    let tracks = [];
    try {
      tracks = await fetchAllPlaylistTracks(config.token, playlist.id);
      console.log(`   Found ${tracks.length} tracks\n`);
    } catch (error) {
      console.error(`   Error fetching tracks: ${error.message}`);
      globalStats.push({
        name: playlist.name,
        downloaded: 0,
        skipped: 0,
        failed: tracks.length,
      });
      continue;
    }

     // Download tracks
     const playlistStats = {
       downloaded: 0,
       skipped: 0,
       failed: 0,
     };



    for (const track of tracks) {
      try {
        config = await ensureFreshToken(config, CONFIG_PATH);

        const result = await downloadTrackWithRetry(
          track,
          config.token,
          playlistDir,
          config.format,
          {
            maxRetries: 2,
          }
        );

        await exportTrackMetadata(playlistDir, track, result, playlist.name);

        if (result.status === 'success') {
          playlistStats.downloaded++;
          console.log(`✅ ${result.file}`);
        } else if (result.status === 'skipped') {
          playlistStats.skipped++;
          console.log(`⏭️  ${result.file}`);
         } else if (result.status === 'failed') {
           playlistStats.failed++;
           if (!playlistState.failed) {
             playlistState.failed = [];
           }
           playlistState.failed.push(track.id);
           console.log(`❌ ${result.file} - ${result.message}`);
         }

         // Apply rate limiting delay between downloads
         await new Promise(resolve => setTimeout(resolve, config.downloadDelay || 500));
       } catch (error) {
         console.error(`   Error: ${error.message}`);
         playlistStats.failed++;
         if (!playlistState.failed) {
           playlistState.failed = [];
         }
         playlistState.failed.push(track.id);
       }
     }

    // Save playlist state
    playlistState.downloaded = playlistStats.downloaded;
    playlistState.skipped = playlistStats.skipped;
    playlistState.lastRun = new Date().toISOString();
    savePlaylistState(playlist.id, playlistState);

    // Display playlist summary
    console.log(`\n📊 Playlist Summary:`);
    console.log(`   Downloaded: ${playlistStats.downloaded}`);
    console.log(`   Skipped: ${playlistStats.skipped}`);
    console.log(`   Failed: ${playlistStats.failed}`);

    // Aggregate to global stats
    globalStats.push({
      name: playlist.name,
      ...playlistStats,
    });

    globalDownloaded += playlistStats.downloaded;
    globalSkipped += playlistStats.skipped;
    globalFailed += playlistStats.failed;

    await rebuildGlobalIndex(playlistDir);
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 All Playlists Downloaded!');
  console.log('='.repeat(60));
  console.log('\nPlaylist Summary:');

  for (const pl of globalStats) {
    console.log(`  - ${pl.name}: ${pl.downloaded} downloaded, ${pl.skipped} skipped, ${pl.failed} failed`);
  }

  console.log(`\n📊 Overall Statistics:`);
  console.log(`   Total Downloaded: ${globalDownloaded}`);
  console.log(`   Total Skipped: ${globalSkipped}`);
  console.log(`   Total Failed: ${globalFailed}`);
  console.log(`   Grand Total: ${globalDownloaded + globalSkipped + globalFailed}`);

  console.log(`\n📁 Files saved to: ${path.resolve(config.outputDir)}`);
}

async function repairDownloads(config) {
  console.log('\n📋 Step 4: Verify & Repair Downloads\n');

  console.log('🔄 Step 1: Syncing statuses with actual files...\n');

  const syncResults = await syncAllStatuses(config.outputDir);

  if (syncResults.totalCorrections > 0) {
    console.log(`\n✅ Status corrections applied: ${syncResults.totalCorrections}`);
    for (const [dir, count] of Object.entries(syncResults.byDirectory)) {
      console.log(`   ${dir}: ${count} corrections`);
    }
    console.log();
  } else {
    console.log('   No status corrections needed.\n');
  }

  console.log('🔍 Step 2: Scanning for integrity issues...\n');

  const issues = scanIntegrityIssues(config.outputDir);

  if (issues.summary.totalIssues === 0) {
    console.log('✅ All downloads verified. No issues found.\n');
    return;
  }

  console.log('═'.repeat(60));
  console.log('📊 Issues Found');
  console.log('═'.repeat(60));
  console.log(`   Missing files:        ${issues.summary.needDownload}`);
  console.log(`   Missing metadata:     ${issues.summary.needMetadataOnly}`);
  console.log(`   Orphan files:         ${issues.summary.orphans}`);
  console.log(`   Total issues:         ${issues.summary.totalIssues}\n`);

  const stats = {
    repaired: 0,
    metadataFixed: 0,
    orphansRecovered: 0,
    failed: 0
  };

  const repairedDirs = new Set();

  for (const [dirName, dirIssues] of Object.entries(issues.byDirectory)) {
    const fullDir = path.join(config.outputDir, dirName);
    console.log(`\n📂 Processing: ${dirName || 'downloads'}`);

    for (const track of dirIssues.missing) {
      try {
        config = await ensureFreshToken(config, CONFIG_PATH);
        console.log(`   ⬇️  Re-downloading: ${track.title || track.id}`);

        const trackData = track.track || { id: track.id, title: track.title };
        const result = await downloadTrackWithRetry(
          trackData,
          config.token,
          fullDir,
          config.format,
          { maxRetries: 2 }
        );

        if (result.status === 'success' || result.status === 'skipped') {
          if (trackData.id) {
            await exportTrackMetadata(fullDir, trackData, result);
          }
          stats.repaired++;
          repairedDirs.add(fullDir);
          console.log(`      ✅ Repaired`);
        } else {
          stats.failed++;
          console.log(`      ❌ Failed: ${result.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, config.downloadDelay || 500));
      } catch (error) {
        stats.failed++;
        console.log(`      ❌ Error: ${error.message}`);
      }
    }

    for (const track of dirIssues.empty) {
      try {
        config = await ensureFreshToken(config, CONFIG_PATH);
        console.log(`   🔄 Replacing empty: ${track.title || track.id}`);

        if (track.filePath && fs.existsSync(track.filePath)) {
          fs.unlinkSync(track.filePath);
        }

        const trackData = track.track || { id: track.id, title: track.title };
        const result = await downloadTrackWithRetry(
          trackData,
          config.token,
          fullDir,
          config.format,
          { maxRetries: 2 }
        );

        if (result.status === 'success') {
          if (trackData.id) {
            await exportTrackMetadata(fullDir, trackData, result);
          }
          stats.repaired++;
          repairedDirs.add(fullDir);
          console.log(`      ✅ Replaced`);
        } else {
          stats.failed++;
          console.log(`      ❌ Failed: ${result.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, config.downloadDelay || 500));
      } catch (error) {
        stats.failed++;
        console.log(`      ❌ Error: ${error.message}`);
      }
    }

    for (const track of dirIssues.missingJson) {
      try {
        config = await ensureFreshToken(config, CONFIG_PATH);
        console.log(`   📄 Creating metadata: ${track.title || track.id}`);

        const trackId = track.id;
        let trackData = track.track || { id: trackId, title: track.title };

        try {
          trackData = await fetchTrackById(config.token, trackId);
        } catch (apiError) {
          console.log(`      ⚠️  Could not fetch API data, using cached info`);
        }

        const ext = path.extname(track.filePath || '').toLowerCase().replace('.', '') || config.format;
        const result = {
          file: track.filename,
          filePath: track.filePath,
          status: 'success'
        };

        await exportTrackMetadata(fullDir, trackData, result);
        stats.metadataFixed++;
        repairedDirs.add(fullDir);
        console.log(`      ✅ Metadata created`);
      } catch (error) {
        stats.failed++;
        console.log(`      ❌ Error: ${error.message}`);
      }
    }

    for (const orphan of dirIssues.orphanFiles) {
      try {
        config = await ensureFreshToken(config, CONFIG_PATH);
        const filename = orphan.filename;
        console.log(`   🔗 Recovering orphan: ${filename}`);

        const uuidMatch = filename.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (!uuidMatch) {
          console.log(`      ⚠️  Could not extract track ID from filename`);
          continue;
        }

        const trackId = uuidMatch[1];

        try {
          const trackData = await fetchTrackById(config.token, trackId);
          const result = {
            file: filename,
            filePath: orphan.filePath,
            status: 'success'
          };

          await exportTrackMetadata(fullDir, trackData, result);
          stats.orphansRecovered++;
          repairedDirs.add(fullDir);
          console.log(`      ✅ Metadata recovered`);
        } catch (apiError) {
          console.log(`      ⚠️  Track not found in API (may have been deleted)`);
        }
      } catch (error) {
        stats.failed++;
        console.log(`      ❌ Error: ${error.message}`);
      }
    }
  }

  console.log('\n🔄 Rebuilding index files...');
  for (const dir of repairedDirs) {
    await rebuildGlobalIndex(dir);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Repair Complete!');
  console.log('='.repeat(60));
  console.log(`\n🔄 Status synced:       ${syncResults.totalCorrections}`);
  console.log(`✅ Files repaired:      ${stats.repaired}`);
  console.log(`📄 Metadata fixed:     ${stats.metadataFixed}`);
  console.log(`🔗 Orphans recovered:  ${stats.orphansRecovered}`);
  console.log(`❌ Failed:             ${stats.failed}`);
  console.log(`\n📁 Files saved to: ${path.resolve(config.outputDir)}`);
}

async function downloadFavorites(config) {
  console.log('\n📋 Step 4: Download Favorites\n');

  const favoritesDir = path.join(config.outputDir, 'favorites');
  console.log(`📁 Directory: ${path.resolve(favoritesDir)}`);

  if (!fs.existsSync(favoritesDir)) {
    fs.mkdirSync(favoritesDir, { recursive: true });
    console.log('   Created');
  }

  let favoritesState = loadFavoritesState();

  console.log('\n📥 Fetching favorites...');
  let favorites = [];
  try {
    favorites = await fetchAllFavorites(config.token);
    console.log(`   Found ${favorites.length} favorites\n`);
  } catch (error) {
    console.error(`   Error fetching favorites: ${error.message}`);
    return;
  }

  const stats = {
    downloaded: 0,
    skipped: 0,
    failed: 0,
  };

  for (const favorite of favorites) {
    try {
      config = await ensureFreshToken(config, CONFIG_PATH);

      const result = await downloadTrackWithRetry(
        favorite,
        config.token,
        favoritesDir,
        config.format,
        {
          maxRetries: 2,
        }
      );

      await exportTrackMetadata(favoritesDir, favorite, result, 'favorites');

      if (result.status === 'success') {
        stats.downloaded++;
        console.log(`✅ ${result.file}`);
      } else if (result.status === 'skipped') {
        stats.skipped++;
        console.log(`⏭️  ${result.file}`);
      } else if (result.status === 'failed') {
        stats.failed++;
        if (!favoritesState.failed) {
          favoritesState.failed = [];
        }
        favoritesState.failed.push(favorite.id || favorite.riff_id || favorite.generation_id);
        console.log(`❌ ${result.file} - ${result.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, config.downloadDelay || 500));
    } catch (error) {
      console.error(`   Error: ${error.message}`);
      stats.failed++;
      if (!favoritesState.failed) {
        favoritesState.failed = [];
      }
      favoritesState.failed.push(favorite.id || favorite.riff_id || favorite.generation_id);
    }
  }

  favoritesState.downloaded += stats.downloaded;
  favoritesState.skipped += stats.skipped;
  favoritesState.lastRun = new Date().toISOString();
  saveFavoritesState(favoritesState);

  await rebuildGlobalIndex(favoritesDir);

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Favorites Download Complete!');
  console.log('='.repeat(60));
  console.log(`\nDownloaded: ${stats.downloaded}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Total: ${stats.downloaded + stats.skipped + stats.failed}`);

  console.log(`\n📁 Files saved to: ${path.resolve(favoritesDir)}`);
}

// Run main
main().catch(error => {
  closeReadline();
  console.error('Uncaught error:', error);
  process.exit(1);
});
