import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PROJECT_ROOT = path.resolve(__dirname);

// In-memory hot asset cache for sub-millisecond serving under 1,000+ concurrent connections
// Bounded LRU: prevents unbounded RSS growth if many distinct files are requested
// (e.g. enumerating node_modules). Evicts oldest entries over limits.
export const ASSET_CACHE = new Map();
export const ASSET_CACHE_MAX_ENTRIES = 200;
export const ASSET_CACHE_MAX_BYTES = 30 * 1024 * 1024;
let assetCacheBytes = 0;
const COMPRESSIBLE_EXTS = new Set(['.html', '.js', '.css', '.json', '.svg', '.map']);
// Bound concurrent gzip compressions: cold misses compress async and burn CPU.
// Past this cap, serve raw and cache raw-only so one client can't pin the loop.
let gzipInflight = 0;
const GZIP_MAX_INFLIGHT = 4;

function getMtimeKey(stats) {
  try {
    if (typeof stats.mtimeNs !== 'undefined') return String(stats.mtimeNs);
  } catch {}
  return String(stats.mtimeMs);
}

function evictAssetCacheIfNeeded() {
  while (
    (ASSET_CACHE.size > ASSET_CACHE_MAX_ENTRIES ||
      assetCacheBytes > ASSET_CACHE_MAX_BYTES) &&
    ASSET_CACHE.size > 0
  ) {
    const oldestKey = ASSET_CACHE.keys().next().value;
    const oldest = ASSET_CACHE.get(oldestKey);
    if (oldest) {
      assetCacheBytes -= oldest.rawBuffer.length + (oldest.gzipBuffer ? oldest.gzipBuffer.length : 0);
      if (assetCacheBytes < 0) assetCacheBytes = 0;
    }
    ASSET_CACHE.delete(oldestKey);
  }
}

export function getAssetCacheBytes() {
  return assetCacheBytes;
}

export async function getCachedAsset(filePath, stats) {
  const mtimeKey = getMtimeKey(stats);
  const cached = ASSET_CACHE.get(filePath);
  if (cached && cached.mtimeKey === mtimeKey && cached.size === stats.size) {
    // Refresh LRU order
    ASSET_CACHE.delete(filePath);
    ASSET_CACHE.set(filePath, cached);
    return cached;
  }
  if (cached) {
    assetCacheBytes -= cached.rawBuffer.length + (cached.gzipBuffer ? cached.gzipBuffer.length : 0);
    if (assetCacheBytes < 0) assetCacheBytes = 0;
    ASSET_CACHE.delete(filePath);
  }

  const rawBuffer = await fs.promises.readFile(filePath);
  const hash = crypto.createHash('sha256').update(rawBuffer).digest('hex').slice(0, 32);
  const etag = `W/"${stats.size.toString(16)}-${hash}"`;
  const ext = path.extname(filePath).toLowerCase();

  let gzipBuffer = null;
  if (COMPRESSIBLE_EXTS.has(ext) && rawBuffer.length > 128) {
    if (gzipInflight < GZIP_MAX_INFLIGHT) {
      gzipInflight += 1;
      try {
        gzipBuffer = await new Promise((resolve, reject) => {
          zlib.gzip(rawBuffer, { level: 6 }, (err, out) => (err ? reject(err) : resolve(out)));
        });
      } catch {}
      finally {
        gzipInflight -= 1;
        if (gzipInflight < 0) gzipInflight = 0;
      }
    }
  }

  const record = {
    mtimeKey,
    size: stats.size,
    rawBuffer,
    etag,
    gzipBuffer
  };

  assetCacheBytes += rawBuffer.length + (gzipBuffer ? gzipBuffer.length : 0);
  ASSET_CACHE.set(filePath, record);
  evictAssetCacheIfNeeded();
  return record;
}

export function clearAssetCache() {
  ASSET_CACHE.clear();
  assetCacheBytes = 0;
}

