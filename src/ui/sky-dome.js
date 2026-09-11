/**
 * Meridian Chronometer — Observatory Zenith Sky Dome (Planisphere)
 * High-precision local horizontal stereographic sky dome.
 * Projects real-time visible stars, planets, horizon, zenith, and celestial meridian.
 */

import {
  raDecToAltAz,
  getPlanetaryPositions,
  BRIGHT_STARS,
  getSolarPosition,
  getLunarComplication,
  getLMST
} from '../engine/astronomy.js';
import { escapeHTML, safeMerge } from '../engine/sanitizer.js';

export class SkyDomeModal {
  constructor(modalElement, canvasElement, options = {}) {
    this.modal = modalElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.options = safeMerge({
      primaryGold: '#c8aa6e',
      goldBright: '#e8ca8e',
      platinum: '#d8e2ec',
      platinumMuted: 'rgba(216, 226, 236, 0.35)',
      deepSpace: '#05070d',
      gridColor: 'rgba(216, 226, 236, 0.10)',
      meridianColor: 'rgba(200, 170, 110, 0.35)',
      horizonColor: 'rgba(200, 170, 110, 0.8)'
    }, options);

    this.isOpen = false;
    this.hoveredObject = null;
    this.currentDate = new Date();
    this.currentObserver = { lat: 51.4769, lon: 0.0005, name: 'Royal Observatory Greenwich' };
    this.dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    this.initEvents();
    this.resize();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const size = Math.min(rect.width || 460, rect.height || 460);
    this.dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    this.canvas.width = Math.round(size * this.dpr);
    this.canvas.height = Math.round(size * this.dpr);
    this.radius = (size / 2) * 0.88;
  }

