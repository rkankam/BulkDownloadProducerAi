# BulkDownloadProducerAi

Bulk download your music library and playlists from producer.ai with ease. This tool handles authentication via Discord OAuth and provides a resumable download process.

## Features

- **Discord OAuth Authentication**: Securely log in using Playwright to automate the authentication flow.
- **Two Download Modes**:
  - **Library Mode**: Download every track you've generated.
  - **Playlist Mode**: Select specific playlists to download into organized subdirectories.
- **Resumable Downloads**: Progress is tracked in `download-state.json`, allowing you to resume after interruptions.
- **Robust Error Handling**: Automatic retries for failed downloads and cleanup of incomplete files.
- **Configurable**: Customize output directories and file formats.

## Prerequisites

- **Node.js**: Version 18 or higher.
- **Playwright**: Required for the automated login flow.

## Installation

1. Clone the repository and navigate to the project directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Install the required browser for Playwright:
   ```bash
   npx playwright install chromium
   ```

## Usage

Start the application by running:

```bash
npm start
```

On the first run, a browser window will open for you to log in via Discord. Once authenticated, the tool will save your session and prompt you to choose a download mode.

### Download Modes

- **All Generations**: Fetches and downloads every track in your library sequentially.
- **Playlists**: Fetches your playlists and lets you select which ones to download. Each playlist is saved in its own folder within the output directory.

## Configuration

The tool uses a `config.json` file for settings. This file is created automatically after your first login, but you can also create or modify it manually.

Example `config.json`:

```json
{
  "token": "your-jwt-token-here",
  "userId": "your-user-id-here",
  "outputDir": "./downloads",
  "format": "mp3",
  "authMethod": "discord",
  "authenticatedAt": "2026-02-17T07:09:23.566Z"
}
```

### Fields
- `token`: The JWT session token from producer.ai.
- `userId`: Your unique user identifier.
- `outputDir`: Where the music files will be saved.
- `format`: The desired file format (currently supports `mp3`).
- `authMethod`: The authentication provider (default is `discord`).

## State Management

The tool maintains progress in `download-state.json`. This file tracks:
- Last processed offset for library downloads.
- Lists of downloaded, skipped, and failed tracks.
- Playlist-specific progress.

If a download fails or is stopped, simply run `npm start` again to pick up where you left off. To reset progress entirely, you can delete the `download-state.json` file.

## Troubleshooting

### Token Expired
If you see an error stating the token is invalid or expired, simply delete the `token` field from `config.json` or delete the file entirely and run `npm start` to re-authenticate.

### Network Errors
The tool includes a retry mechanism (up to 2 attempts per track). If network errors persist, check your internet connection and ensure producer.ai is accessible.

### Playwright Issues
If the browser fails to launch, ensure you have installed the necessary binaries:
```bash
npx playwright install chromium
```

### Orphaned Files
The tool automatically cleans up `.downloading` files from previous interrupted sessions at startup to ensure a clean working environment.
