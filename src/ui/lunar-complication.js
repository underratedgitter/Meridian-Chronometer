/**
 * Meridian Chronometer — Lunar Complication
 * Physically accurate mechanical moon phase complication dial.
 * Renders dynamic spherical lunar illumination, crater shading,
 * and precision lunar telemetry.
 */

import { getLunarComplication } from '../engine/astronomy.js';

export class LunarComplication {
  constructor(canvasElement, telemetryContainer, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.container = telemetryContainer;
    this.options = {
      primaryGold: '#c8aa6e',
      goldLight: '#e8ca8e',
      platinum: '#d8e2ec',
      deepSky: '#05070e',
      moonBright: '#eaf0f8',
      moonDark: '#121620',
      craterColor: 'rgba(90, 105, 125, 0.28)',
      ...options
    };

    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width || 180;
    this.height = rect.height || 180;
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  render(date) {
    const complication = getLunarComplication(date);
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = this.dpr;
    const cx = w / 2;
    const cy = h / 2;
    const r = (Math.min(w, h) / 2) * 0.88;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // 1. Dial Bezel and Starfield Background
    this.drawStarfieldAperture(ctx, cx, cy, r, dpr);

    // 2. Realistic Spherical Moon with Exact Terminator Curvature
    this.drawSphericalMoon(ctx, cx, cy, r * 0.72, complication, dpr);

    // 3. Complication Bezel & Graduated Indices
    this.drawComplicationBezel(ctx, cx, cy, r, dpr);

    ctx.restore();

    // 4. Update DOM telemetry throttled at 2Hz
    const curSec = Math.floor(date.getTime() / 500);
    if (curSec !== this.lastRenderSec) {
      this.lastRenderSec = curSec;
      this.updateTelemetry(complication);
    }
  }

  drawStarfieldAperture(ctx, cx, cy, r, dpr) {
    // Deep nocturnal aperture
    const skyGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    skyGrad.addColorStop(0, '#0a0f1c');
    skyGrad.addColorStop(0.8, '#060810');
    skyGrad.addColorStop(1, '#030408');

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = skyGrad;
    ctx.fill();

    // Engraved celestial gold stars
    const starAngles = [0.3, 0.85, 1.4, 2.1, 2.7, 3.5, 4.2, 4.9, 5.7];
    const starRadii = [0.82, 0.78, 0.85, 0.80, 0.84, 0.79, 0.83, 0.76, 0.82];

    for (let i = 0; i < starAngles.length; i++) {
      const sx = cx + Math.cos(starAngles[i]) * r * starRadii[i];
      const sy = cy + Math.sin(starAngles[i]) * r * starRadii[i];

      ctx.beginPath();
      ctx.arc(sx, sy, (i % 2 === 0 ? 1.2 : 0.8) * dpr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(232, 202, 142, 0.7)';
      ctx.fill();
    }
  }

  /**
   * Draws the Moon's spherical disc with authentic phase terminator.
   * Uses parametric 2D projection of spherical illumination.
   */
  drawSphericalMoon(ctx, cx, cy, mr, complication, dpr) {
    const k = complication.illuminationFraction; // [0, 1]
    const isWaxing = complication.isWaxing;

    ctx.save();

    // Base dark moon sphere (subtle earthshine)
    const darkGrad = ctx.createRadialGradient(cx - mr * 0.2, cy - mr * 0.2, mr * 0.1, cx, cy, mr);
    darkGrad.addColorStop(0, '#1c2230');
    darkGrad.addColorStop(0.7, '#10141e');
    darkGrad.addColorStop(1, '#090b10');

    ctx.beginPath();
    ctx.arc(cx, cy, mr, 0, Math.PI * 2);
    ctx.fillStyle = darkGrad;
    ctx.fill();

    // Maria (lunar plains) on dark side
    this.drawLunarFeatures(ctx, cx, cy, mr, false);

    // Clip to circle of moon
    ctx.beginPath();
    ctx.arc(cx, cy, mr, 0, Math.PI * 2);
    ctx.clip();

    // Illuminated hemisphere
    // The illuminated portion is bounded by:
    // 1. Semi-circle on the illuminated limb
    // 2. Semi-ellipse of the terminator with x-radius = mr * |2k - 1|
    if (k > 0.005) {
      ctx.beginPath();
      // Right limb is illuminated during Waxing, Left limb during Waning
      const semiMinor = mr * Math.abs(2 * k - 1);
      const isGibbous = k >= 0.5;

      if (isWaxing) {
        // Waxing: Right limb is always illuminated [ -PI/2 to PI/2 ]
        ctx.arc(cx, cy, mr, -Math.PI / 2, Math.PI / 2, false);

        if (isGibbous) {
          // Terminator bulges to the dark side (left, so x-radius points left)
          ctx.ellipse(cx, cy, semiMinor, mr, 0, Math.PI / 2, -Math.PI / 2, false);
        } else {
          // Crescent: Terminator curves into the illuminated side (right)
          ctx.ellipse(cx, cy, semiMinor, mr, 0, Math.PI / 2, -Math.PI / 2, true);
        }
      } else {
        // Waning: Left limb is illuminated [ PI/2 to 3*PI/2 ]
        ctx.arc(cx, cy, mr, Math.PI / 2, -Math.PI / 2, false);

        if (isGibbous) {
          // Terminator bulges right into dark side
          ctx.ellipse(cx, cy, semiMinor, mr, 0, -Math.PI / 2, Math.PI / 2, false);
        } else {
          // Crescent: Terminator curves left
          ctx.ellipse(cx, cy, semiMinor, mr, 0, -Math.PI / 2, Math.PI / 2, true);
        }
      }

      ctx.closePath();

      // 3D Illuminated Lunar Surface gradient
      const lightGrad = ctx.createRadialGradient(
        isWaxing ? cx + mr * 0.4 : cx - mr * 0.4,
        cy - mr * 0.2,
        mr * 0.05,
        cx,
        cy,
        mr * 1.1
      );
      lightGrad.addColorStop(0, '#ffffff');
      lightGrad.addColorStop(0.3, '#edf3fa');
      lightGrad.addColorStop(0.7, '#c2cedd');
      lightGrad.addColorStop(1, '#97a6bb');

      ctx.fillStyle = lightGrad;
      ctx.fill();

      // Draw lunar maria and crater texture on bright side
      this.drawLunarFeatures(ctx, cx, cy, mr, true);
    }

    ctx.restore();

    // Subtle 3D limb shadow ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, mr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1 * dpr;
    ctx.stroke();
    ctx.restore();
  }

  drawLunarFeatures(ctx, cx, cy, mr, isBrightSide) {
    ctx.save();
    // Simplified major lunar maria (Oceanus Procellarum, Mare Imbrium, Mare Serenitatis, Mare Tranquillitatis)
    const features = [
      { x: -0.3 * mr, y: -0.2 * mr, r: 0.26 * mr }, // Imbrium
      { x: -0.45 * mr, y: 0.1 * mr, r: 0.35 * mr }, // Procellarum
      { x: 0.15 * mr, y: -0.15 * mr, r: 0.2 * mr }, // Serenitatis
      { x: 0.25 * mr, y: 0.05 * mr, r: 0.22 * mr }, // Tranquillitatis
      { x: 0.35 * mr, y: 0.25 * mr, r: 0.16 * mr }, // Fecunditatis
      { x: -0.15 * mr, y: 0.35 * mr, r: 0.18 * mr }  // Nubium
    ];

    ctx.fillStyle = isBrightSide ? 'rgba(120, 135, 155, 0.22)' : 'rgba(10, 14, 22, 0.35)';

    for (const f of features) {
      ctx.beginPath();
      ctx.arc(cx + f.x, cy + f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawComplicationBezel(ctx, cx, cy, r, dpr) {
    const opt = this.options;

    // Outer gold border
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = opt.primaryGold;
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();

    // Inner platinum accent
    ctx.beginPath();
    ctx.arc(cx, cy, r - 3 * dpr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(216, 226, 236, 0.3)';
    ctx.lineWidth = 0.8 * dpr;
    ctx.stroke();

    // Synodic Month 29.5-day tick divisions around the rim
    for (let day = 0; day < 30; day++) {
      const angle = (day / 29.53) * Math.PI * 2 - Math.PI / 2;
      const isMajor = day % 5 === 0;
      const tickLen = (isMajor ? 4 : 2) * dpr;

      const x1 = cx + Math.cos(angle) * (r - 4 * dpr);
      const y1 = cy + Math.sin(angle) * (r - 4 * dpr);
      const x2 = cx + Math.cos(angle) * (r - 4 * dpr - tickLen);
      const y2 = cy + Math.sin(angle) * (r - 4 * dpr - tickLen);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = isMajor ? opt.primaryGold : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = (isMajor ? 1 : 0.6) * dpr;
      ctx.stroke();
    }
  }

  updateTelemetry(comp) {
    if (!this.container) return;

    const fullDays = Math.floor(comp.daysToNextFullMoon);
    const fullHours = Math.round((comp.daysToNextFullMoon - fullDays) * 24);

    const newDays = Math.floor(comp.daysToNextNewMoon);
    const newHours = Math.round((comp.daysToNextNewMoon - newDays) * 24);

    this.container.innerHTML = `
      <div class="lunar-telemetry-header">
        <span class="lunar-phase-badge">${comp.phaseName.toUpperCase()}</span>
        <span class="lunar-orbit-dir">${comp.isWaxing ? '▲ WAXING' : '▼ WANING'}</span>
      </div>
      <div class="lunar-stat-grid">
        <div class="lunar-stat">
          <span class="stat-label">ILLUMINATION</span>
          <span class="stat-value gold-glow">${comp.illuminationPercent}%</span>
        </div>
        <div class="lunar-stat">
          <span class="stat-label">LUNAR AGE</span>
          <span class="stat-value">${comp.lunarAgeDays.toFixed(1)} <small>d</small></span>
        </div>
        <div class="lunar-stat">
          <span class="stat-label">NEXT FULL MOON</span>
          <span class="stat-value">${fullDays}d ${fullHours}h</span>
        </div>
        <div class="lunar-stat">
          <span class="stat-label">NEXT NEW MOON</span>
          <span class="stat-value">${newDays}d ${newHours}h</span>
        </div>
      </div>
    `;
  }
}
