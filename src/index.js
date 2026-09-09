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
  getSolarPosition
} from './engine/astronomy.js';
import { PRESET_OBSERVATORIES } from './engine/world-geometry.js';
import { ChronometerDial } from './ui/chronometer-dial.js';
import { WorldObservatory } from './ui/world-observatory.js';
import { LunarComplication } from './ui/lunar-complication.js';
import { TelemetryDisplay } from './ui/telemetry-display.js';
import { TimeScrubber } from './ui/time-scrubber.js';
import { EscapementAudio } from './ui/audio-escapement.js';
import { SkyDomeModal } from './ui/sky-dome.js';

class MeridianObservatoryApp {
  constructor() {
    this.timeController = new TimeController();
    this.audioEscapement = new EscapementAudio();
    this.lastFrameTime = performance.now();
    this.lastTickSecond = -1;

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

    // 3D globe projection toggle & sky dome buttons
    this.btnProj2D = document.getElementById('btnProj2D');
    this.btnProj3D = document.getElementById('btnProj3D');
    this.btnOpenSkyDome = document.getElementById('btnOpenSkyDome');
    this.skyDomeModalEl = document.getElementById('skyDomeModal');
    this.skyDomeCanvas = document.getElementById('skyDomeCanvas');

    // Populate preset observatories in header dropdown
    if (this.observatorySelect) {
      this.observatorySelect.innerHTML = PRESET_OBSERVATORIES.map((obs) => `
        <option value="${obs.id}">${obs.name} (${obs.country})</option>
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

  startLoop() {
    const loop = (currentTimestamp) => {
      const deltaMs = Math.min(100, currentTimestamp - this.lastFrameTime);
      this.lastFrameTime = currentTimestamp;

      // Advance chronometer simulation
      this.timeController.tick(deltaMs);

      // Render astronomical frame
      this.renderFrame();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  formatHMS(decimalHours, includeFraction = false) {
    const totalSec = decimalHours * 3600;
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

    // 1. Render Main Chronometer Dial
    this.chronometerDial.render({
      utcDate: date,
      solarApparentHours: solarTime.apparentHours,
      siderealHours
    });

    // 2. Render World Solar Observatory
    this.worldObservatory.render(date);

    // 3. Render Lunar Complication
    this.lunarComplication.render(date);

    // 4. Render Celestial Telemetry & Analemma
    this.telemetryDisplay.render(date, observer);

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
      this.utcReadout.innerHTML = `${this.formatHMS(utcDecimalHours, true)} <small>UTC</small>`;
    }
    if (this.solarReadout) {
      this.solarReadout.innerHTML = `${this.formatHMS(solarTime.apparentHours, false)} <small>SOLAR</small>`;
    }
    if (this.siderealReadout) {
      this.siderealReadout.innerHTML = `${this.formatHMS(siderealHours, false)} <small>LMST</small>`;
    }

    // 6. Mechanical escapement audio pulse on second boundary
    const curSec = date.getUTCSeconds();
    if (curSec !== this.lastTickSecond) {
      this.lastTickSecond = curSec;
      this.audioEscapement.tick(curSec % 2 === 0);
    }
  }
}

// Auto-boot observatory on DOM ready
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.__MERIDIAN_APP__ = new MeridianObservatoryApp();
  });
}
