import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

async function main() {
  const assetsDir = path.resolve('assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8085');
  await page.waitForTimeout(2500);

  console.log('📸 Capturing 1: Full Master Observatory Hero...');
  await page.screenshot({ path: path.join(assetsDir, 'meridian-hero.png') });

  console.log('📸 Capturing 2: Main Chronometer Dial...');
  const dialEl = page.locator('.chronometer-module');
  if (await dialEl.count() > 0) {
    await dialEl.first().screenshot({ path: path.join(assetsDir, 'preview-dial.png') });
  }

  console.log('📸 Capturing 3: World Solar Observatory Map...');
  const mapEl = page.locator('.observatory-module');
  if (await mapEl.count() > 0) {
    await mapEl.first().screenshot({ path: path.join(assetsDir, 'preview-world-map.png') });
  }

  console.log('📸 Capturing 4: Lunar Complication...');
  const moonEl = page.locator('.lunar-module');
  if (await moonEl.count() > 0) {
    await moonEl.first().screenshot({ path: path.join(assetsDir, 'preview-lunar.png') });
  }

  console.log('📸 Capturing 5: Telemetry Deck & Analemma...');
  const telemEl = page.locator('.telemetry-row-deck');
  if (await telemEl.count() > 0) {
    await telemEl.first().screenshot({ path: path.join(assetsDir, 'preview-telemetry.png') });
  }

  console.log('📸 Capturing 6: Master Temporal Scrubber Console...');
  const scrubEl = page.locator('.scrubber-module');
  if (await scrubEl.count() > 0) {
    await scrubEl.first().screenshot({ path: path.join(assetsDir, 'preview-scrubber.png') });
  }

  await browser.close();
  console.log('✅ All high-resolution screenshots generated in assets/!');
}

main().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
