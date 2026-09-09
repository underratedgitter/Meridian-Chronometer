/**
 * Meridian Chronometer — Celestial Telemetry Display
 * Displays high-precision solar telemetry: solar noon, golden hour,
 * civil/nautical/astronomical dawn & dusk, and interactive Equation of Time analemma.
 */

import { getCelestialTelemetry, getSolarPosition } from '../engine/astronomy.js';

export class TelemetryDisplay {
  constructor(containerElement, analemmaCanvasElement) {
    this.container = containerElement;
    this.analemmaCanvas = analemmaCanvasElement;
    this.analemmaCtx = analemmaCanvasElement ? analemmaCanvasElement.getContext('2d') : null;
    this.analemmaData = this.precomputeYearlyAnalemma();
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
    return `${h}:${m}:${s} <small>UTC</small>`;
  }

  formatEoT(minutes) {
    const sign = minutes >= 0 ? '+' : '−';
    const absMin = Math.abs(minutes);
    const m = Math.floor(absMin);
    const s = Math.round((absMin - m) * 60);
    return `${sign}${m}m ${String(s).padStart(2, '0')}s`;
  }

  render(date, observer) {
    const telemetry = getCelestialTelemetry(date, observer.lat, observer.lon);
    const solarPos = getSolarPosition(date);

    if (this.container) {
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
              <span class="telemetry-highlight gold-glow">${this.formatTime(telemetry.solarNoonUTC)}</span>
            </div>
            <div class="telemetry-subdata">
              <div>Transit Altitude: <strong>${telemetry.solarElevationAtNoonDeg.toFixed(1)}°</strong></div>
              <div>Declination: <strong>${solarPos.declinationDeg >= 0 ? '+' : ''}${solarPos.declinationDeg.toFixed(2)}°</strong></div>
            </div>
          </div>

          <!-- Daylight & Solar Cycle -->
          <div class="telemetry-card">
            <div class="telemetry-card-title">
              <span class="icon">🌅</span> SOLAR CYCLE (HORIZON)
            </div>
            <div class="telemetry-row">
              <span class="field-label">Sunrise</span>
              <span class="field-value">${this.formatTime(telemetry.sunriseUTC)}</span>
            </div>
            <div class="telemetry-row">
              <span class="field-label">Sunset</span>
              <span class="field-value">${this.formatTime(telemetry.sunsetUTC)}</span>
            </div>
            <div class="telemetry-row">
              <span class="field-label">Day Length</span>
              <span class="field-value platinum-glow">${telemetry.dayLengthHours.toFixed(2)} hrs</span>
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
                <span class="twilight-val">${this.formatTime(telemetry.civilDawnUTC)} / ${this.formatTime(telemetry.civilDuskUTC)}</span>
              </div>
              <div class="twilight-phase">
                <span class="twilight-tag">NAUTICAL (−6° to −12°)</span>
                <span class="twilight-val">${this.formatTime(telemetry.nauticalDawnUTC)} / ${this.formatTime(telemetry.nauticalDuskUTC)}</span>
              </div>
              <div class="twilight-phase">
                <span class="twilight-tag">ASTRONOMICAL (−12° to −18°)</span>
                <span class="twilight-val">${this.formatTime(telemetry.astronomicalDawnUTC)} / ${this.formatTime(telemetry.astronomicalDuskUTC)}</span>
              </div>
            </div>
          </div>

          <!-- Equation of Time -->
          <div class="telemetry-card eot-card">
            <div class="telemetry-card-title">
              <span class="icon">⏱️</span> EQUATION OF TIME (EoT)
            </div>
            <div class="eot-main-row">
              <span class="eot-value gold-glow">${eotFormatted}</span>
              <span class="eot-status">${eotAheadBehind}</span>
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
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round((rect.width || 200) * dpr);
    canvas.height = Math.round((rect.height || 160) * dpr);
    const w = canvas.width;
    const h = canvas.height;

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
