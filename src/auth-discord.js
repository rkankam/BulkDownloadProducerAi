import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
}

export function getTokenExpiry(token) {
  try {
    const payload = decodeJwtPayload(token);
    return payload?.exp ?? null;
  } catch {
    return null;
  }
}

export function isTokenExpiringSoon(token, bufferSeconds = 300) {
  const exp = getTokenExpiry(token);
  if (!exp) return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return (exp - nowSeconds) < bufferSeconds;
}

export async function refreshToken(refreshTokenValue) {
  const url = 'https://www.producer.ai/__api/auth/v1/token?grant_type=refresh_token';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhndHB6dWtlem9keHJnbWZobHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjI5NjA5NjIsImV4cCI6MjAzODUzNjk2Mn0.KMPBzAsGkGFi-TOF-QFHB0KYHGnMJwS2LGvLlmMQ7e0',
    },
    body: JSON.stringify({ refresh_token: refreshTokenValue }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}

export async function ensureFreshToken(config, configPath = 'config.json') {
  if (!config.refreshToken) {
    return config;
  }

  if (!isTokenExpiringSoon(config.token)) {
    return config;
  }

  console.log('🔄 Token expiring soon, refreshing...');
  try {
    const result = await refreshToken(config.refreshToken);
    config.token = result.access_token;
    config.refreshToken = result.refresh_token;
    config.tokenRefreshedAt = new Date().toISOString();

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('✅ Token refreshed successfully');
  } catch (error) {
    console.error('⚠️  Token refresh failed:', error.message);
  }

  return config;
}

/**
 * Discord OAuth Authentication via Playwright
 * Flow: producer.ai → Discord OAuth → Supabase JWT Token
 */

export async function discordAuth(options = {}) {
  const {
    headless = false,
    timeout = 120000,
    saveToConfig = false,
    configPath = 'config.json',
  } = options;

  let browser;
  let capturedToken = null;

  try {
    console.log('🔐 Starting Discord authentication...');
    console.log('   Launching Chromium browser');

    browser = await chromium.launch({ headless });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Intercept all requests to capture Bearer token
    // Only capture tokens with 'kid' in header (the real user token, not internal Supabase tokens)
    page.on('request', request => {
      const headers = request.headers();
      if (headers['authorization'] && headers['authorization'].startsWith('Bearer ')) {
        const token = headers['authorization'].replace('Bearer ', '');

        // Check if this is the real user token (has 'kid' in JWT header)
        try {
          const headerPart = token.split('.')[0];
          const headerJson = JSON.parse(Buffer.from(headerPart, 'base64').toString('utf-8'));
          if (headerJson.kid) {
            capturedToken = token;
            console.log(`✅ JWT Token captured (with kid): ${token.substring(0, 50)}...`);
          }
        } catch (e) {
          // If parsing fails, still capture as fallback
          if (!capturedToken) {
            capturedToken = token;
            console.log(`✅ JWT Token captured (fallback): ${token.substring(0, 50)}...`);
          }
        }
      }
    });

    // Navigate to producer.ai
    console.log('📍 Navigating to producer.ai');
    try {
      await page.goto('https://www.producer.ai', { waitUntil: 'networkidle', timeout: 10000 });
    } catch (e) {
      console.log('⚠️  Navigation timeout (expected during auth flow)');
    }

    // Wait for Discord OAuth to complete
    console.log('\n🔗 Waiting for Discord OAuth flow...');
    console.log('   Please complete the login in the browser window\n');

    // Wait for token capture or timeout
    const startTime = Date.now();
    while (!capturedToken && Date.now() - startTime < timeout) {
      await page.waitForTimeout(1000);
    }

    let capturedRefreshToken = null;

    if (!capturedToken) {
      console.log('⚠️  No token in request headers, checking storage...');
      const storageResult = await extractTokenFromStorage(page);
      if (storageResult) {
        capturedToken = storageResult.access_token;
        capturedRefreshToken = storageResult.refresh_token;
      }
    } else {
      const storageResult = await extractTokenFromStorage(page);
      if (storageResult?.refresh_token) {
        capturedRefreshToken = storageResult.refresh_token;
      }
    }

    if (!capturedToken) {
      throw new Error('Failed to capture JWT token from Discord OAuth');
    }

    console.log('\n✅ Authentication successful!');
    console.log(`🔑 Token: ${capturedToken.substring(0, 80)}...`);
    if (capturedRefreshToken) {
      console.log(`🔄 Refresh token captured`);
    }

    console.log('\n📊 Fetching user information...');
    const userId = await fetchUserId(page, capturedToken);
    console.log(`👤 User ID: ${userId}`);

    const expiresAt = getTokenExpiry(capturedToken);

    if (saveToConfig) {
      console.log(`\n💾 Saving configuration to ${configPath}`);
      const config = {
        token: capturedToken,
        refreshToken: capturedRefreshToken,
        userId,
        outputDir: './downloads',
        format: 'mp3',
        authMethod: 'discord',
        authenticatedAt: new Date().toISOString(),
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log('✅ Configuration saved');
    }

    return {
      token: capturedToken,
      refreshToken: capturedRefreshToken,
      userId,
      expiresAt,
    };
  } catch (error) {
    console.error('\n❌ Authentication failed:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('\n🔒 Browser closed');
    }
  }
}

/**
 * Extract token from localStorage or cookies
 */
async function extractTokenFromStorage(page) {
  try {
    const supabaseAuth = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-')) {
          try {
            const parsed = JSON.parse(localStorage.getItem(key));
            if (parsed?.access_token) {
              return { access_token: parsed.access_token, refresh_token: parsed.refresh_token || null };
            }
          } catch {
            // skip non-JSON values
          }
        }
      }

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        if (value && value.startsWith('eyJ')) {
          return { access_token: value, refresh_token: null };
        }
      }
      return null;
    });

    if (supabaseAuth?.access_token) {
      console.log(`   Found tokens in localStorage`);
      return supabaseAuth;
    }

    // Check Supabase auth cookies
    const cookies = await page.context().cookies();
    for (const cookie of cookies) {
      if (cookie.name.startsWith('sb-api-auth-token')) {
        try {
          const data = JSON.parse(cookie.value);
          if (data.access_token) {
            console.log(`   Found token in cookie: ${cookie.name}`);
            return { access_token: data.access_token, refresh_token: data.refresh_token || null };
          }
        } catch {
          // Not JSON, skip
        }
      }
    }

    return null;
  } catch (error) {
    console.error('   Error extracting from storage:', error.message);
    return null;
  }
}

