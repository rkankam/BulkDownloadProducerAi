import fs from 'fs';
import path from 'path';

/**
 * Export complete metadata for a single track to a JSON file
 * Creates {filename}.json containing full API response + download metadata
 * @param {string} outputDir - Directory to write the metadata file
 * @param {Object} track - Full track object from API response
 * @param {Object} result - Download result from downloader
 * @param {string} [playlistName] - Optional playlist name for reference
 * @returns {string|null} Path to created file, or null on error
 */
export async function exportTrackMetadata(outputDir, track, result, playlistName = null) {
  try {
    const baseName = result.file ? path.parse(result.file).name : `${track.title || 'Unknown'}_${track.id}`;
    const metadataFile = path.join(outputDir, `${baseName}.json`);
    
    const durationSeconds = track.duration_s || 0;
    const durationFormatted = formatDuration(durationSeconds);
    
    let fileSize = null;
    if (result.filePath && fs.existsSync(result.filePath)) {
      try {
        const stats = fs.statSync(result.filePath);
        fileSize = stats.size;
      } catch {}
    }
    
    const { lyrics_timestamped, ...trackWithoutTimestamps } = track;
    
    const metadata = {
      _meta: {
        exportedAt: new Date().toISOString(),
        filename: result.file || null,
        downloadStatus: result.status,
        fileSize: fileSize,
        durationSeconds: durationSeconds,
        durationFormatted: durationFormatted,
      },
      apiResponse: trackWithoutTimestamps
    };
    
    if (playlistName) {
      metadata._meta.playlist = playlistName;
    }
    
    if (track.is_favorite !== undefined) {
      metadata._meta.isFavorite = track.is_favorite;
    }
    
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    console.log(`   📄 Metadata: ${baseName}.json`);
    
    return metadataFile;
  } catch (error) {
    console.error(`   ⚠️  Warning: Failed to export metadata for track ${track.id}: ${error.message}`);
    return null;
  }
}

/**
 * Format duration in seconds to human-readable string (HH:MM:SS or MM:SS)
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Rebuild global index file containing all tracks' metadata
 * Scans directory for *.json files (excluding _index.json) and creates _index.json
 * @param {string} outputDir - Directory to scan and write _index.json
 * @returns {Object} Index object that was written, or null on error
 */
export async function rebuildGlobalIndex(outputDir) {
  try {
    if (!fs.existsSync(outputDir)) {
      console.error(`   ⚠️  Warning: Directory does not exist: ${outputDir}`);
      return null;
    }
    
    const files = fs.readdirSync(outputDir);
    const trackFiles = files.filter(f => 
      f.endsWith('.json') && f !== '_index.json'
    );
    
    const tracks = [];
    let totalDuration = 0;
    
    for (const file of trackFiles) {
      try {
        const filePath = path.join(outputDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const metadata = JSON.parse(content);
        
        const trackData = {
          id: metadata.apiResponse?.id || null,
          title: metadata.apiResponse?.title || 'Unknown',
          filename: metadata._meta?.filename || null,
          duration: metadata._meta?.durationSeconds || metadata.apiResponse?.duration_s || 0,
          status: metadata._meta?.downloadStatus || 'unknown',
          exportedAt: metadata._meta?.exportedAt || null,
        };
        
        if (metadata._meta?.playlist) trackData.playlist = metadata._meta.playlist;
        if (metadata._meta?.isFavorite !== undefined) trackData.isFavorite = metadata._meta.isFavorite;
        if (metadata.apiResponse?.author_id) trackData.authorId = metadata.apiResponse.author_id;
        if (metadata.apiResponse?.created_at) trackData.createdAt = metadata.apiResponse.created_at;
        if (metadata._meta?.fileSize) trackData.fileSize = metadata._meta.fileSize;
        
        tracks.push(trackData);
        totalDuration += trackData.duration;
      } catch (parseError) {
        console.error(`   ⚠️  Warning: Could not parse ${file}: ${parseError.message}`);
      }
    }
    
    const index = {
      _meta: {
        updatedAt: new Date().toISOString(),
        trackCount: tracks.length,
        totalDuration: totalDuration,
        totalDurationFormatted: formatDuration(totalDuration),
        directory: path.basename(outputDir),
      },
      tracks: tracks
    };
    
    const indexFile = path.join(outputDir, '_index.json');
    fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
    console.log(`\n📑 Index updated: ${indexFile}`);
    console.log(`   ${tracks.length} tracks, total duration: ${formatDuration(totalDuration)}`);
    
    return index;
  } catch (error) {
    console.error(`   ⚠️  Warning: Failed to rebuild index: ${error.message}`);
    return null;
  }
}

// ============================================================================
// LEGACY FUNCTIONS (Deprecated - kept for backward compatibility during migration)
// ============================================================================

/**
 * @deprecated Use exportTrackMetadata() instead
 * Collect metadata for a downloaded track (minimal format)
 * @param {Object} track - Track object from API
 * @param {Object} result - Download result from downloader
 * @param {string} [playlistName] - Optional playlist name
 * @returns {Object} Metadata entry
 */
export function collectMetadata(track, result, playlistName = null) {
  const metadata = {
    id: track.id,
    title: track.title || 'Unknown',
    filename: result.file || null,
    downloadedAt: new Date().toISOString(),
    status: result.status,
  };

  if (playlistName) {
    metadata.playlist = playlistName;
  }

  if (result.filePath && fs.existsSync(result.filePath)) {
    try {
      const stats = fs.statSync(result.filePath);
      metadata.size = stats.size;
    } catch {}
  }

  return metadata;
}

/**
 * @deprecated Use rebuildGlobalIndex() after exportTrackMetadata() calls instead
 * Export metadata to JSON file (minimal format)
 * @param {string} outputDir - Directory to write metadata.json
 * @param {Array} metadata - Array of metadata entries
 */
export function exportMetadata(outputDir, metadata) {
  try {
    const metadataFile = path.join(outputDir, 'metadata.json');
    const exportData = {
      exportedAt: new Date().toISOString(),
      tracks: metadata,
    };

    fs.writeFileSync(metadataFile, JSON.stringify(exportData, null, 2));
    console.log(`\n📄 Metadata exported to: ${path.resolve(metadataFile)}`);
  } catch (error) {
    console.error('Error exporting metadata:', error.message);
  }
}
