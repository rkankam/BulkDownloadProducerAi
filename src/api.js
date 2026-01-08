/**
 * Producer.ai API Communication
 */

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
      const playlists = response.playlists || [];

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
      const tracks = response.tracks || response.generations || [];

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