  initEvents() {
    if (!this.canvas) return;

    // Hover tooltip tracking
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * this.dpr;
      const y = (e.clientY - rect.top) * this.dpr;
      this.checkHover(x, y);
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredObject = null;
    });

    // Close button in modal
    const btnClose = this.modal.querySelector('.modal-close-btn');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.close());
    }

    // Close on overlay backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // Close on ESC key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  open(observer, date) {
    if (observer && typeof observer === 'object') {
      const lat = Math.max(-90, Math.min(90, Number(observer.lat)));
      const lon = Math.max(-180, Math.min(180, Number(observer.lon)));
      this.currentObserver = {
        lat: Number.isNaN(lat) ? 0 : lat,
        lon: Number.isNaN(lon) ? 0 : lon,
        name: String(observer.name ?? 'Unknown').slice(0, 48)
      };
    }
    this.currentDate = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date();
    this.isOpen = true;
    this.modal.classList.add('active');
    this.modal.setAttribute('aria-hidden', 'false');
    this.resize();
    this.render();
  }

  close() {
    this.isOpen = false;
    this.modal.classList.remove('active');
    this.modal.setAttribute('aria-hidden', 'true');
    this.hoveredObject = null;
  }

  /**
   * Projects Horizontal coordinates (altDeg, azDeg) to 2D Planisphere Canvas.
   * Center (cx, cy) is Zenith (alt = 90°).
   * Perimeter is Horizon (alt = 0°).
   * North is at Top (az = 0°), East at Left or Right (standard planisphere holds map up to sky).
   */
  projectAltAz(altDeg, azDeg, cx, cy, r) {
    // Polar projection: distance from center proportional to zenith angle (90 - alt)
    const zAngle = 90.0 - altDeg;
    const dist = (zAngle / 90.0) * r;

    // Azimuth measured from North (0° / top), clockwise through East (90° / right)
    const azRad = (azDeg - 90.0) * (Math.PI / 180.0);
    const x = cx + dist * Math.cos(azRad);
    const y = cy + dist * Math.sin(azRad);

    return { x, y, dist };
  }

  checkHover(canvasX, canvasY) {
    if (!this.cachedCelestialObjects) return;
    let closest = null;
    let minDist = 14 * this.dpr;

    for (const obj of this.cachedCelestialObjects) {
      if (!obj.isVisible) continue;
      const dx = obj.projX - canvasX;
      const dy = obj.projY - canvasY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        closest = obj;
      }
    }

    this.hoveredObject = closest;
  }

  render(date = null, observer = null) {
    if (date instanceof Date && Number.isFinite(date.getTime())) this.currentDate = date;
    if (observer && typeof observer === 'object') {
      const lat = Math.max(-90, Math.min(90, Number(observer.lat)));
      const lon = Math.max(-180, Math.min(180, Number(observer.lon)));
      this.currentObserver = {
        lat: Number.isNaN(lat) ? this.currentObserver.lat : lat,
        lon: Number.isNaN(lon) ? this.currentObserver.lon : lon,
        name: String(observer.name ?? this.currentObserver.name ?? 'Unknown').slice(0, 48)
      };
    }
    if (!this.isOpen || !this.ctx) return;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const dpr = this.dpr;
    const r = this.radius * dpr;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    const lmstHours = getLMST(this.currentDate, this.currentObserver.lon);
    const solarPos = getSolarPosition(this.currentDate);

    // 1. Sky Background & Atmospheric Tint
    this.drawSkyDomeBackground(ctx, cx, cy, r, solarPos);

    // 2. Dome Grid (Zenith, Horizon, Altitude circles, Meridian)
    this.drawDomeGrid(ctx, cx, cy, r, dpr);

    // 3. Compute and Render Celestial Objects (Stars, Planets, Moon, Sun)
    this.renderCelestialBodies(ctx, cx, cy, r, dpr, lmstHours);

    // 4. Horizon Frame & Cardinal Compass Labels (N, E, S, W)
    this.drawHorizonFrame(ctx, cx, cy, r, dpr);

    // 5. Hover Object Inspector Card
    if (this.hoveredObject) {
      this.drawObjectTooltip(ctx, cx, cy, dpr, this.hoveredObject);
    }

    ctx.restore();

    // Update Modal Header Telemetry
    this.updateModalInfo(lmstHours);
  }

  drawSkyDomeBackground(ctx, cx, cy, r, solarPos) {
    // Determine sun altitude to color sky (day vs twilight vs starry night)
    const sunAltAz = raDecToAltAz(
      solarPos.rightAscensionHours,
      solarPos.declinationDeg,
      getLMST(this.currentDate, this.currentObserver.lon),
      this.currentObserver.lat
    );

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    if (sunAltAz.altitudeDeg > 0) {
      // Daytime solar azure glow
      grad.addColorStop(0, '#10223d');
      grad.addColorStop(0.7, '#0a1628');
      grad.addColorStop(1, '#050c18');
    } else if (sunAltAz.altitudeDeg > -12) {
      // Twilight violet
      grad.addColorStop(0, '#0d1024');
      grad.addColorStop(0.7, '#070a16');
      grad.addColorStop(1, '#03050a');
    } else {
      // Deep nocturnal observatory space
      grad.addColorStop(0, '#060912');
      grad.addColorStop(0.7, '#04060c');
      grad.addColorStop(1, '#020306');
    }

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Faint Milky Way dusting
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const mwGrad = ctx.createLinearGradient(cx - r, cy - r * 0.5, cx + r, cy + r * 0.5);
    mwGrad.addColorStop(0, 'rgba(120, 160, 220, 0)');
    mwGrad.addColorStop(0.5, 'rgba(140, 180, 255, 0.05)');
    mwGrad.addColorStop(1, 'rgba(120, 160, 220, 0)');
    ctx.fillStyle = mwGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  drawDomeGrid(ctx, cx, cy, r, dpr) {
    const opt = this.options;

    // Altitude Circles (30° and 60°)
    for (const alt of [30, 60]) {
      const zAngle = 90 - alt;
      const circleR = (zAngle / 90.0) * r;
      ctx.beginPath();
      ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
      ctx.strokeStyle = opt.gridColor;
      ctx.lineWidth = 0.8 * dpr;
      ctx.setLineDash([2 * dpr, 4 * dpr]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Altitude label
      ctx.fillStyle = 'rgba(216, 226, 236, 0.25)';
      ctx.font = `${Math.round(7 * dpr)}px "Space Mono", monospace`;
      ctx.fillText(`${alt}°`, cx + 4 * dpr, cy - circleR + 9 * dpr);
    }

    // Celestial Meridian (North-Zenith-South axis)
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.strokeStyle = opt.meridianColor;
    ctx.lineWidth = 1 * dpr;
    ctx.stroke();

    // Prime Vertical (East-Zenith-West axis)
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.strokeStyle = opt.gridColor;
    ctx.lineWidth = 0.8 * dpr;
    ctx.stroke();

    // Zenith Reticle
    ctx.beginPath();
    ctx.arc(cx, cy, 3 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = opt.primaryGold;
    ctx.fill();
    ctx.fillStyle = opt.goldBright;
    ctx.font = `600 ${Math.round(7 * dpr)}px "Cinzel", serif`;
    ctx.textAlign = 'left';
    ctx.fillText('ZENITH (90°)', cx + 6 * dpr, cy - 4 * dpr);
  }

  renderCelestialBodies(ctx, cx, cy, r, dpr, lmstHours) {
    const objects = [];
    const lat = this.currentObserver.lat;

    // 1. Navigation Stars
    for (const star of BRIGHT_STARS) {
      const altAz = raDecToAltAz(star.raHours, star.decDeg, lmstHours, lat);
      const isVis = altAz.altitudeDeg >= 0;
      const { x, y } = this.projectAltAz(altAz.altitudeDeg, altAz.azimuthDeg, cx, cy, r);

      objects.push({
        type: 'star',
        name: star.name,
        subtitle: `${star.bayer} in ${star.const}`,
        mag: star.mag,
        color: star.color,
        alt: altAz.altitudeDeg,
        az: altAz.azimuthDeg,
        isVisible: isVis,
        projX: x,
        projY: y
      });
    }

    // 2. Planets (Venus, Mars, Jupiter)
    const planets = getPlanetaryPositions(this.currentDate);
    for (const [key, planet] of Object.entries(planets)) {
      const altAz = raDecToAltAz(planet.raHours, planet.decDeg, lmstHours, lat);
      const isVis = altAz.altitudeDeg >= 0;
      const { x, y } = this.projectAltAz(altAz.altitudeDeg, altAz.azimuthDeg, cx, cy, r);

      objects.push({
        type: 'planet',
        name: planet.name,
        subtitle: `${planet.symbol} Classical Planet`,
        mag: planet.magnitude,
        color: planet.color,
        symbol: planet.symbol,
        alt: altAz.altitudeDeg,
        az: altAz.azimuthDeg,
        isVisible: isVis,
        projX: x,
        projY: y
      });
    }

    // 3. True Sun
    const solarPos = getSolarPosition(this.currentDate);
    const sunAltAz = raDecToAltAz(solarPos.rightAscensionHours, solarPos.declinationDeg, lmstHours, lat);
    const sunProj = this.projectAltAz(sunAltAz.altitudeDeg, sunAltAz.azimuthDeg, cx, cy, r);
    objects.push({
      type: 'sun',
      name: 'The Sun',
      subtitle: 'Solar Meridian Center',
      mag: -26.7,
      color: '#fff0a8',
      symbol: '☀️',
      alt: sunAltAz.altitudeDeg,
      az: sunAltAz.azimuthDeg,
      isVisible: sunAltAz.altitudeDeg >= -18,
      projX: sunProj.x,
      projY: sunProj.y
    });

    this.cachedCelestialObjects = objects;

    // Draw visible celestial bodies, clipped to the horizon circle so
    // below-horizon twilight sun (alt in [-18,0)) never paints outside the dome
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    for (const obj of objects) {
      if (!obj.isVisible) continue;

      ctx.save();
      if (obj.type === 'star') {
        // Star size based on astronomical magnitude
        const starR = Math.max(1.5 * dpr, (4.2 - obj.mag * 0.8) * dpr);
        ctx.beginPath();
        ctx.arc(obj.projX, obj.projY, starR, 0, Math.PI * 2);
        ctx.fillStyle = obj.color;
        ctx.shadowColor = obj.color;
        ctx.shadowBlur = 6 * dpr;
        ctx.fill();

        // Label for bright stars (mag < 1.5)
        if (obj.mag < 1.5) {
          ctx.fillStyle = 'rgba(216, 226, 236, 0.7)';
          ctx.font = `${Math.round(6.5 * dpr)}px "Space Mono", monospace`;
          ctx.fillText(obj.name, obj.projX + starR + 3 * dpr, obj.projY + 2 * dpr);
        }
      } else if (obj.type === 'planet') {
        // Glowing planetary disc
        const pR = 3.5 * dpr;
        ctx.beginPath();
        ctx.arc(obj.projX, obj.projY, pR, 0, Math.PI * 2);
        ctx.fillStyle = obj.color;
        ctx.shadowColor = obj.color;
        ctx.shadowBlur = 8 * dpr;
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(7 * dpr)}px "Space Mono", monospace`;
        ctx.fillText(obj.name, obj.projX + pR + 4 * dpr, obj.projY + 3 * dpr);
      } else if (obj.type === 'sun') {
        // Solar Disc & Radiant Flare
        const sR = 5 * dpr;
        const sunGrad = ctx.createRadialGradient(obj.projX, obj.projY, 1, obj.projX, obj.projY, 12 * dpr);
        sunGrad.addColorStop(0, '#ffffff');
        sunGrad.addColorStop(0.4, '#c8aa6e');
        sunGrad.addColorStop(1, 'rgba(200, 170, 110, 0)');
        ctx.beginPath();
        ctx.arc(obj.projX, obj.projY, 12 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = sunGrad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(obj.projX, obj.projY, sR, 0, Math.PI * 2);
        ctx.fillStyle = '#fffdf0';
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  drawHorizonFrame(ctx, cx, cy, r, dpr) {
    const opt = this.options;

    // Horizon border (alt = 0°)
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = opt.primaryGold;
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();

    // Concentric outer bezel ring
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4 * dpr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(216, 226, 236, 0.2)';
    ctx.lineWidth = 0.8 * dpr;
    ctx.stroke();

    // 360-degree Azimuth ticks around the horizon
    for (let az = 0; az < 360; az += 10) {
      const angle = (az - 90.0) * (Math.PI / 180.0);
      const isMajor = az % 30 === 0;
      const tickLen = (isMajor ? 6 : 3) * dpr;

      const x1 = cx + Math.cos(angle) * r;
      const y1 = cy + Math.sin(angle) * r;
      const x2 = cx + Math.cos(angle) * (r - tickLen);
      const y2 = cy + Math.sin(angle) * (r - tickLen);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = isMajor ? opt.primaryGold : 'rgba(216, 226, 236, 0.3)';
      ctx.lineWidth = (isMajor ? 1.2 : 0.6) * dpr;
      ctx.stroke();
    }

    // Compass Cardinal Labels (N at top, E at right, S at bottom, W at left)
    const cardinals = [
      { label: 'N', az: 0 },
      { label: 'E', az: 90 },
      { label: 'S', az: 180 },
      { label: 'W', az: 270 }
    ];

    ctx.font = `600 ${Math.round(9 * dpr)}px "Cinzel", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const card of cardinals) {
      const angle = (card.az - 90.0) * (Math.PI / 180.0);
      const lx = cx + Math.cos(angle) * (r + 14 * dpr);
      const ly = cy + Math.sin(angle) * (r + 14 * dpr);

      ctx.fillStyle = card.label === 'N' ? '#ff6b6b' : opt.primaryGold;
      ctx.fillText(card.label, lx, ly);
    }
  }

  drawObjectTooltip(ctx, cx, cy, dpr, obj) {
    const cardW = 160 * dpr;
    const cardH = 55 * dpr;
    let cardX = obj.projX + 12 * dpr;
    let cardY = obj.projY - 25 * dpr;

    // Boundary containment
    if (cardX + cardW > this.canvas.width - 10 * dpr) {
      cardX = obj.projX - cardW - 12 * dpr;
    }
    if (cardY < 10 * dpr) {
      cardY = 10 * dpr;
    }

    ctx.save();
    ctx.fillStyle = 'rgba(9, 11, 18, 0.95)';
    ctx.strokeStyle = this.options.primaryGold;
    ctx.lineWidth = 1 * dpr;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 10 * dpr;

    ctx.strokeRect(cardX, cardY, cardW, cardH);
    ctx.fillRect(cardX, cardY, cardW, cardH);

    ctx.fillStyle = this.options.goldBright;
    ctx.font = `600 ${Math.round(8 * dpr)}px "Space Mono", monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(obj.name.toUpperCase(), cardX + 8 * dpr, cardY + 7 * dpr);

    ctx.fillStyle = 'rgba(216, 226, 236, 0.6)';
    ctx.font = `${Math.round(6.5 * dpr)}px "Space Mono", monospace`;
    ctx.fillText(obj.subtitle, cardX + 8 * dpr, cardY + 19 * dpr);

    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(7 * dpr)}px "Space Mono", monospace`;
    ctx.fillText(`Alt: ${obj.alt.toFixed(1)}°  Az: ${obj.az.toFixed(1)}°`, cardX + 8 * dpr, cardY + 34 * dpr);

    ctx.restore();
  }

  updateModalInfo(lmstHours) {
    const infoEl = this.modal.querySelector('#skyDomeInfo');
    if (infoEl) {
      const obs = this.currentObserver;
      const latFmt = `${Math.abs(obs.lat).toFixed(2)}° ${obs.lat >= 0 ? 'N' : 'S'}`;
      const lonFmt = `${Math.abs(obs.lon).toFixed(2)}° ${obs.lon >= 0 ? 'E' : 'W'}`;
      const lmstH = Math.floor(lmstHours);
      const lmstM = Math.floor((lmstHours % 1) * 60);
      const pad = (n) => String(n).padStart(2, '0');

      infoEl.innerHTML = `
        <strong>${escapeHTML(obs.name)}</strong> [${escapeHTML(latFmt)}, ${escapeHTML(lonFmt)}] &bull;
        LMST: <span class="gold-glow">${escapeHTML(pad(lmstH))}:${escapeHTML(pad(lmstM))}</span>
      `;
    }
  }
}
