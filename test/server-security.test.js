import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  createServer,
  PROJECT_ROOT,
  SECURITY_HEADERS,
  MIME_TYPES
} from '../server.js';
import { escapeHTML, safeMerge } from '../src/engine/sanitizer.js';

describe('Server Security & Defensive Hardening', () => {
  let server;
  let port;
  let baseUrl;

  before(async () => {
    server = createServer();
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  /**
   * Raw HTTP request helper using node:http to preserve verbatim paths and headers
   * without client-side normalization.
   */
  function makeRequest({ path = '/', method = 'GET', headers = {} }) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          path,
          method,
          headers
        },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: Buffer.concat(chunks).toString('utf8')
            });
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  describe('Path Traversal & Directory Climbing Protection', () => {
    it('blocks traversal attempting to climb out to package.json in parent directory (/../package.json)', async () => {
      const res = await makeRequest({ path: '/../package.json' });
      assert.ok(
        res.statusCode === 400 || res.statusCode === 403 || res.statusCode === 404,
        `Expected 400/403/404, got ${res.statusCode}`
      );
      assert.doesNotMatch(res.body, /"name":/);
    });

    it('blocks URL-encoded traversal (/%2e%2e/server.js)', async () => {
      const res = await makeRequest({ path: '/%2e%2e/server.js' });
      assert.ok(
        res.statusCode === 400 || res.statusCode === 403 || res.statusCode === 404,
        `Expected 400/403/404, got ${res.statusCode}`
      );
      // Ensure server.js from parent is never leaked
      assert.doesNotMatch(res.body, /import http from/);
    });

    it('blocks nested climbing traversal (/foo/../../../etc/passwd)', async () => {
      const res = await makeRequest({ path: '/foo/../../../etc/passwd' });
      assert.ok(
        res.statusCode === 400 || res.statusCode === 403 || res.statusCode === 404,
        `Expected 400/403/404, got ${res.statusCode}`
      );
      assert.doesNotMatch(res.body, /root:x:/);
    });

    it('blocks null byte URL injection (/index.html%00)', async () => {
      const res = await makeRequest({ path: '/index.html%00' });
      assert.equal(res.statusCode, 400, 'Expected 400 Bad Request for null byte');
    });

    it('blocks backslash directory traversal attempts (/..\\..\\etc\\passwd)', async () => {
      const res = await makeRequest({ path: '/..\\..\\etc\\passwd' });
      assert.ok(
        res.statusCode === 400 || res.statusCode === 403 || res.statusCode === 404,
        `Expected 400/403/404, got ${res.statusCode}`
      );
      assert.doesNotMatch(res.body, /root:x:/);
    });

    it('handles malformed URI components gracefully with 400 Bad Request', async () => {
      const res = await makeRequest({ path: '/%E0%A4%A' });
      assert.equal(res.statusCode, 400, 'Expected 400 Bad Request on malformed URI');
    });
  });

  describe('HTTP Method Restriction & HEAD Support', () => {
    it('allows GET requests and serves index.html', async () => {
      const res = await makeRequest({ path: '/', method: 'GET' });
      assert.equal(res.statusCode, 200);
      assert.match(res.body, /<!DOCTYPE html>/i);
      assert.match(res.body, /Meridian Chronometer/i);
    });

    it('allows HEAD requests: returns 200 with headers but empty body', async () => {
      const res = await makeRequest({ path: '/', method: 'HEAD' });
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['content-type'], 'text/html; charset=UTF-8');
      assert.ok(res.headers['content-length'], 'Content-Length header must be set');
      assert.equal(res.body, '', 'HEAD response must have an empty body');
    });

    it('rejects POST method with 405 Method Not Allowed and Allow header', async () => {
      const res = await makeRequest({ path: '/index.html', method: 'POST' });
      assert.equal(res.statusCode, 405);
      assert.equal(res.headers['allow'], 'GET, HEAD');
      assert.match(res.body, /405 Method Not Allowed/);
    });

    it('rejects DELETE method with 405 Method Not Allowed and Allow header', async () => {
      const res = await makeRequest({ path: '/index.html', method: 'DELETE' });
      assert.equal(res.statusCode, 405);
      assert.equal(res.headers['allow'], 'GET, HEAD');
      assert.match(res.body, /405 Method Not Allowed/);
    });

    it('rejects PUT, PATCH, and OPTIONS methods with 405', async () => {
      for (const method of ['PUT', 'PATCH', 'OPTIONS']) {
        const res = await makeRequest({ path: '/index.html', method });
        assert.equal(res.statusCode, 405, `Method ${method} should return 405`);
        assert.equal(res.headers['allow'], 'GET, HEAD');
      }
    });
  });

  describe('Dotfile & Hidden File Blocking', () => {
    it('blocks access to /.git repository folder', async () => {
      const res = await makeRequest({ path: '/.git' });
      assert.equal(res.statusCode, 403, 'Expected 403 Forbidden for /.git');
    });

    it('blocks access to /.git/config', async () => {
      const res = await makeRequest({ path: '/.git/config' });
      assert.equal(res.statusCode, 403, 'Expected 403 Forbidden for /.git/config');
      assert.doesNotMatch(res.body, /\[core\]/);
    });

    it('blocks access to /.env', async () => {
      const res = await makeRequest({ path: '/.env' });
      assert.equal(res.statusCode, 403, 'Expected 403 Forbidden for /.env');
    });

    it('blocks access to /.gitignore', async () => {
      const res = await makeRequest({ path: '/.gitignore' });
      assert.equal(res.statusCode, 403, 'Expected 403 Forbidden for /.gitignore');
    });
  });

  describe('Security Response Headers', () => {
    it('sends complete security headers on 200 OK responses', async () => {
      const res = await makeRequest({ path: '/' });
      assert.equal(res.statusCode, 200);

      // Content-Security-Policy
      const csp = res.headers['content-security-policy'];
      assert.ok(csp, 'CSP header missing');
      assert.match(csp, /default-src 'self'/);
      assert.match(csp, /script-src 'self'/);
      assert.match(csp, /style-src 'self' 'unsafe-inline' https:\/\/fonts\.googleapis\.com/);
      assert.match(csp, /font-src 'self' https:\/\/fonts\.gstatic\.com/);
      assert.match(csp, /img-src 'self' data:/);
      assert.match(csp, /connect-src 'self'/);

      // Other security headers
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      assert.equal(res.headers['x-frame-options'], 'DENY');
      assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
      assert.equal(res.headers['permissions-policy'], 'geolocation=(), microphone=(), camera=()');
    });

    it('sends security headers on error responses (400, 403, 404, 405)', async () => {
      const r404 = await makeRequest({ path: '/non-existent-file-xyz.html' });
      assert.equal(r404.statusCode, 404);
      assert.equal(r404.headers['x-content-type-options'], 'nosniff');
      assert.equal(r404.headers['x-frame-options'], 'DENY');

      const r405 = await makeRequest({ path: '/index.html', method: 'POST' });
      assert.equal(r405.statusCode, 405);
      assert.equal(r405.headers['x-content-type-options'], 'nosniff');
      assert.equal(r405.headers['x-frame-options'], 'DENY');
    });
  });

  describe('MIME-Type & Whitelist Protection', () => {
    it('serves valid CSS with strict Content-Type and charset', async () => {
      const res = await makeRequest({ path: '/src/styles/chronometer.css' });
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['content-type'], 'text/css; charset=UTF-8');
    });

    it('serves valid JS with strict Content-Type and charset', async () => {
      const res = await makeRequest({ path: '/src/index.js' });
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['content-type'], 'text/javascript; charset=UTF-8');
    });

    it('refuses to serve non-whitelisted file extensions (e.g. .md)', async () => {
      const res = await makeRequest({ path: '/README.md' });
      assert.equal(res.statusCode, 403, 'Disallowed extension should return 403');
    });
  });
});

