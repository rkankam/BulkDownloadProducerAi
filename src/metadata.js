import fs from 'fs';
import path from 'path';

/**
 * Collect metadata for a downloaded track
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

  // Add playlist name if provided
  if (playlistName) {
    metadata.playlist = playlistName;
  }

  // Add file size if available
  if (result.filePath && fs.existsSync(result.filePath)) {
    try {
      const stats = fs.statSync(result.filePath);
      metadata.size = stats.size;
    } catch (error) {
      // Silently skip if file size cannot be determined
    }
  }

  return metadata;
}

/**
 * Export metadata to JSON file
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