export const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; worker-src 'self'; manifest-src 'self';",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
  'Origin-Agent-Cluster': '?1',
  'X-DNS-Prefetch-Control': 'off',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

export const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=UTF-8'
};

export const MAX_URL_LENGTH = 2048;

// Per-IP rate limiting (DoS guard for a single-threaded static server).
// Generous for tests/local use; prevents one client from pinning the loop.
export const RATE_LIMIT_MAX_REQUESTS = 300;
export const RATE_LIMIT_WINDOW_MS = 10_000;
const rateLimitBuckets = new Map();

export function isRateLimited(ip) {
  const key = ip || 'unknown';
  const now = Date.now();
  const hit = rateLimitBuckets.get(key);
  if (!hit || now >= hit.reset) {
    // Evict expired entries first; if still over cap, drop only the oldest
    // key (Map preserves insertion order) instead of clearing legitimate buckets.
    if (rateLimitBuckets.size >= 1000) {
      for (const [k, v] of rateLimitBuckets) {
        if (v.reset <= now) rateLimitBuckets.delete(k);
        if (rateLimitBuckets.size < 1000) break;
      }
      if (rateLimitBuckets.size >= 1000) {
        rateLimitBuckets.delete(rateLimitBuckets.keys().next().value);
      }
    }
    rateLimitBuckets.set(key, { count: 1, reset: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  hit.count += 1;
  return hit.count > RATE_LIMIT_MAX_REQUESTS;
}

export function clearRateLimits() {
  rateLimitBuckets.clear();
}

// Only these paths are publicly servable. Everything else (package.json,
// server.js, node_modules/, test/, e2e/, scripts/, etc.) returns 403 even
// if its extension is whitelisted. Root allows index.html only; subtrees
// allow src/, dist/, assets/.
const PUBLIC_SUBTREES = new Set(['src', 'dist', 'assets']);

export function isPublicPath(relFromRoot) {
  if (!relFromRoot || relFromRoot === '.' || relFromRoot === '') return false;
  const parts = relFromRoot.split(path.sep);
  if (parts.length === 1) {
    return parts[0].toLowerCase() === 'index.html';
  }
  return PUBLIC_SUBTREES.has(parts[0].toLowerCase());
}

export function etagMatches(clientEtagHeader, serverEtag) {
  if (!clientEtagHeader || !serverEtag) return false;
  const normalize = (t) => t.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
  const serverNorm = normalize(serverEtag);
  return String(clientEtagHeader)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .some((t) => {
      if (t === '*') return true;
      return normalize(t) === serverNorm;
    });
}

function parsePort(value, fallback) {
  const n = Number(value);
  if (Number.isInteger(n) && n >= 1 && n <= 65535) return n;
  return fallback;
}

export const DEFAULT_PORT = parsePort(process.env.PORT, 8085);

/**
 * Request handler with comprehensive security hardening:
 * - HTTP method restriction (only GET and HEAD)
 * - Path traversal defense & encoding verification
 * - Dotfile / hidden file blocking
 * - Strict MIME-type mapping & sniffing protection
 * - Standard security headers on all responses
 */
export async function handleRequest(req, res) {
 try {
  const clientIp = req.socket?.remoteAddress || '';
  if (isRateLimited(clientIp)) {
    res.writeHead(429, {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
      'Retry-After': '10',
      ...SECURITY_HEADERS
    });
    res.end('429 Too Many Requests');
    return;
  }

  // 1. Method validation: only GET and HEAD allowed
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, {
      'Allow': 'GET, HEAD',
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS
    });
    res.end('405 Method Not Allowed');
    return;
  }

  // 2. Reject null bytes in raw URL + enforce max URL length (DoS guard)
  if (!req.url || req.url.includes('%00') || req.url.includes('\0')) {
    res.writeHead(400, {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS
    });
    res.end('400 Bad Request');
    return;
  }

  if (req.url.length > MAX_URL_LENGTH) {
    res.writeHead(414, {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS
    });
    res.end('414 URI Too Long');
    return;
  }

  const rawPath = req.url.split('?')[0].split('#')[0];

  // 3. URI Decoding with strict malformed URI handling
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    res.writeHead(400, {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS
    });
    res.end('400 Bad Request');
    return;
  }

  // 4. Reject null bytes after decoding
  if (decodedPath.includes('\0')) {
    res.writeHead(400, {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS
    });
    res.end('400 Bad Request');
    return;
  }

  // Normalize backslashes to forward slashes for uniform path checking
  decodedPath = decodedPath.replace(/\\/g, '/');

  // Check for any remaining suspicious URL-encoded traversal tokens
  if (/%(?:2e|2f|5c|00)/i.test(decodedPath)) {
    res.writeHead(400, {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS
    });
    res.end('400 Bad Request');
    return;
  }

  // Default root to /index.html
  if (decodedPath === '/' || decodedPath === '') {
    decodedPath = '/index.html';
  }

  // Canonicalize: trailing slash on non-root maps to same file via resolve;
  // reject to avoid duplicate URLs for one resource.
  if (decodedPath.length > 1 && decodedPath.endsWith('/')) {
    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS
    });
    res.end('404 Not Found');
    return;
  }

  // 5. Strict Path Traversal verification via path.resolve + symlink canonicalization
  const relativePath = decodedPath.replace(/^\/+/, '');
  const resolvedPath = path.resolve(PROJECT_ROOT, relativePath);

  const isWithinRoot =
    resolvedPath === PROJECT_ROOT ||
    resolvedPath.startsWith(PROJECT_ROOT + path.sep);

  if (!isWithinRoot) {
    res.writeHead(403, {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS
    });
    res.end('403 Forbidden: Path traversal attempt denied');
    return;
  }

  // Resolve symlinks: stat follows them, so verify the real path too
  try {
    const realPath = await fs.promises.realpath(resolvedPath);
    const realWithinRoot =
      realPath === PROJECT_ROOT || realPath.startsWith(PROJECT_ROOT + path.sep);
    if (!realWithinRoot) {
      res.writeHead(403, {
        'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
        ...SECURITY_HEADERS
      });
      res.end('403 Forbidden: Path traversal attempt denied');
      return;
    }
  } catch {
    // Non-existent path: let stat below return 404; ignore realpath errors here
  }

  // 6. Block hidden files / dotfiles (e.g. .*, .git, .env)
  const relFromRoot = path.relative(PROJECT_ROOT, resolvedPath);
  const segments = relFromRoot.split(path.sep);
  const isDotFile = segments.some(
    (segment) => segment.startsWith('.') && segment !== '.' && segment !== '..'
  );

  if (isDotFile) {
    res.writeHead(403, {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS
    });
    res.end('403 Forbidden: Access to hidden files is denied');
    return;
  }

  // 7. Verify file existence and verify it is not a directory
  let stats;
  try {
    stats = await fs.promises.stat(resolvedPath);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR' || err.code === 'ENAMETOOLONG') {
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
        ...SECURITY_HEADERS
      });
      res.end('404 Not Found');
      return;
    }
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      res.writeHead(403, {
        'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
        ...SECURITY_HEADERS
      });
      res.end('403 Forbidden');
      return;
    }
    res.writeHead(500, {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS
    });
    res.end('500 Internal Server Error');
    return;
  }

  if (stats.isDirectory()) {
    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS
    });
    res.end('404 Not Found');
    return;
  }

  // 7b. Public-path allowlist AFTER existence check so unknown paths stay 404
  // (preserves probing resistance) while existing sensitive files are 403.
  // Only index.html + src/dist/assets are servable.
  if (!isPublicPath(relFromRoot)) {
    res.writeHead(403, {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS
    });
    res.end('403 Forbidden: Access denied');
    return;
  }

  // 8. Strict MIME-type mapping & whitelist check
  const ext = path.extname(resolvedPath).toLowerCase();
  const contentType = MIME_TYPES[ext];
  if (!contentType) {
    res.writeHead(403, {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS
    });
    res.end('403 Forbidden: Disallowed file type');
    return;
  }

  // 9. In-Memory Hot Cache & ETag Computation
  const asset = await getCachedAsset(resolvedPath, stats);

  // Cache-Control: short revalidation for version-less static modules, revalidation for HTML
  // (filenames contain no content hash, so immutable 1y would serve stale code after deploy)
  const isHtml = ext === '.html';
  const cacheControl = isHtml
    ? 'no-cache'
    : 'public, max-age=3600, must-revalidate';

  // 10. Conditional ETag Validation (304 Not Modified, RFC 7232: *, weak + lists)
  const clientEtag = req.headers['if-none-match'];
  if (etagMatches(clientEtag, asset.etag)) {
    res.writeHead(304, {
      'ETag': asset.etag,
      'Cache-Control': cacheControl,
      'Vary': 'Accept-Encoding',
      ...SECURITY_HEADERS
    });
    res.end();
    return;
  }

  // 11. Content Compression (Gzip)
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const canGzip = Boolean(asset.gzipBuffer && acceptEncoding.includes('gzip'));
  const responsePayload = canGzip ? asset.gzipBuffer : asset.rawBuffer;

  const responseHeaders = {
    'Content-Type': contentType,
    'Content-Length': responsePayload.length,
    'ETag': asset.etag,
    'Cache-Control': cacheControl,
    'Vary': 'Accept-Encoding',
    ...SECURITY_HEADERS
  };

  if (canGzip) {
    responseHeaders['Content-Encoding'] = 'gzip';
  }

  // HEAD method: send headers and end without body
  if (req.method === 'HEAD') {
    res.writeHead(200, responseHeaders);
    res.end();
    return;
  }

  res.writeHead(200, responseHeaders);
  res.end(responsePayload);
  } catch (err) {
    try {
      if (!res.headersSent) {
        res.writeHead(500, {
          'Content-Type': 'text/plain; charset=UTF-8',
          'Cache-Control': 'no-store',
          ...SECURITY_HEADERS
        });
      }
      res.end('500 Internal Server Error');
    } catch {}
  }
}

