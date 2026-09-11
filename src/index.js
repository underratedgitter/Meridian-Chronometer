/**
 * Meridian Chronometer — Master Application Entry
 * Orchestrates 60fps astronomical engine loop, high-precision chronometer dial,
 * world solar observatory, lunar complication, celestial telemetry, and time scrubber.
 */

import { TimeController } from './engine/time-controller.js';
import {
  getGMST,
  getLMST,
  getLocalSolarTime,
  getSolarPosition,
  getJulianDate,
  getCelestialTelemetry
} from './engine/astronomy.js';
import { PRESET_OBSERVATORIES } from './engine/world-geometry.js';
import { ChronometerDial } from './ui/chronometer-dial.js';
import { WorldObservatory } from './ui/world-observatory.js';
import { LunarComplication } from './ui/lunar-complication.js';
import { TelemetryDisplay } from './ui/telemetry-display.js';
import { TimeScrubber } from './ui/time-scrubber.js';
import { EscapementAudio } from './ui/audio-escapement.js';
import { SkyDomeModal } from './ui/sky-dome.js';
import { escapeHTML } from './engine/sanitizer.js';

// Frame-busting: header frame-ancestors/X-Frame-Options protect http://,
// but <meta> cannot enforce them (spec) so file:// relies on this.
// External bundle (allowed by script-src 'self'), no inline script needed.
try {
  if (typeof window !== 'undefined' && window.top !== window.self) {
    try { document.documentElement.style.display = 'none'; } catch {}
    window.top.location.replace(window.self.location.href);
  }
} catch {
  try { document.documentElement.style.display = 'none'; } catch {}
}

class MeridianObservatoryApp {
  constructor() {
    this.timeController = new TimeController();
    this.audioEscapement = new EscapementAudio();
    this.lastFrameTime = performance.now();
    this.lastTickSecond = -1;

    // Performance telemetry & low-end device adaptive fallback (<30 FPS)
    this.frameCount = 0;
    this.fpsHistory = [];
    this.currentFps = 60;
    this.isLowPowerMode = false;

    this.initDOM();
    this.initInstruments();
    this.initAudio();
    this.bindEvents();
    this.startLoop();
  }

  initDOM() {
    this.dialCanvas = document.getElementById('dialCanvas');
    this.mapCanvas = document.getElementById('mapCanvas');
    this.lunarCanvas = document.getElementById('lunarCanvas');
    this.analemmaCanvas = document.getElementById('analemmaCanvas');

    this.utcReadout = document.getElementById('utcReadout');
    this.solarReadout = document.getElementById('solarReadout');
    this.siderealReadout = document.getElementById('siderealReadout');

    this.telemetryContainer = document.getElementById('telemetryContainer');
    this.lunarTelemetryContainer = document.getElementById('lunarTelemetryContainer');
    this.scrubberContainer = document.getElementById('scrubberContainer');
    this.observatorySelect = document.getElementById('observatorySelect');
    this.audioToggleBtn = document.getElementById('audioToggleBtn');

    // Horological finish selector & Fullscreen mode
    this.themeSelect = document.getElementById('themeSelect');
    this.btnFullscreen = document.getElementById('btnFullscreen');

    // Real-Time Astronomical Telemetry HUD Strip
    this.hudJulianDate = document.getElementById('hudJulianDate');
    this.hudGmst = document.getElementById('hudGmst');
    this.hudSolarDecl = document.getElementById('hudSolarDecl');
    this.hudEot = document.getElementById('hudEot');
    this.hudSolarNoon = document.getElementById('hudSolarNoon');
    this.hudSeason = document.getElementById('hudSeason');

    // 3D globe projection toggle & sky dome buttons
    this.btnProj2D = document.getElementById('btnProj2D');
    this.btnProj3D = document.getElementById('btnProj3D');
    this.btnOpenSkyDome = document.getElementById('btnOpenSkyDome');
    this.skyDomeModalEl = document.getElementById('skyDomeModal');
    this.skyDomeCanvas = document.getElementById('skyDomeCanvas');

    // Populate preset observatories in header dropdown
    if (this.observatorySelect) {
      this.observatorySelect.innerHTML = PRESET_OBSERVATORIES.map((obs) => `
        <option value="${escapeHTML(obs.id)}">${escapeHTML(obs.name)} (${escapeHTML(obs.country)})</option>
      `).join('');
    }
  }

