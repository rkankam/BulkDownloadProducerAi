import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { downloadTrackWithRetry } from '../src/downloader.js';

describe('downloadTrackWithRetry', () => {
  let tempDir;
  let originalFetch;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'download-test-'));
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should successfully download on first attempt', async () => {
    const mockBuffer = Buffer.from('fake audio data');
    global.fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockBuffer.buffer),
    });

    const generation = {
      id: 'track123',
      title: 'Test Track',
    };

    const result = await downloadTrackWithRetry(generation, 'fake-token', tempDir, 'mp3');

    expect(result.status).toBe('success');
    expect(result.file).toContain('Test Track_track123.mp3');
    expect(result.size).toBeGreaterThan(0);

    const filePath = path.join(tempDir, result.file);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.existsSync(`${filePath}.downloading`)).toBe(false);
  });

  it('should retry on failure and succeed on second attempt', async () => {
    const mockBuffer = Buffer.from('fake audio data');

    global.fetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockBuffer.buffer),
      });

    const generation = {
      id: 'track456',
      title: 'Retry Track',
    };

    const result = await downloadTrackWithRetry(generation, 'fake-token', tempDir, 'mp3');

    expect(result.status).toBe('success');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should fail after max retries', async () => {
    global.fetch.mockRejectedValue(new Error('Persistent network error'));

    const generation = {
      id: 'track789',
      title: 'Failed Track',
    };

    const result = await downloadTrackWithRetry(generation, 'fake-token', tempDir, 'mp3', {
      maxRetries: 2,
    });

    expect(result.status).toBe('failed');
    expect(result.message).toContain('Persistent network error');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should handle HTTP error responses', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: {
        get: () => 'text/plain',
      },
      text: () => Promise.resolve('Track not found'),
    });

    const generation = {
      id: 'track404',
      title: 'Missing Track',
    };

    const result = await downloadTrackWithRetry(generation, 'fake-token', tempDir, 'mp3', {
      maxRetries: 1,
    });

    expect(result.status).toBe('failed');
    expect(result.message).toContain('404');
  });

  it('should skip already downloaded files', async () => {
    const generation = {
      id: 'track999',
      title: 'Existing Track',
    };

    const filename = 'Existing Track_track999.mp3';
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, 'existing content');

    const result = await downloadTrackWithRetry(generation, 'fake-token', tempDir, 'mp3');

    expect(result.status).toBe('skipped');
    expect(result.message).toContain('exists');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should handle generation with riff_id instead of id', async () => {
    const mockBuffer = Buffer.from('fake audio data');
    global.fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockBuffer.buffer),
    });

    const generation = {
      riff_id: 'riff123',
      name: 'Playlist Track',
    };

    const result = await downloadTrackWithRetry(generation, 'fake-token', tempDir, 'mp3');

    expect(result.status).toBe('success');
    expect(result.file).toContain('Playlist Track_riff123.mp3');
  });

  it('should clean up .downloading file on failure', async () => {
    global.fetch.mockRejectedValue(new Error('Download failed'));

    const generation = {
      id: 'track_cleanup',
      title: 'Cleanup Test',
    };

    await downloadTrackWithRetry(generation, 'fake-token', tempDir, 'mp3', {
      maxRetries: 1,
    });

    const files = fs.readdirSync(tempDir);
    const downloadingFiles = files.filter(f => f.endsWith('.downloading'));
    expect(downloadingFiles.length).toBe(0);
  });

  it('should use custom maxRetries option', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    const generation = {
      id: 'track_retries',
      title: 'Custom Retries',
    };

    await downloadTrackWithRetry(generation, 'fake-token', tempDir, 'mp3', {
      maxRetries: 5,
    });

    expect(global.fetch).toHaveBeenCalledTimes(5);
  }, 20000);

  it('should handle empty response buffer', async () => {
    const emptyBuffer = Buffer.from('');
    global.fetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(emptyBuffer.buffer),
    });

    const generation = {
      id: 'track_empty',
      title: 'Empty Track',
    };

    const result = await downloadTrackWithRetry(generation, 'fake-token', tempDir, 'mp3', {
      maxRetries: 1,
    });

    expect(result.status).toBe('failed');
    expect(result.message).toContain('empty');
  });

  it('should include authorization header in request', async () => {
    const mockBuffer = Buffer.from('fake audio data');
    global.fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockBuffer.buffer),
    });

    const generation = {
      id: 'track_auth',
      title: 'Auth Test',
    };

    await downloadTrackWithRetry(generation, 'test-token-123', tempDir, 'mp3');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token-123',
        }),
      })
    );
  });
});
