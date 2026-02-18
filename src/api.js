/**
 * Producer.ai API Communication
 */

export async function fetchTrackById(token, trackId) {
  const url = `https://www.producer.ai/__api/v2/generations/${trackId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function fetchGenerations(token, userId, offset = 0, limit = 20) {
  const url = `https://www.producer.ai/__api/v2/users/${userId}/generations?offset=${offset}&limit=${limit}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function fetchPlaylists(token, userId, offset = 0, limit = 20) {
  const url = `https://www.producer.ai/__api/v2/users/${userId}/playlists?offset=${offset}&limit=${limit}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function fetchAllPlaylists(token, userId) {
  let allPlaylists = [];
  let offset = 0;
  const limit = 20;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await fetchPlaylists(token, userId, offset, limit);

      // Response can be array directly or object with playlists property
      const playlists = Array.isArray(response)
        ? response
        : (response.playlists || response.data || response.items || []);

      if (playlists.length === 0) {
        hasMore = false;
      } else {
        allPlaylists = allPlaylists.concat(playlists);
        offset += limit;
      }
    } catch (error) {
      throw new Error(`Failed to fetch playlists: ${error.message}`);
    }
  }

  return allPlaylists;
}

export async function fetchPlaylistTracks(token, playlistId, offset = 0, limit = 20) {
  const url = `https://www.producer.ai/__api/v2/playlists/${playlistId}?offset=${offset}&limit=${limit}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function fetchAllPlaylistTracks(token, playlistId) {
  let allTracks = [];
  let offset = 0;
  const limit = 20;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await fetchPlaylistTracks(token, playlistId, offset, limit);

      // Response can be array directly or object with tracks property
      const tracks = Array.isArray(response)
        ? response
        : (response.tracks || response.generations || response.data || response.items || []);

      if (tracks.length === 0) {
        hasMore = false;
      } else {
        allTracks = allTracks.concat(tracks);
        offset += limit;
      }
    } catch (error) {
      throw new Error(`Failed to fetch playlist tracks: ${error.message}`);
    }
  }

  return allTracks;
}

export async function fetchFavorites(token, page = 0, limit = 20) {
  const url = `https://www.producer.ai/__api/v2/generations/favorites?page=${page}&limit=${limit}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function fetchAllFavorites(token) {
  let allFavorites = [];
  let page = 0;
  const limit = 20;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await fetchFavorites(token, page, limit);

      // Response can be array directly or object with favorites property
      const favorites = Array.isArray(response)
        ? response
        : (response.favorites || response.data || response.items || []);

      if (favorites.length === 0) {
        hasMore = false;
      } else {
        allFavorites = allFavorites.concat(favorites);
        page++;
      }
    } catch (error) {
      throw new Error(`Failed to fetch favorites: ${error.message}`);
    }
  }

  return allFavorites;
}

export function getDownloadUrl(generationId, format = 'mp3') {
  return `https://www.producer.ai/__api/${generationId}/download?format=${format}`;
}

export async function getUserInfo(token) {
  const response = await fetch('https://www.producer.ai/__api/v2/users/me', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
}

/**
 * Fetch riff title from the public riff page (og:title meta tag)
 * Returns just the title part (before " by Artist")
 */
export async function fetchRiffTitle(riffId) {
  try {
    const url = `https://www.producer.ai/riff/${riffId}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Extract og:title: "Title by Artist"
    const match = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i);
    if (match) {
      const fullTitle = match[1];
      // Remove " by Artist" suffix if present
      const byIndex = fullTitle.lastIndexOf(' by ');
      return byIndex > 0 ? fullTitle.substring(0, byIndex) : fullTitle;
    }

    return null;
  } catch (error) {
    return null;
  }
}