describe('Client-Side Sanitization & Prototype Pollution Immunity', () => {
  describe('escapeHTML utility', () => {
    it('escapes standard HTML special characters', () => {
      assert.equal(
        escapeHTML('<script>alert("XSS")</script>'),
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
      );
      assert.equal(
        escapeHTML("Rock 'n' Roll & <Jazz>"),
        'Rock &#39;n&#39; Roll &amp; &lt;Jazz&gt;'
      );
    });

    it('escapes event handlers and attribute injection payloads', () => {
      assert.equal(
        escapeHTML('"><img src=x onerror=alert(1)>'),
        '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'
      );
      assert.equal(
        escapeHTML("' onfocus='alert(1)"),
        '&#39; onfocus=&#39;alert(1)'
      );
    });

    it('safely handles non-string and null/undefined values', () => {
      assert.equal(escapeHTML(null), '');
      assert.equal(escapeHTML(undefined), '');
      assert.equal(escapeHTML(123.45), '123.45');
      assert.equal(escapeHTML(0), '0');
      assert.equal(escapeHTML(false), 'false');
    });
  });

  describe('safeMerge prototype pollution prevention', () => {
    it('prevents prototype pollution via __proto__', () => {
      const maliciousPayload = JSON.parse('{"__proto__": {"polluted": "yes"}}');
      const target = safeMerge({ safe: true }, maliciousPayload);

      assert.equal(target.safe, true);
      assert.equal(target.polluted, undefined);
      assert.equal(({}).polluted, undefined, 'Object.prototype must not be polluted');
    });

    it('prevents constructor and prototype pollution', () => {
      const attack = {
        constructor: { prototype: { hacked: true } },
        prototype: { hacked: true },
        regularKey: 'clean'
      };
      const result = safeMerge({ existing: 1 }, attack);
      assert.equal(result.regularKey, 'clean');
      assert.equal(result.constructor, Object);
      assert.equal(({}).hacked, undefined, 'Object prototype must remain unpolluted');
    });

    it('correctly merges legitimate options over defaults', () => {
      const defaults = { color: 'gold', radius: 10, visible: true };
      const overrides = { radius: 25, title: 'custom' };
      const merged = safeMerge(defaults, overrides);

      assert.deepEqual(merged, {
        color: 'gold',
        radius: 25,
        visible: true,
        title: 'custom'
      });
    });
  });
});
