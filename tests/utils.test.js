import { describe, it, expect } from 'vitest';
import { sanitizeFilename, sanitizeDirectoryName } from '../src/utils.js';

describe('sanitizeFilename', () => {
  it('should handle normal filenames', () => {
    expect(sanitizeFilename('my-track.mp3')).toBe('my-track.mp3');
    expect(sanitizeFilename('Track 123.mp3')).toBe('Track 123.mp3');
  });

  it('should replace invalid characters with underscore', () => {
    // The sanitize-filename library handles these
    const result = sanitizeFilename('track<>:"/\\|?*.mp3');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain(':');
    expect(result).not.toContain('"');
    expect(result).not.toContain('/');
    expect(result).not.toContain('\\');
    expect(result).not.toContain('|');
    expect(result).not.toContain('?');
    expect(result).not.toContain('*');
  });

  it('should handle empty string', () => {
    const result = sanitizeFilename('');
    expect(result).toBe('');
  });

  it('should handle very long filenames', () => {
    const longName = 'a'.repeat(300) + '.mp3';
    const result = sanitizeFilename(longName);
    // sanitize-filename library has its own length limits
    expect(result.length).toBeLessThanOrEqual(255);
  });

  it('should handle special characters', () => {
    expect(sanitizeFilename('track@#$%.mp3')).toContain('track');
    expect(sanitizeFilename('track (remix).mp3')).toBe('track (remix).mp3');
  });
});

describe('sanitizeDirectoryName', () => {
  it('should handle normal directory names', () => {
    expect(sanitizeDirectoryName('My Playlist')).toBe('My Playlist');
    expect(sanitizeDirectoryName('playlist-123')).toBe('playlist-123');
  });

  it('should replace invalid characters with underscore', () => {
    expect(sanitizeDirectoryName('play<list')).toBe('play_list');
    expect(sanitizeDirectoryName('play>list')).toBe('play_list');
    expect(sanitizeDirectoryName('play:list')).toBe('play_list');
    expect(sanitizeDirectoryName('play"list')).toBe('play_list');
    expect(sanitizeDirectoryName('play/list')).toBe('play_list');
    expect(sanitizeDirectoryName('play\\list')).toBe('play_list');
    expect(sanitizeDirectoryName('play|list')).toBe('play_list');
    expect(sanitizeDirectoryName('play?list')).toBe('play_list');
    expect(sanitizeDirectoryName('play*list')).toBe('play_list');
  });

  it('should handle empty or invalid input', () => {
    expect(sanitizeDirectoryName('')).toBe('playlist');
    expect(sanitizeDirectoryName(null)).toBe('playlist');
    expect(sanitizeDirectoryName(undefined)).toBe('playlist');
    expect(sanitizeDirectoryName(123)).toBe('playlist');
  });

  it('should remove leading and trailing spaces and dots', () => {
    expect(sanitizeDirectoryName('  playlist  ')).toBe('playlist');
    expect(sanitizeDirectoryName('...playlist...')).toBe('playlist');
    expect(sanitizeDirectoryName('  ...playlist...  ')).toBe('playlist');
  });

  it('should handle Windows reserved names', () => {
    expect(sanitizeDirectoryName('CON')).toBe('_CON');
    expect(sanitizeDirectoryName('PRN')).toBe('_PRN');
    expect(sanitizeDirectoryName('AUX')).toBe('_AUX');
    expect(sanitizeDirectoryName('NUL')).toBe('_NUL');
    expect(sanitizeDirectoryName('COM1')).toBe('_COM1');
    expect(sanitizeDirectoryName('LPT1')).toBe('_LPT1');
    expect(sanitizeDirectoryName('con')).toBe('_con'); // case insensitive
    expect(sanitizeDirectoryName('prn')).toBe('_prn');
  });

  it('should limit length to 200 characters', () => {
    const longName = 'a'.repeat(250);
    const result = sanitizeDirectoryName(longName);
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('should handle only invalid characters', () => {
    expect(sanitizeDirectoryName('<<<>>>')).toBe('______');
    expect(sanitizeDirectoryName('***')).toBe('___');
    expect(sanitizeDirectoryName('...')).toBe('playlist');
  });

  it('should preserve valid special characters', () => {
    expect(sanitizeDirectoryName('My Playlist (2024)')).toBe('My Playlist (2024)');
    expect(sanitizeDirectoryName('Playlist #1')).toBe('Playlist #1');
    expect(sanitizeDirectoryName('Best-Of')).toBe('Best-Of');
  });
});
