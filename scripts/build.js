import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Purge stale atomic-write leftovers from crashed builds so they can never
// be copied into the GitHub Pages _site/ distribution (dist/ IS published).
try {
  for (const name of fs.readdirSync(path.join(rootDir, 'dist'))) {
    if (name.startsWith('.bundle.') && name.endsWith('.tmp')) {
      try { fs.rmSync(path.join(rootDir, 'dist', name)); } catch {}
    }
  }
} catch {}
try {
  for (const name of fs.readdirSync(rootDir)) {
    if (name.startsWith('.index.') && name.endsWith('.tmp')) {
      try { fs.rmSync(path.join(rootDir, name)); } catch {}
    }
  }
} catch {}

const filesInOrder = [
  'src/engine/sanitizer.js',
  'src/engine/astronomy.js',
  'src/engine/world-geometry.js',
  'src/engine/time-controller.js',
  'src/ui/audio-escapement.js',
  'src/ui/chronometer-dial.js',
  'src/ui/world-observatory.js',
  'src/ui/lunar-complication.js',
  'src/ui/telemetry-display.js',
  'src/ui/time-scrubber.js',
  'src/ui/sky-dome.js',
  'src/index.js'
];

let bundleContent = '/**\n * Meridian Chronometer — Standalone Production Bundle\n * Zero external dependencies. Works on both http:// and file:// protocols.\n */\n(() => {\n  "use strict";\n\n';

for (const relPath of filesInOrder) {
  // Fixed manifest: no traversal possible (relPath never contains .. or absolute)
  if (relPath.includes('..') || path.isAbsolute(relPath)) {
    throw new Error(`Refusing to read unexpected path: ${relPath}`);
  }
  const absPath = path.join(rootDir, relPath);
  let code = fs.readFileSync(absPath, 'utf8');

  // Strip import statements anchored at line start (avoids stripping
  // string literals containing e.g. "from 'x'")
  code = code.replace(/^[ \t]*import\s+[\s\S]*?from\s+['"][^'"]+['"];?[ \t]*$/gm, '');

  // Strip export keywords anchored at line start (avoids touching string literals)
  // e.g. "export function", "export class", "export const" -> "function", "class", "const"
  code = code.replace(/^[ \t]*export\s+(default\s+)?(class|function|const|let|var)\s+/gm, '$2 ');
  // e.g. "export { ... };"
  code = code.replace(/^[ \t]*export\s*\{[\s\S]*?\};?[ \t]*$/gm, '');

  bundleContent += `  // ==========================================\n  // Module: ${relPath}\n  // ==========================================\n`;
  bundleContent += code.split('\n').map(l => '  ' + l).join('\n') + '\n\n';
}

bundleContent += '})();\n';

const outDir = path.join(rootDir, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'bundle.js');
const tmpBundlePath = path.join(outDir, `.bundle.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`);
fs.writeFileSync(tmpBundlePath, bundleContent, { encoding: 'utf8', mode: 0o644, flag: 'wx' });
try {
  fs.renameSync(tmpBundlePath, outPath);
} catch {
  try { fs.rmSync(tmpBundlePath); } catch {}
  throw new Error(`Failed to publish bundle to ${outPath}`);
}
console.log(`Successfully built standalone bundle: ${outPath} (${(bundleContent.length / 1024).toFixed(1)} KB)`);

// Subresource Integrity: hash bundle and inject into index.html so
// same-origin tampering is detected even without HSTS on first load.
try {
  const hash = crypto.createHash('sha384').update(bundleContent, 'utf8').digest('base64');
  const integrity = `sha384-${hash}`;
  const indexPath = path.join(rootDir, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  if (html.includes('dist/bundle.js')) {
    const next = html.replace(
      /<script\s+src="dist\/bundle\.js"(\s+integrity="[^"]*")?(\s+crossorigin="[^"]*")?\s*><\/script>/,
      `<script src="dist/bundle.js" integrity="${integrity}"></script>`
    );
    if (next !== html) {
      const tmpIndexPath = path.join(rootDir, `.index.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`);
      fs.writeFileSync(tmpIndexPath, next, { encoding: 'utf8', flag: 'wx' });
      try {
        fs.renameSync(tmpIndexPath, indexPath);
      } catch {
        try { fs.rmSync(tmpIndexPath); } catch {}
        throw new Error(`Failed to publish SRI update to ${indexPath}`);
      }
      console.log(`Injected SRI integrity into index.html (${integrity.slice(0, 20)}…)`);
    }
  }
} catch (err) {
  console.warn('SRI injection skipped:', err.message);
}