export function createServer() {
  const s = http.createServer((req, res) => {
    handleRequest(req, res).catch(() => {
      try {
        if (!res.headersSent) {
          res.writeHead(500, {
            'Content-Type': 'text/plain; charset=UTF-8',
            'Cache-Control': 'no-store',
            ...SECURITY_HEADERS
          });
        }
        res.end('500 Internal Server Error');
      } catch {}
    });
  });
  // Short keep-alive + timeouts mitigate Slowloris / connection-hold DoS
  s.keepAliveTimeout = 5000;
  s.headersTimeout = 10000;
  try {
    if (typeof s.requestTimeout !== 'undefined') s.requestTimeout = 10000;
    if (typeof s.maxHeadersCount !== 'undefined') s.maxHeadersCount = 50;
    if (typeof s.maxRequestsPerSocket !== 'undefined') s.maxRequestsPerSocket = 1000;
  } catch {}
  return s;
}

export const server = createServer();

export const START_SERVER_MAX_RETRIES = 10;

export function startServer(port = DEFAULT_PORT, attempts = 0) {
  const targetPort = parsePort(port, DEFAULT_PORT);
  // Always boot a fresh server so a failed listen never leaves the exported
  // singleton in an errored state.
  const instance = createServer();
  instance.once('error', (err) => {
    try { instance.close(); } catch {}
    if (err && err.code === 'EADDRINUSE' && attempts < START_SERVER_MAX_RETRIES) {
      console.warn(`Port ${targetPort} in use, trying ${targetPort + 1}...`);
      startServer(targetPort + 1, attempts + 1);
    } else {
      console.error('Server error:', err);
    }
  });
  instance.listen(targetPort, () => {
    console.log(`\n🪐 Meridian Chronometer running at:`);
    console.log(`   http://localhost:${targetPort}/\n`);
  });
  return instance;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  startServer(DEFAULT_PORT);
}
