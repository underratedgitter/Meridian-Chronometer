import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Meridian Chronometer E2E Suite', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto('/');
    // Wait for DOM and initial canvas drawing
    await page.waitForSelector('#dialCanvas');
  });

  test('1. renders all horological canvases without console or runtime errors', async ({ page }) => {
    const canvases = ['#dialCanvas', '#mapCanvas', '#lunarCanvas', '#analemmaCanvas'];

    for (const selector of canvases) {
      const canvas = page.locator(selector);
      await expect(canvas).toBeVisible();

      // Check canvas dimensions are non-zero
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      expect(box.width).toBeGreaterThan(50);
      expect(box.height).toBeGreaterThan(50);
    }

    // Verify clock readouts are populated
    const utcReadout = page.locator('#utcReadout');
    await expect(utcReadout).toContainText('UTC');
    const solarReadout = page.locator('#solarReadout');
    await expect(solarReadout).toContainText('SOLAR');
    const siderealReadout = page.locator('#siderealReadout');
    await expect(siderealReadout).toContainText('LMST');

    // Assert zero console errors and zero uncaught runtime exceptions
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('2. clicks the time scrubber and verifies temporal updates dynamically', async ({ page }) => {
    const utcReadout = page.locator('#utcReadout');
    const initialText = await utcReadout.textContent();

    // Click step forward 1 hour button in time scrubber
    const btnStepFwd = page.locator('#btnStepFwdHour');
    await expect(btnStepFwd).toBeVisible();
    await btnStepFwd.click();

    // Status label should shift to SIMULATION MODE
    const statusLabel = page.locator('.temporal-status-badge .status-label');
    await expect(statusLabel).toHaveText('SIMULATION MODE');

    // Readout should update and differ from initial realtime UTC
    await page.waitForTimeout(300);
    const updatedText = await utcReadout.textContent();
    expect(updatedText).not.toBe(initialText);

    // Click SYNC REALTIME button to re-latch to realtime
    const btnSync = page.locator('#btnSyncRealtime');
    await btnSync.click();
    await expect(statusLabel).toHaveText('SYSTEM REALTIME UTC');
  });

  test('3. tests hotkey interactions: Spacebar pause/play, camera modes, and sky dome', async ({ page }) => {
    const btnPlayPause = page.locator('#btnPlayPause');

    // 1. Spacebar to toggle Pause
    await page.keyboard.press('Space');
    await expect(btnPlayPause).toHaveText('▶ PLAY');

    // Spacebar to toggle Play back
    await page.keyboard.press('Space');
    await expect(btnPlayPause).toHaveText('❚❚ PAUSE');

    // 2. Camera mode toggle hotkey ('g' or 'm')
    const btnProj2D = page.locator('#btnProj2D');
    const btnProj3D = page.locator('#btnProj3D');
    await expect(btnProj2D).toHaveClass(/active/);
    await expect(btnProj3D).not.toHaveClass(/active/);

    // Press 'g' to toggle to 3D Orthographic Globe
    await page.keyboard.press('KeyG');
    await expect(btnProj3D).toHaveClass(/active/);
    await expect(btnProj2D).not.toHaveClass(/active/);

    // Press 'g' again to return to 2D Flat map
    await page.keyboard.press('KeyG');
    await expect(btnProj2D).toHaveClass(/active/);
    await expect(btnProj3D).not.toHaveClass(/active/);

    // 3. Sky Dome modal hotkey ('d')
    const skyDomeModal = page.locator('#skyDomeModal');
    await expect(skyDomeModal).not.toHaveClass(/active/);

    // Press 'd' to open
    await page.keyboard.press('KeyD');
    await expect(skyDomeModal).toHaveClass(/active/);
    const skyDomeCanvas = page.locator('#skyDomeCanvas');
    await expect(skyDomeCanvas).toBeVisible();

    // Press Escape to dismiss
    await page.keyboard.press('Escape');
    await expect(skyDomeModal).not.toHaveClass(/active/);
  });

  test('4. toggles escapement audio and verifies Web Audio context state', async ({ page }) => {
    const audioBtn = page.locator('#audioToggleBtn');
    await expect(audioBtn).toHaveAttribute('aria-pressed', 'false');

    // Toggle audio ON
    await audioBtn.click();
    await expect(audioBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(audioBtn).toHaveClass(/active/);

    // Verify Web Audio state in browser context
    const audioState = await page.evaluate(() => {
      const app = window.__MERIDIAN_APP__;
      return {
        isEnabled: app.audioEscapement.isEnabled,
        hasContext: app.audioEscapement.ctx !== null,
        contextState: app.audioEscapement.ctx ? app.audioEscapement.ctx.state : null
      };
    });

    expect(audioState.isEnabled).toBe(true);
    expect(audioState.hasContext).toBe(true);
    expect(['running', 'suspended']).toContain(audioState.contextState);

    // Toggle audio OFF
    await audioBtn.click();
    await expect(audioBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(audioBtn).not.toHaveClass(/active/);

    const isEnabledOff = await page.evaluate(() => {
      return window.__MERIDIAN_APP__.audioEscapement.isEnabled;
    });
    expect(isEnabledOff).toBe(false);
  });

  test('5. takes screenshot of initial render and saves to e2e/screenshots/app.png', async ({ page }) => {
    const screenshotDir = path.resolve('e2e/screenshots');
    const screenshotPath = path.join(screenshotDir, 'app.png');

    // Ensure directory exists
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // Wait for initial render stabilization
    await page.waitForTimeout(500);

    // Capture full-page screenshot
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });

    // Verify screenshot file was generated and is non-empty
    expect(fs.existsSync(screenshotPath)).toBe(true);
    const stats = fs.statSync(screenshotPath);
    expect(stats.size).toBeGreaterThan(10000); // Greater than 10KB
  });
});
