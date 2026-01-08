import sanitize from 'sanitize-filename';
import fs from 'fs';
import path from 'path';

/**
 * Sanitize filename to prevent path traversal and invalid characters
 */
export function sanitizeFilename(filename) {
  return sanitize(filename, {
    replacement: '_',
  });
}

/**
 * Sanitize directory name (more aggressive than filename)
 */
export function sanitizeDirectoryName(dirname) {
  if (!dirname || typeof dirname !== 'string') {
    return 'playlist';
  }

  // Remove/replace problematic characters for directories
  let safe = dirname
    // Replace invalid characters: < > : " / \ | ? *
    .replace(/[<>:"/\\|?*]/g, '_')
    // Remove leading/trailing spaces and dots
    .trim()
    .replace(/^\.+|\.+$/g, '');

  // Limit length to 200 characters for filesystem compatibility
  if (safe.length > 200) {
    safe = safe.substring(0, 200).trim();
  }

  // Handle Windows reserved names
  const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  if (reserved.includes(safe.toUpperCase())) {
    safe = `_${safe}`;
  }

  // Return name or fallback if empty
  return safe && safe.length > 0 ? safe : 'playlist';
}

/**
 * Create playlist subdirectory safely
 */
export function createPlaylistDirectory(baseDir, playlistName) {
  const safeName = sanitizeDirectoryName(playlistName);
  const fullPath = path.join(baseDir, safeName);

  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }

  return fullPath;
}
