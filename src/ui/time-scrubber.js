/**
 * Meridian Chronometer — Interactive Time Scrubber
 * Observatory temporal control deck with timeline scrubbing,
 * speed multiplier switches, bi-directional playback, and astronomical presets.
 */

import { PRESET_EPOCHS } from '../engine/world-geometry.js';

export class TimeScrubber {
  constructor(containerElement, timeController) {
    this.container = containerElement;
    this.controller = timeController;
    this.isScrubbing = false;

    this.render();
    this.attachEventListeners();
  }

  render() {
    this.container.innerHTML = `
      <div class="scrubber-deck">
        <!-- Control Strip Top: Status, Epoch Jump, and Realtime Latch -->
        <div class="scrubber-top-strip">
          <div class="temporal-status-badge">
            <span class="status-pip ${this.controller.isRealtime ? 'pip-realtime' : 'pip-simulated'}"></span>
            <span class="status-label">${this.controller.isRealtime ? 'SYSTEM REALTIME UTC' : 'SIMULATION MODE'}</span>
            <span class="speed-readout">${this.controller.speedMultiplier}x ${this.controller.direction < 0 ? 'REV' : 'FWD'}</span>
          </div>

          <!-- Astronomical Preset Dropdown -->
          <div class="preset-selector-wrap">
            <label for="epochPreset">CELESTIAL EPOCH:</label>
            <select id="epochPreset" class="meridian-select">
              ${PRESET_EPOCHS.map((p, idx) => `
                <option value="${p.iso || 'realtime'}" ${idx === 0 ? 'selected' : ''}>${p.label}</option>
              `).join('')}
            </select>
          </div>

          <!-- Date-Time Input -->
          <div class="direct-date-input-wrap">
            <input type="datetime-local" id="directDateTime" class="meridian-date-input" step="1" />
          </div>

          <!-- Realtime Sync Button -->
          <button id="btnSyncRealtime" class="meridian-btn btn-latch ${this.controller.isRealtime ? 'active' : ''}">
            <span class="latch-led"></span> SYNC REALTIME
          </button>
        </div>

        <!-- Timeline Slider -->
        <div class="scrubber-slider-wrap">
          <span class="slider-marker left-marker">−12h</span>
          <input type="range" id="timelineSlider" class="meridian-slider" min="-86400" max="86400" value="0" step="60" />
          <span class="slider-marker right-marker">+12h</span>
        </div>

        <!-- Control Strip Bottom: Playback buttons & Multipliers -->
        <div class="scrubber-bottom-strip">
          <div class="playback-btn-group">
            <button id="btnStepBackDay" class="meridian-btn" title="Step Back 1 Day">−1d</button>
            <button id="btnStepBackHour" class="meridian-btn" title="Step Back 1 Hour">−1h</button>
            <button id="btnReverse" class="meridian-btn ${this.controller.direction === -1 ? 'active' : ''}" title="Reverse Direction">◀◀</button>
            <button id="btnPlayPause" class="meridian-btn btn-primary" title="Play / Pause (Space)">
              ${this.controller.isPlaying ? '❚❚ PAUSE' : '▶ PLAY'}
            </button>
            <button id="btnForward" class="meridian-btn ${this.controller.direction === 1 ? 'active' : ''}" title="Forward Direction">▶▶</button>
            <button id="btnStepFwdHour" class="meridian-btn" title="Step Forward 1 Hour">+1h</button>
            <button id="btnStepFwdDay" class="meridian-btn" title="Step Forward 1 Day">+1d</button>
          </div>

          <!-- Speed Multipliers -->
          <div class="speed-multiplier-group">
            <span class="multiplier-label">TEMPORAL RATE:</span>
            <button class="speed-btn ${this.controller.speedMultiplier === 1 ? 'active' : ''}" data-speed="1">1x</button>
            <button class="speed-btn ${this.controller.speedMultiplier === 60 ? 'active' : ''}" data-speed="60">60x <small>(1m/s)</small></button>
            <button class="speed-btn ${this.controller.speedMultiplier === 3600 ? 'active' : ''}" data-speed="3600">3,600x <small>(1h/s)</small></button>
            <button class="speed-btn ${this.controller.speedMultiplier === 86400 ? 'active' : ''}" data-speed="86400">86,400x <small>(1d/s)</small></button>
          </div>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    const c = this.container;

    // Realtime Sync
    const btnSync = c.querySelector('#btnSyncRealtime');
    btnSync.addEventListener('click', () => {
      this.controller.syncRealtime();
      this.updateUI();
    });

    // Preset selector
    const selectPreset = c.querySelector('#epochPreset');
    selectPreset.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'realtime') {
        this.controller.syncRealtime();
      } else {
        this.controller.setTime(new Date(val));
      }
      this.updateUI();
    });

    // Direct Date Input
    const dateInput = c.querySelector('#directDateTime');
    dateInput.addEventListener('change', (e) => {
      if (e.target.value) {
        this.controller.setTime(new Date(e.target.value));
        this.updateUI();
      }
    });

    // Timeline Slider
    const slider = c.querySelector('#timelineSlider');
    let scrubAnchorTime = Date.now();

    slider.addEventListener('mousedown', () => {
      this.isScrubbing = true;
      scrubAnchorTime = this.controller.getTime().getTime();
    });

    slider.addEventListener('input', (e) => {
      const deltaSec = Number(e.target.value);
      this.controller.setTime(new Date(scrubAnchorTime + deltaSec * 1000));
    });

    slider.addEventListener('change', () => {
      this.isScrubbing = false;
      slider.value = '0';
      this.updateUI();
    });

    // Play / Pause
    const btnPlayPause = c.querySelector('#btnPlayPause');
    btnPlayPause.addEventListener('click', () => {
      this.controller.togglePlay();
      this.updateUI();
    });

    // Reverse / Forward
    const btnReverse = c.querySelector('#btnReverse');
    btnReverse.addEventListener('click', () => {
      this.controller.setDirection(-1);
      this.updateUI();
    });

    const btnForward = c.querySelector('#btnForward');
    btnForward.addEventListener('click', () => {
      this.controller.setDirection(1);
      this.updateUI();
    });

    // Step Buttons
    c.querySelector('#btnStepBackHour').addEventListener('click', () => {
      this.controller.step(-3600);
      this.updateUI();
    });
    c.querySelector('#btnStepFwdHour').addEventListener('click', () => {
      this.controller.step(3600);
      this.updateUI();
    });
    c.querySelector('#btnStepBackDay').addEventListener('click', () => {
      this.controller.step(-86400);
      this.updateUI();
    });
    c.querySelector('#btnStepFwdDay').addEventListener('click', () => {
      this.controller.step(86400);
      this.updateUI();
    });

    // Speed buttons
    const speedButtons = c.querySelectorAll('.speed-btn');
    speedButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const speed = Number(btn.getAttribute('data-speed'));
        this.controller.setSpeed(speed);
        this.updateUI();
      });
    });

    // Global spacebar listener for play/pause
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
        e.preventDefault();
        this.controller.togglePlay();
        this.updateUI();
      }
    });
  }

  updateUI() {
    const c = this.container;
    const isRt = this.controller.isRealtime;
    const isPlaying = this.controller.isPlaying;

    // Status pip
    const pip = c.querySelector('.status-pip');
    const label = c.querySelector('.status-label');
    const speedText = c.querySelector('.speed-readout');

    if (pip && label && speedText) {
      pip.className = `status-pip ${isRt ? 'pip-realtime' : 'pip-simulated'}`;
      label.textContent = isRt ? 'SYSTEM REALTIME UTC' : 'SIMULATION MODE';
      speedText.textContent = `${this.controller.speedMultiplier}x ${this.controller.direction < 0 ? 'REV' : 'FWD'}`;
    }

    // Latch button
    const btnSync = c.querySelector('#btnSyncRealtime');
    if (btnSync) {
      btnSync.className = `meridian-btn btn-latch ${isRt ? 'active' : ''}`;
    }

    // Play/Pause button
    const btnPlayPause = c.querySelector('#btnPlayPause');
    if (btnPlayPause) {
      btnPlayPause.innerHTML = isPlaying ? '❚❚ PAUSE' : '▶ PLAY';
    }

    // Direction buttons
    const btnRev = c.querySelector('#btnReverse');
    const btnFwd = c.querySelector('#btnForward');
    if (btnRev && btnFwd) {
      btnRev.classList.toggle('active', this.controller.direction === -1);
      btnFwd.classList.toggle('active', this.controller.direction === 1);
    }

    // Speed buttons
    const speedButtons = c.querySelectorAll('.speed-btn');
    speedButtons.forEach((b) => {
      const sp = Number(b.getAttribute('data-speed'));
      b.classList.toggle('active', this.controller.speedMultiplier === sp);
    });

    // Update datetime picker display value
    const dateInput = c.querySelector('#directDateTime');
    if (dateInput && !this.isScrubbing) {
      const d = this.controller.getTime();
      const pad = (n) => String(n).padStart(2, '0');
      const isoLocal = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
      dateInput.value = isoLocal;
    }
  }
}