/**
 * Fetch user ID from API or JWT token
 */
async function fetchUserId(page, token) {
   try {
     // Try to extract from JWT token payload
     const parts = token.split('.');

    if (parts.length === 3) {
       try {
         // Handle base64url encoding (replace - with + and _ with /)
         const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
         const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
         if (payload.sub) {
           console.log(`   Found user ID in JWT: ${payload.sub}`);
           return payload.sub;
         }
      } catch (e) {
        console.log(`   JWT parsing error: ${e.message}`);
        // If JWT parsing fails, continue to API calls
      }
    }

    // Fallback to API call
    const response = await page.evaluate(async (bearerToken) => {
      const res = await fetch('https://www.producer.ai/__api/v2/users/me', {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
        },
      });
      return await res.json();
    }, token);

    if (response.id) {
      return response.id;
    }

    // Try alternative endpoint
    const response2 = await page.evaluate(async (bearerToken) => {
      const res = await fetch('https://www.producer.ai/__api/v2/users', {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
        },
      });
      return await res.json();
    }, token);

    if (response2[0]?.id) {
      return response2[0].id;
    }

    return 'unknown';
  } catch (error) {
    console.error('   Error fetching user ID:', error.message);
    return 'unknown';
  }
}

/**
 * Validate existing token by extracting user ID and testing generations endpoint
 */
export async function validateToken(token) {
  try {
    // Extract user ID from JWT token
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('❌ Invalid token format');
      return false;
    }

    let userId;
    try {
      // Handle base64url encoding (replace - with + and _ with /)
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
      userId = payload.sub;
    } catch (e) {
      console.log('❌ Failed to parse token:', e.message);
      return false;
    }

    if (!userId) {
      console.log('❌ No user ID in token');
      return false;
    }

    // Validate by testing generations endpoint
    const url = `https://www.producer.ai/__api/v2/users/${userId}/generations?offset=0&limit=1`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (response.status === 200) {
      console.log(`✅ Token valid for user: ${userId}`);
      return true;
    } else if (response.status === 401) {
      console.log('❌ Token expired or invalid');
      return false;
    } else {
      console.log(`⚠️  Unexpected API response: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Token validation failed:', error.message);
    return false;
  }
}

/**
 * Load config and validate token
 */
export async function loadConfig(configPath = 'config.json') {
  try {
    if (!fs.existsSync(configPath)) {
      console.log(`⚠️  Config file not found: ${configPath}`);
      return null;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    console.log('🔍 Validating stored token...');
    let isValid = await validateToken(config.token);

    if (!isValid && config.refreshToken) {
      console.log('🔄 Token invalid, attempting refresh...');
      try {
        const result = await refreshToken(config.refreshToken);
        config.token = result.access_token;
        config.refreshToken = result.refresh_token;
        config.tokenRefreshedAt = new Date().toISOString();
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('✅ Token refreshed successfully');
        isValid = await validateToken(config.token);
      } catch (error) {
        console.error('⚠️  Token refresh failed:', error.message);
      }
    }

    if (!isValid) {
      console.log('⚠️  Stored token is invalid, need re-authentication');
      return null;
    }

    // Fix userId if it's "unknown" by extracting from JWT
    if (config.userId === 'unknown') {
      console.log('⚠️  userId is unknown, extracting from token...');
      try {
        const parts = config.token.split('.');
        if (parts.length === 3) {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
          if (payload.sub) {
            config.userId = payload.sub;
            // Save fixed config
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log(`✅ userId fixed: ${config.userId}`);
          }
        }
      } catch (e) {
        console.log('⚠️  Could not extract userId from token');
      }
    }

    console.log(`✅ Config loaded for user: ${config.userId}`);
    return config;
  } catch (error) {
    console.error('❌ Error loading config:', error.message);
    return null;
  }
}