  initInstruments() {
    this.chronometerDial = new ChronometerDial(this.dialCanvas);
    this.worldObservatory = new WorldObservatory(this.mapCanvas);
    this.lunarComplication = new LunarComplication(this.lunarCanvas, this.lunarTelemetryContainer);
    this.telemetryDisplay = new TelemetryDisplay(this.telemetryContainer, this.analemmaCanvas);
    this.timeScrubber = new TimeScrubber(this.scrubberContainer, this.timeController);

    // Initialize Local Zenith Sky Dome Modal (Planisphere)
    if (this.skyDomeModalEl && this.skyDomeCanvas) {
      this.skyDomeModal = new SkyDomeModal(this.skyDomeModalEl, this.skyDomeCanvas);
    }

    // Restore or initialize horological case finish (allowlisted to prevent CSS/attr injection)
    let savedTheme = 'titanium';
    try {
      const stored = localStorage.getItem('meridian_theme');
      if (stored === 'titanium' || stored === 'rosegold' || stored === 'platinum' || stored === 'monolith') {
        savedTheme = stored;
      }
    } catch {}
    this.setTheme(savedTheme);

    // Sync observer change from map click to select dropdown & open sky dome
    this.worldObservatory.onObserverChange = (obs) => {
      this.updateObserverDisplay(obs);
      if (this.skyDomeModal && this.skyDomeModal.isOpen) {
        this.skyDomeModal.render(this.timeController.getTime(), obs);
      }
    };

    // Open Sky Dome modal when clicking an observatory or location
    this.worldObservatory.onOpenSkyDome = (obs) => {
      if (this.skyDomeModal) {
        this.skyDomeModal.open(obs, this.timeController.getTime());
      }
    };
  }

