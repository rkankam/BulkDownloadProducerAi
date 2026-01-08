import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

let rl = null;

/**
 * Create or get readline interface
 */
function getReadline() {
  if (!rl) {
    rl = readline.createInterface({ input, output });
  }
  return rl;
}

/**
 * Display menu and get user's choice for download mode
 * @returns {Promise<'all'|'playlists'>}
 */
export async function promptDownloadMode() {
  const readlineInstance = getReadline();

  console.log('========================================');
  console.log('  Download Mode Selection');
  console.log('========================================\n');
  console.log('Choose download mode:');
  console.log('  [1] Download entire library (all generations)');
  console.log('  [2] Select specific playlists');
  console.log();

  while (true) {
    const choice = await readlineInstance.question('Enter choice (1 or 2): ');

    if (choice === '1') {
      return 'all';
    } else if (choice === '2') {
      return 'playlists';
    } else {
      console.log('❌ Invalid choice. Please enter 1 or 2.\n');
    }
  }
}

/**
 * Display playlists and prompt for multi-selection
 * @param {Array} playlists - Array of playlist objects
 * @returns {Promise<Array>} - Selected playlist objects
 */
export async function promptPlaylistSelection(playlists) {
  const readlineInstance = getReadline();

  if (playlists.length === 0) {
    console.log('⚠️  No playlists found.');
    return [];
  }

  displayPlaylistList(playlists);

  while (true) {
    const input = await readlineInstance.question(
      'Enter playlist numbers (e.g., 1,3,5 or 1-3) or "all": '
    );

    const indices = parseMultiSelectInput(input.trim(), playlists.length);

    if (indices === null) {
      console.log(
        '❌ Invalid input. Please use format: 1,3,5 or 1-3 or "all".\n'
      );
      continue;
    }

    if (indices.length === 0) {
      console.log('❌ No playlists selected.\n');
      continue;
    }

    // Get selected playlists
    const selected = indices.map(idx => playlists[idx]);

    console.log();
    console.log(`✅ Selected ${selected.length} playlist(s):`);
    selected.forEach((pl, i) => {
      const trackCount = pl.trackCount || pl.tracks?.length || 0;
      console.log(`   ${i + 1}. ${pl.name} (${trackCount} tracks)`);
    });
    console.log();

    return selected;
  }
}

/**
 * Display formatted playlist list with indices
 * @param {Array} playlists - Array of playlist objects
 */
function displayPlaylistList(playlists) {
  console.log();
  console.log('========================================');
  console.log('  Your Playlists');
  console.log('========================================\n');

  playlists.forEach((playlist, index) => {
    const trackCount = playlist.trackCount || playlist.tracks?.length || 0;
    const num = String(index + 1).padEnd(2);
    console.log(`  [${num}] ${playlist.name} (${trackCount} tracks)`);
  });

  console.log();
}

/**
 * Parse multi-select input (e.g., "1,3,5" or "1-4,7")
 * @param {string} input - User input string
 * @param {number} maxIndex - Maximum valid index
 * @returns {Array<number>|null} - Array of selected indices (0-based) or null if invalid
 */
function parseMultiSelectInput(input, maxIndex) {
  if (!input) {
    return null;
  }

  // Handle "all" keyword
  if (input.toLowerCase() === 'all') {
    return Array.from({ length: maxIndex }, (_, i) => i);
  }

  const indices = new Set();

  // Split by comma
  const parts = input.split(',');

  for (const part of parts) {
    const trimmed = part.trim();

    // Check if it's a range (e.g., "1-3")
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(s => parseInt(s.trim(), 10));

      if (
        isNaN(start) ||
        isNaN(end) ||
        start < 1 ||
        end < 1 ||
        start > maxIndex ||
        end > maxIndex ||
        start > end
      ) {
        return null;
      }

      for (let i = start; i <= end; i++) {
        indices.add(i - 1); // Convert to 0-based index
      }
    } else {
      // Single number
      const num = parseInt(trimmed, 10);

      if (isNaN(num) || num < 1 || num > maxIndex) {
        return null;
      }

      indices.add(num - 1); // Convert to 0-based index
    }
  }

  return Array.from(indices).sort((a, b) => a - b);
}

/**
 * Close readline interface
 */
export function closeReadline() {
  if (rl) {
    rl.close();
    rl = null;
  }
}
