/**
 * Meridian Chronometer — Celestial Telemetry Display
 * Displays high-precision solar telemetry: solar noon, golden hour,
 * civil/nautical/astronomical dawn & dusk, and interactive Equation of Time analemma.
 */

import { getCelestialTelemetry, getSolarPosition } from '../engine/astronomy.js';
import { escapeHTML } from '../engine/sanitizer.js';

export class TelemetryDisplay {
  constructor(containerElement, analemmaCanvasElement) {
    this.container = containerElement;
    this.analemmaCanvas = analemmaCanvasElement;
    this.analemmaCtx = analemmaCanvasElement ? analemmaCanvasElement.getContext('2d') : null;
    this.analemmaData = this.precomputeYearlyAnalemma();
    this.lastRenderSec = -1;
    this.lastObserverName = '';
    this.width = 0;
    this.height = 0;
    this.dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    this.isLowPowerMode = false;
    this.resize();
  }

  setLowPowerMode(enabled) {
    this.isLowPowerMode = Boolean(enabled);
  }

  resize() {
    if (!this.analemmaCanvas) return;
    const rect = this.analemmaCanvas.getBoundingClientRect();
    this.width = rect.width || 280;
    this.height = rect.height || 180;
    this.dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    this.analemmaCanvas.width = Math.round(this.width * this.dpr);
    this.analemmaCanvas.height = Math.round(this.height * this.dpr);
  }

  /**
   * Precomputes the 365-day Equation of Time & Solar Declination analemma curve.
   */
  precomputeYearlyAnalemma() {
    const points = [];
    // Use year 2024 as reference cycle
    for (let day = 0; day < 365; day += 2) {
      const d = new Date(Date.UTC(2024, 0, 1 + day, 12, 0, 0));
      const { declinationDeg, equationOfTimeMinutes } = getSolarPosition(d);
      points.push({ day, declinationDeg, equationOfTimeMinutes });
    }
    return points;
  }

