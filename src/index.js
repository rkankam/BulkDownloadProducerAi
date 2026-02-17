import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { discordAuth, loadConfig, validateToken } from './auth-discord.js';
import { fetchGenerations, fetchAllPlaylists, fetchAllPlaylistTracks } from './api.js';
import { downloadTrackWithRetry } from './downloader.js';
import { loadState, saveState, loadPlaylistState, savePlaylistState, cleanupDownloadingFiles } from './state.js';
import { createPlaylistDirectory } from './utils.js';
import { promptDownloadMode, promptPlaylistSelection, closeReadline } from './cli.js';

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
    } else {
      await downloadPlaylists(config, selectedPlaylists);
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

    // Fetch all tracks in playlist
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
        const result = await downloadTrackWithRetry(
          track,
          config.token,
          playlistDir,
          config.format,
          {
            maxRetries: 2,
          }
        );

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

// Run main
main().catch(error => {
  closeReadline();
  console.error('Uncaught error:', error);
  process.exit(1);
});
