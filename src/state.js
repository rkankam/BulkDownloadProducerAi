import fs from 'fs';
import path from 'path';

const STATE_FILE = 'download-state.json';

/**
 * Load state from file with migration support
 */
export function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      let state = JSON.parse(data);

      // Migrate old format to new format if needed
      if (state && !state.mode) {
        state = migrateStateFile(state);
        saveState(state);
      }

      return state;
    } catch (error) {
      console.error('Error loading state file:', error.message);
      return getDefaultState();
    }
  }

  return getDefaultState();
}

/**
 * Save state to file
 */
export function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Error saving state file:', error.message);
  }
}

/**
 * Reset state
 */
export function resetState() {
  const state = getDefaultState();
  saveState(state);
  return state;
}

/**
 * Get default favorites state structure
 */
export function getDefaultFavoritesState() {
  return {
    downloaded: 0,
    skipped: 0,
    failed: [],
    lastPage: 0,
    lastRun: null,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Get default state structure
 */
function getDefaultState() {
  return {
    mode: 'library',
    library: {
      lastOffset: 0,
      downloaded: 0,
      skipped: 0,
      failed: [],
      lastRun: null,
      createdAt: new Date().toISOString(),
    },
    playlists: {},
    favorites: getDefaultFavoritesState(),
  };
}

/**
 * Migrate old state file format to new format
 */
function migrateStateFile(oldState) {
  return {
    mode: 'library',
    library: {
      lastOffset: oldState.lastOffset || 0,
      downloaded: oldState.downloaded || 0,
      skipped: oldState.skipped || 0,
      failed: oldState.failed || [],
      lastRun: oldState.lastRun || null,
      createdAt: oldState.createdAt || new Date().toISOString(),
    },
    playlists: {},
  };
}

/**
 * Load playlist-specific state
 */
export function loadPlaylistState(playlistId) {
  const state = loadState();

  if (state.playlists && state.playlists[playlistId]) {
    return state.playlists[playlistId];
  }

  return getDefaultPlaylistState();
}

/**
 * Save playlist-specific state
 */
export function savePlaylistState(playlistId, playlistState) {
  const state = loadState();

  if (!state.playlists) {
    state.playlists = {};
  }

  state.playlists[playlistId] = playlistState;
  saveState(state);
}

/**
 * Get default playlist state structure
 */
export function getDefaultPlaylistState() {
  return {
    downloaded: 0,
    skipped: 0,
    failed: [],
    lastRun: null,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Reset all playlist states
 */
export function resetPlaylistStates() {
  const state = loadState();
  state.playlists = {};
  saveState(state);
}

/**
 * Load favorites-specific state
 */
export function loadFavoritesState() {
  const state = loadState();

  if (state.favorites) {
    return state.favorites;
  }

  return getDefaultFavoritesState();
}

/**
 * Save favorites-specific state
 */
export function saveFavoritesState(favoritesState) {
  const state = loadState();
  state.favorites = favoritesState;
  saveState(state);
}

/**
 * Reset favorites state
 */
export function resetFavoritesState() {
  const state = loadState();
  state.favorites = getDefaultFavoritesState();
  saveState(state);
}

/**
 * Clean up orphaned .downloading files
 */
export function cleanupDownloadingFiles(directory) {
  try {
    if (!fs.existsSync(directory)) {
      return 0;
    }

    const files = fs.readdirSync(directory);
    const downloading = files.filter(f => f.endsWith('.downloading'));

    downloading.forEach(filename => {
      const filepath = path.join(directory, filename);
      try {
        fs.unlinkSync(filepath);
        console.log(`   Removed: ${filename}`);
      } catch (error) {
        console.error(`   Failed to remove ${filename}: ${error.message}`);
      }
    });

    return downloading.length;
  } catch (error) {
    console.error('Error cleaning up files:', error.message);
    return 0;
  }
}