  formatTime(date) {
    if (!date) return '--:--:--';
    const h = String(date.getUTCHours()).padStart(2, '0');
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    const s = String(date.getUTCSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  formatEoT(minutes) {
    if (!Number.isFinite(Number(minutes))) return '+0m 00s';
    const sign = minutes >= 0 ? '+' : '−';
    const absMin = Math.abs(minutes);
    let m = Math.floor(absMin);
    let s = Math.round((absMin - m) * 60);
    if (s >= 60) {
      m += 1;
      s -= 60;
    }
    return `${sign}${m}m ${String(s).padStart(2, '0')}s`;
  }

  render(date, observer) {
    const solarPos = getSolarPosition(date);
    const currentSec = Math.floor(date.getTime() / 500); // 2Hz DOM update
    const observerChanged = this.lastObserverName !== observer.name;

    if (this.container && (currentSec !== this.lastRenderSec || observerChanged)) {
      this.lastRenderSec = currentSec;
      this.lastObserverName = observer.name;
      const telemetry = getCelestialTelemetry(date, observer.lat, observer.lon);
      const eotFormatted = this.formatEoT(telemetry.equationOfTimeMinutes);
      const eotAheadBehind = telemetry.equationOfTimeMinutes >= 0 ? 'FAST (Sun ahead)' : 'SLOW (Sun behind)';

      this.container.innerHTML = `
        <div class="telemetry-panel-grid">
          <!-- Solar Noon Card -->
          <div class="telemetry-card">
            <div class="telemetry-card-title">
              <span class="icon">☀️</span> SOLAR MERIDIAN TRANSIT
            </div>
            <div class="telemetry-card-main">
              <span class="telemetry-highlight gold-glow">${escapeHTML(this.formatTime(telemetry.solarNoonUTC))} <small>UTC</small></span>
            </div>
            <div class="telemetry-subdata">
              <div>Transit Altitude: <strong>${escapeHTML(telemetry.solarElevationAtNoonDeg.toFixed(1))}°</strong></div>
              <div>Declination: <strong>${solarPos.declinationDeg >= 0 ? '+' : ''}${escapeHTML(solarPos.declinationDeg.toFixed(2))}°</strong></div>
            </div>
          </div>

          <!-- Daylight & Solar Cycle -->
          <div class="telemetry-card">
            <div class="telemetry-card-title">
              <span class="icon">🌅</span> SOLAR CYCLE (HORIZON)
            </div>
            <div class="telemetry-row">
              <span class="field-label">Sunrise</span>
              <span class="field-value">${escapeHTML(this.formatTime(telemetry.sunriseUTC))} <small>UTC</small></span>
            </div>
            <div class="telemetry-row">
              <span class="field-label">Sunset</span>
              <span class="field-value">${escapeHTML(this.formatTime(telemetry.sunsetUTC))} <small>UTC</small></span>
            </div>
            <div class="telemetry-row">
              <span class="field-label">Day Length</span>
              <span class="field-value platinum-glow">${escapeHTML(telemetry.dayLengthHours.toFixed(2))} hrs</span>
            </div>
          </div>

          <!-- Twilight Phases -->
          <div class="telemetry-card">
            <div class="telemetry-card-title">
              <span class="icon">🌌</span> TWILIGHT GRADIENTS
            </div>
            <div class="telemetry-twilight-grid">
              <div class="twilight-phase">
                <span class="twilight-tag">CIVIL (0° to −6°)</span>
                <span class="twilight-val">${escapeHTML(this.formatTime(telemetry.civilDawnUTC))} / ${escapeHTML(this.formatTime(telemetry.civilDuskUTC))}</span>
              </div>
              <div class="twilight-phase">
                <span class="twilight-tag">NAUTICAL (−6° to −12°)</span>
                <span class="twilight-val">${escapeHTML(this.formatTime(telemetry.nauticalDawnUTC))} / ${escapeHTML(this.formatTime(telemetry.nauticalDuskUTC))}</span>
              </div>
              <div class="twilight-phase">
                <span class="twilight-tag">ASTRONOMICAL (−12° to −18°)</span>
                <span class="twilight-val">${escapeHTML(this.formatTime(telemetry.astronomicalDawnUTC))} / ${escapeHTML(this.formatTime(telemetry.astronomicalDuskUTC))}</span>
              </div>
            </div>
          </div>

          <!-- Equation of Time -->
          <div class="telemetry-card eot-card">
            <div class="telemetry-card-title">
              <span class="icon">⏱️</span> EQUATION OF TIME (EoT)
            </div>
            <div class="eot-main-row">
              <span class="eot-value gold-glow">${escapeHTML(eotFormatted)}</span>
              <span class="eot-status">${escapeHTML(eotAheadBehind)}</span>
            </div>
            <div class="eot-explanation">
              Difference between True Apparent Sundial Time and Uniform Mean Clock Time.
            </div>
          </div>
        </div>
      `;
    }

    if (this.analemmaCtx && this.analemmaCanvas) {
      this.drawAnalemma(date, solarPos);
    }
  }

  /**
   * Draws the celestial figure-8 Analemma curve and plots current day beacon.
   */
  drawAnalemma(date, currentSolarPos) {
    const canvas = this.analemmaCanvas;
    const ctx = this.analemmaCtx;
    const w = canvas.width;
    const h = canvas.height;
    const dpr = this.dpr;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Coordinate mapping:
    // X: Equation of Time from -16 to +18 minutes
    // Y: Solar Declination from +26° to -26°
    const mapX = (eot) => ((eot - (-16)) / (18 - (-16))) * (w - 24 * dpr) + 12 * dpr;
    const mapY = (dec) => ((26 - dec) / 52) * (h - 24 * dpr) + 12 * dpr;

    // Zero axes
    const zeroX = mapX(0);
    const zeroY = mapY(0);

    ctx.strokeStyle = 'rgba(216, 226, 236, 0.12)';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.moveTo(zeroX, 0);
    ctx.lineTo(zeroX, h);
    ctx.moveTo(0, zeroY);
    ctx.lineTo(w, zeroY);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = 'rgba(216, 226, 236, 0.4)';
    ctx.font = `${Math.round(7 * dpr)}px "Space Mono", monospace`;
    ctx.fillText('EoT 0m', zeroX + 3 * dpr, 10 * dpr);
    ctx.fillText('Equator 0°', 4 * dpr, zeroY - 3 * dpr);

    // 365-day Analemma path
    ctx.beginPath();
    for (let i = 0; i < this.analemmaData.length; i++) {
      const pt = this.analemmaData[i];
      const x = mapX(pt.equationOfTimeMinutes);
      const y = mapY(pt.declinationDeg);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(200, 170, 110, 0.45)';
    ctx.lineWidth = 1.4 * dpr;
    ctx.stroke();

    // Current date beacon on the analemma
    const curX = mapX(currentSolarPos.equationOfTimeMinutes);
    const curY = mapY(currentSolarPos.declinationDeg);

    // Glowing halo
    const halo = ctx.createRadialGradient(curX, curY, 1 * dpr, curX, curY, 8 * dpr);
    halo.addColorStop(0, '#ffffff');
    halo.addColorStop(0.4, '#c8aa6e');
    halo.addColorStop(1, 'rgba(200, 170, 110, 0)');

    ctx.beginPath();
    ctx.arc(curX, curY, 8 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = halo;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(curX, curY, 2.5 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }
}
