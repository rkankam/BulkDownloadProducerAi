import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  loadState,
  saveState,
  resetState,
  loadPlaylistState,
  savePlaylistState,
  getDefaultPlaylistState,
  resetPlaylistStates,
  cleanupDownloadingFiles,
  loadFavoritesState,
  saveFavoritesState,
  getDefaultFavoritesState,
  resetFavoritesState,
} from '../src/state.js';

describe('State Management', () => {
  let tempDir;
  let originalCwd;
  let testStateFile;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    testStateFile = path.join(tempDir, 'download-state.json');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('loadState', () => {
    it('should return default state when file does not exist', () => {
      const state = loadState();
      expect(state).toHaveProperty('mode', 'library');
      expect(state).toHaveProperty('library');
      expect(state).toHaveProperty('playlists');
      expect(state.library).toHaveProperty('lastOffset', 0);
      expect(state.library).toHaveProperty('downloaded', 0);
      expect(state.library).toHaveProperty('skipped', 0);
      expect(state.library).toHaveProperty('failed');
      expect(Array.isArray(state.library.failed)).toBe(true);
    });

    it('should load existing state from file', () => {
      const testState = {
        mode: 'library',
        library: {
          lastOffset: 100,
          downloaded: 50,
          skipped: 5,
          failed: ['track1', 'track2'],
          lastRun: '2026-02-17T00:00:00.000Z',
          createdAt: '2026-02-16T00:00:00.000Z',
        },
        playlists: {},
      };
      fs.writeFileSync(testStateFile, JSON.stringify(testState));

      const state = loadState();
      expect(state.library.lastOffset).toBe(100);
      expect(state.library.downloaded).toBe(50);
      expect(state.library.skipped).toBe(5);
      expect(state.library.failed).toEqual(['track1', 'track2']);
    });

    it('should migrate old state format to new format', () => {
      const oldState = {
        lastOffset: 75,
        downloaded: 30,
        skipped: 3,
        failed: ['track3'],
        lastRun: '2026-02-15T00:00:00.000Z',
        createdAt: '2026-02-14T00:00:00.000Z',
      };
      fs.writeFileSync(testStateFile, JSON.stringify(oldState));

      const state = loadState();
      expect(state.mode).toBe('library');
      expect(state.library.lastOffset).toBe(75);
      expect(state.library.downloaded).toBe(30);
      expect(state.library.skipped).toBe(3);
      expect(state.library.failed).toEqual(['track3']);
      expect(state.playlists).toEqual({});
    });

    it('should return default state on corrupted file', () => {
      fs.writeFileSync(testStateFile, 'invalid json {{{');

      const state = loadState();
      expect(state).toHaveProperty('mode', 'library');
      expect(state.library.lastOffset).toBe(0);
    });
  });

  describe('saveState', () => {
    it('should save state to file', () => {
      const state = {
        mode: 'library',
        library: {
          lastOffset: 200,
          downloaded: 100,
          skipped: 10,
          failed: [],
          lastRun: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
        playlists: {},
      };

      saveState(state);

      expect(fs.existsSync(testStateFile)).toBe(true);
      const saved = JSON.parse(fs.readFileSync(testStateFile, 'utf-8'));
      expect(saved.library.lastOffset).toBe(200);
      expect(saved.library.downloaded).toBe(100);
    });

    it('should overwrite existing state file', () => {
      const state1 = {
        mode: 'library',
        library: { lastOffset: 50, downloaded: 25, skipped: 0, failed: [], lastRun: null, createdAt: new Date().toISOString() },
        playlists: {},
      };
      saveState(state1);

      const state2 = {
        mode: 'library',
        library: { lastOffset: 100, downloaded: 50, skipped: 5, failed: [], lastRun: null, createdAt: new Date().toISOString() },
        playlists: {},
      };
      saveState(state2);

      const saved = JSON.parse(fs.readFileSync(testStateFile, 'utf-8'));
      expect(saved.library.lastOffset).toBe(100);
    });
  });

  describe('resetState', () => {
    it('should reset state to default', () => {
      const state = {
        mode: 'library',
        library: { lastOffset: 500, downloaded: 250, skipped: 25, failed: ['track1'], lastRun: null, createdAt: new Date().toISOString() },
        playlists: { playlist1: {} },
      };
      saveState(state);

      const resetted = resetState();
      expect(resetted.library.lastOffset).toBe(0);
      expect(resetted.library.downloaded).toBe(0);
      expect(resetted.library.skipped).toBe(0);
      expect(resetted.library.failed).toEqual([]);
      expect(resetted.playlists).toEqual({});
    });
  });

  describe('Playlist State', () => {
    it('should load default playlist state when not exists', () => {
      const playlistState = loadPlaylistState('playlist123');
      expect(playlistState).toHaveProperty('downloaded', 0);
      expect(playlistState).toHaveProperty('skipped', 0);
      expect(playlistState).toHaveProperty('failed');
      expect(Array.isArray(playlistState.failed)).toBe(true);
    });

    it('should save and load playlist state', () => {
      const playlistState = {
        downloaded: 20,
        skipped: 2,
        failed: ['track5'],
        lastRun: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      savePlaylistState('playlist456', playlistState);

      const loaded = loadPlaylistState('playlist456');
      expect(loaded.downloaded).toBe(20);
      expect(loaded.skipped).toBe(2);
      expect(loaded.failed).toEqual(['track5']);
    });

    it('should reset all playlist states', () => {
      savePlaylistState('playlist1', { downloaded: 10, skipped: 1, failed: [], lastRun: null, createdAt: new Date().toISOString() });
      savePlaylistState('playlist2', { downloaded: 15, skipped: 2, failed: [], lastRun: null, createdAt: new Date().toISOString() });

      resetPlaylistStates();

      const state = loadState();
      expect(state.playlists).toEqual({});
    });

    it('should return default playlist state structure', () => {
      const defaultState = getDefaultPlaylistState();
      expect(defaultState).toHaveProperty('downloaded', 0);
      expect(defaultState).toHaveProperty('skipped', 0);
      expect(defaultState).toHaveProperty('failed');
      expect(defaultState).toHaveProperty('lastRun', null);
      expect(defaultState).toHaveProperty('createdAt');
    });
  });

  describe('cleanupDownloadingFiles', () => {
    it('should remove .downloading files', () => {
      const downloadDir = path.join(tempDir, 'downloads');
      fs.mkdirSync(downloadDir);

      fs.writeFileSync(path.join(downloadDir, 'track1.mp3'), 'content');
      fs.writeFileSync(path.join(downloadDir, 'track2.mp3.downloading'), 'partial');
      fs.writeFileSync(path.join(downloadDir, 'track3.mp3.downloading'), 'partial');

      const count = cleanupDownloadingFiles(downloadDir);

      expect(count).toBe(2);
      expect(fs.existsSync(path.join(downloadDir, 'track1.mp3'))).toBe(true);
      expect(fs.existsSync(path.join(downloadDir, 'track2.mp3.downloading'))).toBe(false);
      expect(fs.existsSync(path.join(downloadDir, 'track3.mp3.downloading'))).toBe(false);
    });

    it('should return 0 when directory does not exist', () => {
      const count = cleanupDownloadingFiles(path.join(tempDir, 'nonexistent'));
      expect(count).toBe(0);
    });

    it('should return 0 when no .downloading files exist', () => {
      const downloadDir = path.join(tempDir, 'downloads');
      fs.mkdirSync(downloadDir);
      fs.writeFileSync(path.join(downloadDir, 'track1.mp3'), 'content');
      fs.writeFileSync(path.join(downloadDir, 'track2.mp3'), 'content');

      const count = cleanupDownloadingFiles(downloadDir);
      expect(count).toBe(0);
    });

    it('should handle empty directory', () => {
      const downloadDir = path.join(tempDir, 'downloads');
      fs.mkdirSync(downloadDir);

      const count = cleanupDownloadingFiles(downloadDir);
      expect(count).toBe(0);
    });
  });

  describe('Favorites State', () => {
    it('should load default favorites state when not exists', () => {
      const favoritesState = loadFavoritesState();
      expect(favoritesState).toHaveProperty('downloaded', 0);
      expect(favoritesState).toHaveProperty('skipped', 0);
      expect(favoritesState).toHaveProperty('failed');
      expect(favoritesState).toHaveProperty('lastPage', 0);
      expect(Array.isArray(favoritesState.failed)).toBe(true);
    });

    it('should save and load favorites state', () => {
      const favoritesState = {
        downloaded: 30,
        skipped: 5,
        failed: ['fav1', 'fav2'],
        lastPage: 3,
        lastRun: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      saveFavoritesState(favoritesState);

      const loaded = loadFavoritesState();
      expect(loaded.downloaded).toBe(30);
      expect(loaded.skipped).toBe(5);
      expect(loaded.failed).toEqual(['fav1', 'fav2']);
      expect(loaded.lastPage).toBe(3);
    });

    it('should reset favorites state', () => {
      const favoritesState = {
        downloaded: 50,
        skipped: 10,
        failed: ['fav3'],
        lastPage: 5,
        lastRun: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      saveFavoritesState(favoritesState);

      resetFavoritesState();

      const loaded = loadFavoritesState();
      expect(loaded.downloaded).toBe(0);
      expect(loaded.skipped).toBe(0);
      expect(loaded.failed).toEqual([]);
      expect(loaded.lastPage).toBe(0);
    });

    it('should return default favorites state structure', () => {
      const defaultState = getDefaultFavoritesState();
      expect(defaultState).toHaveProperty('downloaded', 0);
      expect(defaultState).toHaveProperty('skipped', 0);
      expect(defaultState).toHaveProperty('failed');
      expect(defaultState).toHaveProperty('lastPage', 0);
      expect(defaultState).toHaveProperty('lastRun', null);
      expect(defaultState).toHaveProperty('createdAt');
    });
  });
});
