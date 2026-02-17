import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exportTrackMetadata, rebuildGlobalIndex, collectMetadata, exportMetadata } from '../src/metadata.js';

describe('Metadata Export', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('exportTrackMetadata', () => {
    it('should create JSON file with _meta and apiResponse', async () => {
      const track = {
        id: 'track-123',
        title: 'Test Track',
        duration_s: 180,
        author_id: 'author-456',
        is_favorite: true,
      };

      const result = {
        file: 'Test Track_track-123.mp3',
        filePath: path.join(tempDir, 'Test Track_track-123.mp3'),
        status: 'success',
      };

      fs.writeFileSync(result.filePath, 'fake audio content');

      const filePath = await exportTrackMetadata(tempDir, track, result);

      expect(filePath).toBeTruthy();
      expect(fs.existsSync(filePath)).toBe(true);
      expect(path.basename(filePath)).toBe('Test Track_track-123.json');

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content).toHaveProperty('_meta');
      expect(content).toHaveProperty('apiResponse');
      expect(content.apiResponse.id).toBe('track-123');
      expect(content.apiResponse.title).toBe('Test Track');
    });

    it('should include download metadata in _meta', async () => {
      const track = { id: 'track-789', title: 'Meta Test', duration_s: 240 };
      const result = { file: 'Meta Test_track-789.mp3', status: 'success' };

      await exportTrackMetadata(tempDir, track, result);

      const content = JSON.parse(fs.readFileSync(path.join(tempDir, 'Meta Test_track-789.json'), 'utf-8'));
      expect(content._meta.downloadStatus).toBe('success');
      expect(content._meta.filename).toBe('Meta Test_track-789.mp3');
      expect(content._meta.durationSeconds).toBe(240);
      expect(content._meta.durationFormatted).toBe('4:00');
      expect(content._meta.exportedAt).toBeTruthy();
    });

    it('should include file size when available', async () => {
      const track = { id: 'track-size', title: 'Size Test' };
      const result = {
        file: 'Size Test_track-size.mp3',
        filePath: path.join(tempDir, 'Size Test_track-size.mp3'),
        status: 'success',
      };

      const testContent = 'x'.repeat(1024);
      fs.writeFileSync(result.filePath, testContent);

      await exportTrackMetadata(tempDir, track, result);

      const content = JSON.parse(fs.readFileSync(path.join(tempDir, 'Size Test_track-size.json'), 'utf-8'));
      expect(content._meta.fileSize).toBe(1024);
    });

    it('should include playlist name when provided', async () => {
      const track = { id: 'track-pl', title: 'Playlist Track' };
      const result = { file: 'Playlist Track_track-pl.mp3', status: 'success' };

      await exportTrackMetadata(tempDir, track, result, 'My Playlist');

      const content = JSON.parse(fs.readFileSync(path.join(tempDir, 'Playlist Track_track-pl.json'), 'utf-8'));
      expect(content._meta.playlist).toBe('My Playlist');
    });

    it('should include isFavorite when present in track', async () => {
      const track = { id: 'track-fav', title: 'Favorite Track', is_favorite: true };
      const result = { file: 'Favorite Track_track-fav.mp3', status: 'success' };

      await exportTrackMetadata(tempDir, track, result);

      const content = JSON.parse(fs.readFileSync(path.join(tempDir, 'Favorite Track_track-fav.json'), 'utf-8'));
      expect(content._meta.isFavorite).toBe(true);
    });

    it('should handle missing file result gracefully', async () => {
      const track = { id: 'track-nofile', title: 'No File Track' };
      const result = { file: null, status: 'failed', filePath: null };

      const filePath = await exportTrackMetadata(tempDir, track, result);

      expect(filePath).toBeTruthy();
      expect(fs.existsSync(filePath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content._meta.filename).toBeNull();
    });

    it('should handle long duration formatting', async () => {
      const track = { id: 'track-long', title: 'Long Track', duration_s: 3661 };
      const result = { file: 'Long Track_track-long.mp3', status: 'success' };

      await exportTrackMetadata(tempDir, track, result);

      const content = JSON.parse(fs.readFileSync(path.join(tempDir, 'Long Track_track-long.json'), 'utf-8'));
      expect(content._meta.durationFormatted).toBe('1:01:01');
    });
  });

  describe('rebuildGlobalIndex', () => {
    it('should create _index.json from track metadata files', async () => {
      const track1 = { id: 'idx-1', title: 'Index Track 1', duration_s: 120 };
      const track2 = { id: 'idx-2', title: 'Index Track 2', duration_s: 180 };

      await exportTrackMetadata(tempDir, track1, { file: 'Index Track 1_idx-1.mp3', status: 'success' });
      await exportTrackMetadata(tempDir, track2, { file: 'Index Track 2_idx-2.mp3', status: 'skipped' });

      const index = await rebuildGlobalIndex(tempDir);

      expect(index).toBeTruthy();
      expect(index._meta.trackCount).toBe(2);
      expect(index._meta.totalDuration).toBe(300);
      expect(index._meta.totalDurationFormatted).toBe('5:00');
      expect(index.tracks).toHaveLength(2);
      expect(fs.existsSync(path.join(tempDir, '_index.json'))).toBe(true);
    });

    it('should include all track metadata in index', async () => {
      const track = {
        id: 'idx-full',
        title: 'Full Index Track',
        duration_s: 90,
        author_id: 'author-idx',
        created_at: '2026-01-15T10:00:00.000Z',
        is_favorite: true,
      };

      await exportTrackMetadata(tempDir, track, { file: 'Full Index Track_idx-full.mp3', status: 'success' }, 'Test Playlist');
      const index = await rebuildGlobalIndex(tempDir);

      const trackEntry = index.tracks[0];
      expect(trackEntry.id).toBe('idx-full');
      expect(trackEntry.title).toBe('Full Index Track');
      expect(trackEntry.duration).toBe(90);
      expect(trackEntry.status).toBe('success');
      expect(trackEntry.playlist).toBe('Test Playlist');
      expect(trackEntry.isFavorite).toBe(true);
      expect(trackEntry.authorId).toBe('author-idx');
      expect(trackEntry.createdAt).toBe('2026-01-15T10:00:00.000Z');
    });

    it('should return null when directory does not exist', async () => {
      const index = await rebuildGlobalIndex('/nonexistent/directory');
      expect(index).toBeNull();
    });

    it('should handle empty directory', async () => {
      const emptyDir = path.join(tempDir, 'empty');
      fs.mkdirSync(emptyDir);

      const index = await rebuildGlobalIndex(emptyDir);

      expect(index).toBeTruthy();
      expect(index._meta.trackCount).toBe(0);
      expect(index.tracks).toHaveLength(0);
    });

    it('should skip _index.json when scanning', async () => {
      fs.writeFileSync(path.join(tempDir, '_index.json'), JSON.stringify({ old: 'data' }));

      const track = { id: 'skip-idx', title: 'Skip Index' };
      await exportTrackMetadata(tempDir, track, { file: 'Skip Index_skip-idx.mp3', status: 'success' });

      const index = await rebuildGlobalIndex(tempDir);

      expect(index._meta.trackCount).toBe(1);
    });

    it('should handle malformed JSON gracefully', async () => {
      fs.writeFileSync(path.join(tempDir, 'Malformed_bad.json'), 'not valid json {{{');

      const track = { id: 'good-1', title: 'Good Track' };
      await exportTrackMetadata(tempDir, track, { file: 'Good Track_good-1.mp3', status: 'success' });

      const index = await rebuildGlobalIndex(tempDir);

      expect(index._meta.trackCount).toBe(1);
    });

    it('should include directory name in _meta', async () => {
      const subdir = path.join(tempDir, 'MyPlaylist');
      fs.mkdirSync(subdir);

      const track = { id: 'dir-test', title: 'Dir Track' };
      await exportTrackMetadata(subdir, track, { file: 'Dir Track_dir-test.mp3', status: 'success' });
      const index = await rebuildGlobalIndex(subdir);

      expect(index._meta.directory).toBe('MyPlaylist');
    });
  });

  describe('Legacy Functions (Backward Compatibility)', () => {
    it('collectMetadata should return minimal metadata', () => {
      const track = { id: 'legacy-1', title: 'Legacy Track' };
      const result = { file: 'Legacy Track_legacy-1.mp3', status: 'success' };

      const metadata = collectMetadata(track, result);

      expect(metadata.id).toBe('legacy-1');
      expect(metadata.title).toBe('Legacy Track');
      expect(metadata.filename).toBe('Legacy Track_legacy-1.mp3');
      expect(metadata.status).toBe('success');
      expect(metadata.downloadedAt).toBeTruthy();
    });

    it('collectMetadata should include playlist name when provided', () => {
      const track = { id: 'legacy-pl', title: 'Legacy Playlist' };
      const result = { file: 'test.mp3', status: 'success' };

      const metadata = collectMetadata(track, result, 'Legacy Playlist');

      expect(metadata.playlist).toBe('Legacy Playlist');
    });

    it('collectMetadata should include file size when available', () => {
      const track = { id: 'legacy-size', title: 'Legacy Size' };
      const filePath = path.join(tempDir, 'legacy-size.mp3');
      fs.writeFileSync(filePath, 'test content');
      const result = { file: 'legacy-size.mp3', filePath, status: 'success' };

      const metadata = collectMetadata(track, result);

      expect(metadata.size).toBeGreaterThan(0);
    });

    it('exportMetadata should create metadata.json', () => {
      const metadata = [
        { id: '1', title: 'Track 1', status: 'success' },
        { id: '2', title: 'Track 2', status: 'skipped' },
      ];

      exportMetadata(tempDir, metadata);

      const file = path.join(tempDir, 'metadata.json');
      expect(fs.existsSync(file)).toBe(true);

      const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
      expect(content.exportedAt).toBeTruthy();
      expect(content.tracks).toHaveLength(2);
    });
  });
});
