import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PROJECT_ROOT = path.resolve(__dirname);

export const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self';",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
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

export const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 8085;

/**
 * Request handler with comprehensive security hardening:
 * - HTTP method restriction (only GET and HEAD)
 * - Path traversal defense & encoding verification
 * - Dotfile / hidden file blocking
 * - Strict MIME-type mapping & sniffing protection
 * - Standard security headers on all responses
 */
export function handleRequest(req, res) {
  // 1. Method validation: only GET and HEAD allowed
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, {
      'Allow': 'GET, HEAD',
      'Content-Type': 'text/plain; charset=UTF-8',
      ...SECURITY_HEADERS
    });
    res.end('405 Method Not Allowed');
    return;
  }

  // 2. Reject null bytes in raw URL
  if (!req.url || req.url.includes('%00') || req.url.includes('\0')) {
    res.writeHead(400, {
      'Content-Type': 'text/plain; charset=UTF-8',
      ...SECURITY_HEADERS
    });
    res.end('400 Bad Request');
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
      ...SECURITY_HEADERS
    });
    res.end('400 Bad Request');
    return;
  }

  // 4. Reject null bytes after decoding
  if (decodedPath.includes('\0')) {
    res.writeHead(400, {
      'Content-Type': 'text/plain; charset=UTF-8',
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
      ...SECURITY_HEADERS
    });
    res.end('400 Bad Request');
    return;
  }

  // Default root to /index.html
  if (decodedPath === '/' || decodedPath === '') {
    decodedPath = '/index.html';
  }

  // 5. Strict Path Traversal verification via path.resolve
  const relativePath = decodedPath.replace(/^\/+/, '');
  const resolvedPath = path.resolve(PROJECT_ROOT, relativePath);

  const isWithinRoot =
    resolvedPath === PROJECT_ROOT ||
    resolvedPath.startsWith(PROJECT_ROOT + path.sep);

  if (!isWithinRoot) {
    res.writeHead(403, {
      'Content-Type': 'text/plain; charset=UTF-8',
      ...SECURITY_HEADERS
    });
    res.end('403 Forbidden: Path traversal attempt denied');
    return;
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
      ...SECURITY_HEADERS
    });
    res.end('403 Forbidden: Access to hidden files is denied');
    return;
  }

  // 7. Verify file existence and verify it is not a directory
  let stats;
  try {
    stats = fs.statSync(resolvedPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=UTF-8',
        ...SECURITY_HEADERS
      });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(500, {
      'Content-Type': 'text/plain; charset=UTF-8',
      ...SECURITY_HEADERS
    });
    res.end('500 Internal Server Error');
    return;
  }

  if (stats.isDirectory()) {
    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=UTF-8',
      ...SECURITY_HEADERS
    });
    res.end('404 Not Found');
    return;
  }

  // 8. Strict MIME-type mapping & whitelist check
  const ext = path.extname(resolvedPath).toLowerCase();
  const contentType = MIME_TYPES[ext];
  if (!contentType) {
    res.writeHead(403, {
      'Content-Type': 'text/plain; charset=UTF-8',
      ...SECURITY_HEADERS
    });
    res.end('403 Forbidden: Disallowed file type');
    return;
  }

  // 9. Response Headers
  const responseHeaders = {
    'Content-Type': contentType,
    'Content-Length': stats.size,
    'Cache-Control': 'no-cache',
    ...SECURITY_HEADERS
  };

  // HEAD method: send headers and end without body
  if (req.method === 'HEAD') {
    res.writeHead(200, responseHeaders);
    res.end();
    return;
  }

  res.writeHead(200, responseHeaders);
  const stream = fs.createReadStream(resolvedPath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(500, {
        'Content-Type': 'text/plain; charset=UTF-8',
        ...SECURITY_HEADERS
      });
    }
    res.end();
  });
  stream.pipe(res);
}

export function createServer() {
  return http.createServer(handleRequest);
}

export const server = createServer();

export function startServer(port = DEFAULT_PORT) {
  server.listen(port, () => {
    console.log(`\n🪐 Meridian Chronometer running at:`);
    console.log(`   http://localhost:${port}/\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  return server;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  startServer(DEFAULT_PORT);
}
