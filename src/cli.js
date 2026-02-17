import readline from 'readline';
import { stdin as input, stdout as output } from 'process';

const rl = readline.createInterface({ input, output });

/**
 * Display menu and get user's choice for download mode
 */
export function promptDownloadMode() {
  return new Promise((resolve) => {
    console.log('========================================');
    console.log('  Download Mode Selection');
    console.log('========================================\n');
    console.log('Choose download mode:');
    console.log('  [1] Download entire library (all generations)');
    console.log('  [2] Select specific playlists');
    console.log('  [3] Download favorites only');
    console.log();

    const askQuestion = () => {
      rl.question('Enter choice (1, 2, or 3): ', (choice) => {
        if (choice === '1') {
          resolve('all');
        } else if (choice === '2') {
          resolve('playlists');
        } else if (choice === '3') {
          resolve('favorites');
        } else {
          console.log('❌ Invalid choice. Please enter 1, 2, or 3.\n');
          askQuestion();
        }
      });
    };

    askQuestion();
  });
}

/**
 * Display playlists and prompt for multi-selection
 */
export function promptPlaylistSelection(playlists) {
  return new Promise((resolve) => {
    if (playlists.length === 0) {
      console.log('⚠️  No playlists found.');
      resolve([]);
      return;
    }

    displayPlaylistList(playlists);

    const askQuestion = () => {
      rl.question(
        'Enter playlist numbers (e.g., 1,3,5 or 1-3) or "all": ',
        (input) => {
          const indices = parseMultiSelectInput(input.trim(), playlists.length);

          if (indices === null) {
            console.log(
              '❌ Invalid input. Please use format: 1,3,5 or 1-3 or "all".\n'
            );
            askQuestion();
            return;
          }

          if (indices.length === 0) {
            console.log('❌ No playlists selected.\n');
            askQuestion();
            return;
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

          resolve(selected);
        }
      );
    };

    askQuestion();
  });
}

/**
 * Display formatted playlist list with indices
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
 * Parse multi-select input
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
  rl.close();
}
