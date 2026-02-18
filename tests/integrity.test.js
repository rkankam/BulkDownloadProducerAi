import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { verifyTrackIntegrity, scanIntegrityIssues, updateTrackMetadata, rebuildGlobalIndex } from '../src/metadata.js';

describe('Integrity Verification', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'integrity-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('verifyTrackIntegrity', () => {
    it('should return ok for valid file with JSON', () => {
      const track = { id: 'track-1', title: 'Test Track', filename: 'Test Track_track-1.mp3' };
      const audioFile = path.join(tempDir, 'Test Track_track-1.mp3');
      const jsonFile = path.join(tempDir, 'Test Track_track-1.json');

      fs.writeFileSync(audioFile, 'x'.repeat(200 * 1024));
      fs.writeFileSync(jsonFile, JSON.stringify({ _meta: {}, apiResponse: track }));

      const result = verifyTrackIntegrity(tempDir, track);

      expect(result.status).toBe('ok');
      expect(result.action).toBe('none');
      expect(result.fileSize).toBeGreaterThan(0);
    });

    it('should return missing when file does not exist', () => {
      const track = { id: 'track-2', title: 'Missing Track', filename: 'Missing Track_track-2.mp3' };

      const result = verifyTrackIntegrity(tempDir, track);

      expect(result.status).toBe('missing');
      expect(result.action).toBe('download');
    });

    it('should return empty for zero-byte file', () => {
      const track = { id: 'track-3', title: 'Empty Track', filename: 'Empty Track_track-3.mp3' };
      const audioFile = path.join(tempDir, 'Empty Track_track-3.mp3');

      fs.writeFileSync(audioFile, '');

      const result = verifyTrackIntegrity(tempDir, track);

      expect(result.status).toBe('empty');
      expect(result.action).toBe('download');
    });

    it('should return empty for file below minimum size', () => {
      const track = { id: 'track-4', title: 'Small Track', filename: 'Small Track_track-4.mp3' };
      const audioFile = path.join(tempDir, 'Small Track_track-4.mp3');

      fs.writeFileSync(audioFile, 'x'.repeat(50 * 1024));

      const result = verifyTrackIntegrity(tempDir, track);

      expect(result.status).toBe('empty');
      expect(result.action).toBe('download');
    });

    it('should return missing_json when audio exists but no JSON', () => {
      const track = { id: 'track-5', title: 'No JSON Track', filename: 'No JSON Track_track-5.mp3' };
      const audioFile = path.join(tempDir, 'No JSON Track_track-5.mp3');

      fs.writeFileSync(audioFile, 'x'.repeat(200 * 1024));

      const result = verifyTrackIntegrity(tempDir, track);

      expect(result.status).toBe('missing_json');
      expect(result.action).toBe('export_metadata_only');
    });

    it('should return no_filename when filename is null', () => {
      const track = { id: 'track-6', title: 'No Filename', filename: null };

      const result = verifyTrackIntegrity(tempDir, track);

      expect(result.status).toBe('no_filename');
      expect(result.action).toBe('skip');
    });

    it('should check WAV minimum size correctly', () => {
      const track = { id: 'track-7', title: 'Small WAV', filename: 'Small WAV_track-7.wav' };
      const audioFile = path.join(tempDir, 'Small WAV_track-7.wav');

      fs.writeFileSync(audioFile, 'x'.repeat(100 * 1024));

      const result = verifyTrackIntegrity(tempDir, track);

      expect(result.status).toBe('empty');
    });

    it('should accept WAV file above minimum size', () => {
      const track = { id: 'track-8', title: 'Valid WAV', filename: 'Valid WAV_track-8.wav' };
      const audioFile = path.join(tempDir, 'Valid WAV_track-8.wav');
      const jsonFile = path.join(tempDir, 'Valid WAV_track-8.json');

      fs.writeFileSync(audioFile, 'x'.repeat(600 * 1024));
      fs.writeFileSync(jsonFile, JSON.stringify({ _meta: {}, apiResponse: track }));

      const result = verifyTrackIntegrity(tempDir, track);

      expect(result.status).toBe('ok');
    });
  });

  describe('scanIntegrityIssues', () => {
    it('should return empty results for non-existent directory', () => {
      const result = scanIntegrityIssues('/nonexistent/path');

      expect(result.summary.totalIssues).toBe(0);
      expect(Object.keys(result.byDirectory)).toHaveLength(0);
    });

    it('should return empty results for empty directory', () => {
      const result = scanIntegrityIssues(tempDir);

      expect(result.summary.totalIssues).toBe(0);
    });

    it('should detect missing files from index', () => {
      const indexDir = tempDir;
      const indexFile = path.join(indexDir, '_index.json');

      const index = {
        _meta: { trackCount: 1, totalDuration: 0, directory: 'test' },
        tracks: [{ id: 'missing-1', title: 'Missing', filename: 'Missing_missing-1.mp3', status: 'failed' }]
      };
      fs.writeFileSync(indexFile, JSON.stringify(index));

      const result = scanIntegrityIssues(tempDir);

      expect(result.summary.needDownload).toBe(1);
      expect(result.summary.totalIssues).toBe(1);
    });

    it('should detect orphan files not in index', () => {
      const indexDir = tempDir;
      const indexFile = path.join(indexDir, '_index.json');
      const orphanFile = path.join(indexDir, 'Orphan Track_orphan-123.mp3');

      const index = {
        _meta: { trackCount: 0, totalDuration: 0, directory: 'test' },
        tracks: []
      };
      fs.writeFileSync(indexFile, JSON.stringify(index));
      fs.writeFileSync(orphanFile, 'x'.repeat(200 * 1024));

      const result = scanIntegrityIssues(tempDir);

      expect(result.summary.orphans).toBe(1);
      expect(result.summary.totalIssues).toBe(1);
    });

    it('should detect missing JSON files', () => {
      const indexDir = tempDir;
      const indexFile = path.join(indexDir, '_index.json');
      const audioFile = path.join(indexDir, 'No JSON_nojson-1.mp3');

      const index = {
        _meta: { trackCount: 1, totalDuration: 0, directory: 'test' },
        tracks: [{ id: 'nojson-1', title: 'No JSON', filename: 'No JSON_nojson-1.mp3', status: 'success' }]
      };
      fs.writeFileSync(indexFile, JSON.stringify(index));
      fs.writeFileSync(audioFile, 'x'.repeat(200 * 1024));

      const result = scanIntegrityIssues(tempDir);

      expect(result.summary.needMetadataOnly).toBe(1);
      expect(result.summary.totalIssues).toBe(1);
    });

    it('should handle multiple issues in same directory', () => {
      const indexDir = tempDir;
      const indexFile = path.join(indexDir, '_index.json');
      const missingFile = path.join(indexDir, 'Missing_missing-1.mp3');
      const goodFile = path.join(indexDir, 'Good_good-1.mp3');
      const goodJson = path.join(indexDir, 'Good_good-1.json');

      const index = {
        _meta: { trackCount: 2, totalDuration: 0, directory: 'test' },
        tracks: [
          { id: 'missing-1', title: 'Missing', filename: 'Missing_missing-1.mp3', status: 'failed' },
          { id: 'good-1', title: 'Good', filename: 'Good_good-1.mp3', status: 'success' }
        ]
      };
      fs.writeFileSync(indexFile, JSON.stringify(index));
      fs.writeFileSync(goodFile, 'x'.repeat(200 * 1024));
      fs.writeFileSync(goodJson, JSON.stringify({ _meta: {}, apiResponse: { id: 'good-1' } }));

      const result = scanIntegrityIssues(tempDir);

      expect(result.summary.needDownload).toBe(1);
      expect(result.summary.totalIssues).toBe(1);
    });

    it('should scan subdirectories for _index.json', () => {
      const subdir = path.join(tempDir, 'favorites');
      fs.mkdirSync(subdir);

      const indexFile = path.join(subdir, '_index.json');
      const index = {
        _meta: { trackCount: 1, totalDuration: 0, directory: 'favorites' },
        tracks: [{ id: 'fav-1', title: 'Favorite', filename: 'Favorite_fav-1.mp3', status: 'failed' }]
      };
      fs.writeFileSync(indexFile, JSON.stringify(index));

      const result = scanIntegrityIssues(tempDir);

      expect(result.summary.needDownload).toBe(1);
      expect(result.byDirectory['favorites']).toBeDefined();
    });
  });

  describe('updateTrackMetadata', () => {
    it('should update download status for a track', () => {
      const trackId = 'update-1';
      const jsonFile = path.join(tempDir, 'Update Track_update-1.json');
      const track = { id: trackId, title: 'Update Track' };

      fs.writeFileSync(jsonFile, JSON.stringify({
        _meta: { downloadStatus: 'failed', exportedAt: '2026-01-01T00:00:00.000Z' },
        apiResponse: track
      }));

      const updated = updateTrackMetadata(tempDir, trackId, 'success');

      expect(updated).toBe(jsonFile);

      const content = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
      expect(content._meta.downloadStatus).toBe('success');
    });

    it('should return null if track not found', () => {
      const result = updateTrackMetadata(tempDir, 'nonexistent', 'success');
      expect(result).toBeNull();
    });
  });
});