  setTheme(themeName) {
    const allowed = new Set(['titanium', 'rosegold', 'platinum', 'monolith']);
    const safeTheme = allowed.has(themeName) ? themeName : 'titanium';
    this.currentTheme = safeTheme;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', safeTheme);
      if (this.themeSelect) {
        this.themeSelect.value = safeTheme;
      }
      try {
        localStorage.setItem('meridian_theme', safeTheme);
      } catch {}
    }
    if (this.chronometerDial && typeof this.chronometerDial.setTheme === 'function') {
      this.chronometerDial.setTheme(safeTheme);
    }
    if (this.lunarComplication && typeof this.lunarComplication.setTheme === 'function') {
      this.lunarComplication.setTheme(safeTheme);
    }
  }

  toggleFullscreen() {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      if (this.btnFullscreen) {
        this.btnFullscreen.classList.add('active');
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      if (this.btnFullscreen) {
        this.btnFullscreen.classList.remove('active');
      }
    }
  }

  initAudio() {
    if (this.audioToggleBtn) {
      this.audioToggleBtn.addEventListener('click', () => {
        const active = this.audioEscapement.toggle();
        this.audioToggleBtn.classList.toggle('active', active);
        this.audioToggleBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
  }

  bindEvents() {
    // Projection mode toggle (2D Flat vs 3D Orthographic Globe)
    if (this.btnProj2D && this.btnProj3D) {
      this.btnProj2D.addEventListener('click', () => {
        this.worldObservatory.setProjectionMode('equirectangular');
        this.btnProj2D.classList.add('active');
        this.btnProj3D.classList.remove('active');
      });

      this.btnProj3D.addEventListener('click', () => {
        this.worldObservatory.setProjectionMode('orthographic');
        this.btnProj3D.classList.add('active');
        this.btnProj2D.classList.remove('active');
      });
    }

    // Sky Dome planisphere open button
    if (this.btnOpenSkyDome) {
      this.btnOpenSkyDome.addEventListener('click', () => {
        if (this.skyDomeModal) {
          this.skyDomeModal.open(this.worldObservatory.observer, this.timeController.getTime());
        }
      });
    }

    // Window resize observer for all canvas instruments
    window.addEventListener('resize', () => {
      this.chronometerDial.resize();
      this.worldObservatory.resize();
      this.lunarComplication.resize();
      if (this.skyDomeModal) {
        this.skyDomeModal.resize();
      }
      this.renderFrame();
    });

    // Observer selection change
    if (this.observatorySelect) {
      this.observatorySelect.addEventListener('change', (e) => {
        const obs = PRESET_OBSERVATORIES.find((o) => o.id === e.target.value);
        if (obs) {
          this.worldObservatory.setObserver(obs.lat, obs.lon, obs.name);
          this.worldObservatory.globeCenter.lon = obs.lon;
          this.worldObservatory.globeCenter.lat = Math.max(-60, Math.min(60, obs.lat));
        }
      });
    }

    // Horological finish theme selection
    if (this.themeSelect) {
      this.themeSelect.addEventListener('change', (e) => {
        this.setTheme(e.target.value);
      });
    }

    // Fullscreen observatory mode toggle
    if (this.btnFullscreen) {
      this.btnFullscreen.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', () => {
        if (this.btnFullscreen) {
          this.btnFullscreen.classList.toggle('active', Boolean(document.fullscreenElement));
        }
      });
    }

    // Keyboard shortcuts & hotkey interactions:
    // 'g' or 'm': toggle 2D Flat vs 3D Globe camera projection mode
    // 'd': toggle Local Zenith Sky Dome modal
    // 'a': toggle mechanical escapement audio
    // 'f': toggle fullscreen mode
    window.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.code === 'KeyG' || e.code === 'KeyM') {
        e.preventDefault();
        const nextMode = this.worldObservatory.projectionMode === 'orthographic' ? 'equirectangular' : 'orthographic';
        this.worldObservatory.setProjectionMode(nextMode);
        if (this.btnProj2D && this.btnProj3D) {
          this.btnProj2D.classList.toggle('active', nextMode === 'equirectangular');
          this.btnProj3D.classList.toggle('active', nextMode === 'orthographic');
        }
      } else if (e.code === 'KeyD') {
        e.preventDefault();
        if (this.skyDomeModal) {
          if (this.skyDomeModal.isOpen) {
            this.skyDomeModal.close();
          } else {
            this.skyDomeModal.open(this.worldObservatory.observer, this.timeController.getTime());
          }
        }
      } else if (e.code === 'KeyA') {
        e.preventDefault();
        if (this.audioToggleBtn) {
          this.audioToggleBtn.click();
        }
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        this.toggleFullscreen();
      }
    });
  }

  updateObserverDisplay(obs) {
    const coordEl = document.getElementById('activeObserverCoords');
    if (coordEl) {
      const latFmt = `${Math.abs(obs.lat).toFixed(2)}° ${obs.lat >= 0 ? 'N' : 'S'}`;
      const lonFmt = `${Math.abs(obs.lon).toFixed(2)}° ${obs.lon >= 0 ? 'E' : 'W'}`;
      coordEl.textContent = `${obs.name} [${latFmt}, ${lonFmt}]`;
    }
    if (this.observatorySelect) {
      const match = PRESET_OBSERVATORIES.find(
        (o) => Math.abs(o.lat - obs.lat) < 0.1 && Math.abs(o.lon - obs.lon) < 0.1
      );
      if (match) {
        this.observatorySelect.value = match.id;
      }
    }
  }

  setLowPowerMode(enabled) {
    this.isLowPowerMode = Boolean(enabled);
    if (this.worldObservatory && typeof this.worldObservatory.setLowPowerMode === 'function') {
      this.worldObservatory.setLowPowerMode(this.isLowPowerMode);
    }
    if (this.chronometerDial && typeof this.chronometerDial.setLowPowerMode === 'function') {
      this.chronometerDial.setLowPowerMode(this.isLowPowerMode);
    }
    if (this.telemetryDisplay && typeof this.telemetryDisplay.setLowPowerMode === 'function') {
      this.telemetryDisplay.setLowPowerMode(this.isLowPowerMode);
    }

    const badge = document.getElementById('ecoModeBadge');
    if (this.isLowPowerMode) {
      if (badge) {
        badge.classList.add('active');
        badge.style.display = 'inline-block';
      }
      console.info(`[Meridian] Low-power adaptive mode engaged (${this.currentFps} FPS). Throttling decorative passes to preserve smooth interaction.`);
    } else if (badge) {
      badge.classList.remove('active');
      badge.style.display = 'none';
    }
  }

  startLoop() {
    const loop = (currentTimestamp) => {
      const deltaMs = Math.min(100, currentTimestamp - this.lastFrameTime);
      this.lastFrameTime = currentTimestamp;

      // Track instantaneous FPS and sliding window average
      if (deltaMs > 0) {
        const instantFps = 1000 / deltaMs;
        this.fpsHistory.push(instantFps);
        if (this.fpsHistory.length > 45) {
          this.fpsHistory.shift();
        }

        this.frameCount++;
        // Every 30 frames (0.5s at 60fps), evaluate device performance
        if (this.frameCount > 45 && this.frameCount % 30 === 0) {
          const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
          this.currentFps = Math.round(avgFps);

          // Low-end device fallback: engage if average FPS drops below 30
          if (!this.isLowPowerMode && avgFps < 30) {
            this.setLowPowerMode(true);
          } else if (this.isLowPowerMode && avgFps >= 48) {
            this.setLowPowerMode(false);
          }
        }
      }

      // Advance chronometer simulation
      this.timeController.tick(deltaMs);

      // Render astronomical frame
      this.renderFrame();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  formatHMS(decimalHours, includeFraction = false) {
    const safeHours = Number.isFinite(Number(decimalHours)) ? Number(decimalHours) : 0;
    const totalSec = safeHours * 3600;
    const h = Math.floor(totalSec / 3600) % 24;
    const m = Math.floor((totalSec % 3600) / 60);
    const s = Math.floor(totalSec % 60);
    const pad = (n) => String(n).padStart(2, '0');

    if (includeFraction) {
      const frac = Math.floor((totalSec % 1) * 10);
      return `${pad(h)}:${pad(m)}:${pad(s)}.${frac}`;
    }
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  renderFrame() {
    const date = this.timeController.getTime();
    const observer = this.worldObservatory.observer;

    // Astronomical computations
    const solarTime = getLocalSolarTime(date, observer.lon);
    const siderealHours = getLMST(date, observer.lon);

    // In low-power mode, throttle secondary decorative instruments (analemma & lunar)
    // to every 3rd frame (~20Hz) while maintaining smooth dial and globe updates
    const skipSecondaryPass = this.isLowPowerMode && (this.frameCount % 3 !== 0);

    // 1. Render Main Chronometer Dial
    this.chronometerDial.render({
      utcDate: date,
      solarApparentHours: solarTime.apparentHours,
      siderealHours
    });

    // 2. Render World Solar Observatory
    this.worldObservatory.render(date);

    // 3. Render Lunar Complication
    if (!skipSecondaryPass) {
      this.lunarComplication.render(date);
    }

    // 4. Render Celestial Telemetry & Analemma
    if (!skipSecondaryPass) {
      this.telemetryDisplay.render(date, observer);
    }

    // 5. Render Local Sky Dome if open
    if (this.skyDomeModal && this.skyDomeModal.isOpen) {
      this.skyDomeModal.render(date, observer);
    }

    // 6. Update Digital Readouts
    const utcDecimalHours =
      date.getUTCHours() +
      date.getUTCMinutes() / 60.0 +
      date.getUTCSeconds() / 3600.0 +
      date.getUTCMilliseconds() / 3600000.0;

    if (this.utcReadout) {
      this.utcReadout.innerHTML = `${escapeHTML(this.formatHMS(utcDecimalHours, true))} <small>UTC</small>`;
    }
    if (this.solarReadout) {
      this.solarReadout.innerHTML = `${escapeHTML(this.formatHMS(solarTime.apparentHours, false))} <small>SOLAR</small>`;
    }
    if (this.siderealReadout) {
      this.siderealReadout.innerHTML = `${escapeHTML(this.formatHMS(siderealHours, false))} <small>LMST</small>`;
    }

    // 7. Update Real-Time Astronomical Ephemeris HUD Strip
    if (this.hudJulianDate) {
      const jd = getJulianDate(date);
      this.hudJulianDate.textContent = jd.toFixed(4);
    }
    if (this.hudGmst) {
      const gmstHours = getGMST(date);
      this.hudGmst.textContent = this.formatHMS(gmstHours, false);
    }
    const solarPos = getSolarPosition(date);
    if (this.hudSolarDecl) {
      const sign = solarPos.declinationDeg >= 0 ? '+' : '';
      this.hudSolarDecl.textContent = `${sign}${solarPos.declinationDeg.toFixed(2)}°`;
    }
    if (this.hudEot) {
      const eot = solarPos.equationOfTimeMinutes;
      const sign = eot >= 0 ? '+' : '−';
      const absM = Math.abs(eot);
      let m = Math.floor(absM);
      let s = Math.round((absM - m) * 60);
      if (s >= 60) {
        m += 1;
        s -= 60;
      }
      this.hudEot.textContent = `${sign}${m}m ${String(s).padStart(2, '0')}s`;
    }
    if (this.hudSolarNoon) {
      const tel = getCelestialTelemetry(date, observer.lat, observer.lon);
      if (tel && tel.solarNoonUTC) {
        const h = String(tel.solarNoonUTC.getUTCHours()).padStart(2, '0');
        const m = String(tel.solarNoonUTC.getUTCMinutes()).padStart(2, '0');
        const s = String(tel.solarNoonUTC.getUTCSeconds()).padStart(2, '0');
        this.hudSolarNoon.textContent = `${h}:${m}:${s} UTC`;
      }
    }
    if (this.hudSeason) {
      // Calendar-based season using UTC month/day (leap-safe, no doy drift)
      const mo = date.getUTCMonth();
      const dy = date.getUTCDate();
      const md = mo * 100 + dy;
      let season = 'HIBERNAL (WINTER)';
      if (md >= 320 && md < 621) season = 'VERNAL (SPRING)';
      else if (md >= 621 && md < 922) season = 'ESTIVAL (SUMMER)';
      else if (md >= 922 && md < 1221) season = 'AUTUMNAL (FALL)';
      else season = 'HIBERNAL (WINTER)';
      this.hudSeason.textContent = season;
    }

    // 8. Mechanical escapement audio pulse on second boundary
    const curSec = date.getUTCSeconds();
    if (curSec !== this.lastTickSecond) {
      this.lastTickSecond = curSec;
      this.audioEscapement.tick(curSec % 2 === 0);
    }
  }
}

// Auto-boot observatory on DOM ready (refuses to run framed: the buster above
// already hid the document and attempted a bust; not booting avoids any
// framed rendering, audio, or animation work entirely).
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    try {
      if (window.top !== window.self) return;
    } catch {
      return;
    }
    window.__MERIDIAN_APP__ = new MeridianObservatoryApp();
  });
}
