import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchFavorites, fetchAllFavorites } from '../src/api.js';

describe('fetchFavorites', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should fetch favorites with page pagination', async () => {
    const mockResponse = {
      data: [
        { id: 'fav-1', title: 'Favorite Track 1' },
        { id: 'fav-2', title: 'Favorite Track 2' },
      ],
    };

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await fetchFavorites('token123', 0, 20);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.producer.ai/__api/v2/generations/favorites?page=0&limit=20',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Authorization': 'Bearer token123',
        }),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it('should use page parameter correctly', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    await fetchFavorites('token', 5, 20);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('page=5'),
      expect.anything()
    );
  });

  it('should use limit parameter correctly', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    await fetchFavorites('token', 0, 50);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=50'),
      expect.anything()
    );
  });

  it('should throw error on failed request', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    await expect(fetchFavorites('invalid-token', 0, 20)).rejects.toThrow('API error: 401 Unauthorized');
  });
});

describe('fetchAllFavorites', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should fetch all favorites across multiple pages', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 'fav-1' }, { id: 'fav-2' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 'fav-3' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
        }),
      });

    const result = await fetchAllFavorites('token');

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('fav-1');
    expect(result[2].id).toBe('fav-3');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should handle array response directly', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 'fav-1' }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

    const result = await fetchAllFavorites('token');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('fav-1');
  });

  it('should handle favorites property in response', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          favorites: [{ id: 'fav-1' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          favorites: [],
        }),
      });

    const result = await fetchAllFavorites('token');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('fav-1');
  });

  it('should increment page number correctly', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'fav-1' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

    await fetchAllFavorites('token');

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('page=0'),
      expect.anything()
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('page=1'),
      expect.anything()
    );
  });

  it('should throw error when fetch fails', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(fetchAllFavorites('token')).rejects.toThrow('Failed to fetch favorites');
  });

  it('should return empty array when no favorites', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    const result = await fetchAllFavorites('token');

    expect(result).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
