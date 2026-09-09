import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const filesInOrder = [
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
  const absPath = path.join(rootDir, relPath);
  let code = fs.readFileSync(absPath, 'utf8');

  // Strip import statements
  code = code.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');

  // Strip export keywords
  // e.g. "export function", "export class", "export const" -> "function", "class", "const"
  code = code.replace(/export\s+(default\s+)?(class|function|const|let|var)\s+/g, '$2 ');
  // e.g. "export { ... };"
  code = code.replace(/export\s*\{[\s\S]*?\};?/g, '');

  bundleContent += `  // ==========================================\n  // Module: ${relPath}\n  // ==========================================\n`;
  bundleContent += code.split('\n').map(l => '  ' + l).join('\n') + '\n\n';
}

bundleContent += '})();\n';

const outPath = path.join(rootDir, 'dist/bundle.js');
fs.writeFileSync(outPath, bundleContent, 'utf8');
console.log(`Successfully built standalone bundle: ${outPath} (${(bundleContent.length / 1024).toFixed(1)} KB)`);
