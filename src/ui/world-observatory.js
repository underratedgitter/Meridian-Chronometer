/**
 * Meridian Chronometer — World Solar Observatory
 * Real-time equirectangular Earth observatory map.
 * Projects real-time solar terminator, multi-band twilight gradients,
 * subsolar zenith reticle, and interactive observer coordinates.
 */

import { WORLD_CONTINENTS, PRESET_OBSERVATORIES } from '../engine/world-geometry.js';
import { getSolarPosition, getTerminatorPoints } from '../engine/astronomy.js';

export class WorldObservatory {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.options = {
      primaryGold: '#c8aa6e',
      goldLight: '#e8ca8e',
      platinum: '#d8e2ec',
      obsidianDark: '#080a0f',
      landFill: '#171c26',
      landBorder: 'rgba(216, 226, 236, 0.22)',
      oceanFill: '#0b0e14',
      gridColor: 'rgba(216, 226, 236, 0.08)',
      equatorColor: 'rgba(200, 170, 110, 0.25)',
      tropicColor: 'rgba(200, 170, 110, 0.15)',
      ...options
    };

    this.observer = {
      lat: 51.4769,
      lon: 0.0005,
      name: 'Royal Observatory Greenwich'
    };

    this.hoverCoord = null;
    this.onObserverChange = null;
    this.isDragging = false;
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    this.setupInteractivity();
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width || 600;
    this.height = rect.height || 300;
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  setObserver(lat, lon, name = 'Custom Observer') {
    this.observer.lat = Math.max(-90, Math.min(90, lat));
    this.observer.lon = Math.max(-180, Math.min(180, lon));
    this.observer.name = name;
    if (this.onObserverChange) {
      this.onObserverChange(this.observer);
    }
  }

  setupInteractivity() {
    const handleCoordEvent = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Convert Canvas pixel to equirectangular [lon, lat]
      const lon = (x / rect.width) * 360 - 180;
      const lat = 90 - (y / rect.height) * 180;

      return {
        lat: Math.max(-90, Math.min(90, lat)),
        lon: Math.max(-180, Math.min(180, lon))
      };
    };

    this.canvas.addEventListener('mousemove', (e) => {
      const coord = handleCoordEvent(e);
      this.hoverCoord = coord;
      if (this.isDragging) {
        this.setObserver(coord.lat, coord.lon, 'Selected Position');
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      const coord = handleCoordEvent(e);
      this.setObserver(coord.lat, coord.lon, 'Selected Position');
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverCoord = null;
      this.isDragging = false;
    });
  }

  /**
   * Project geographic coordinates [lon, lat] to Canvas coordinates [x, y].
   */
  project(lon, lat) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const x = ((lon + 180) / 360.0) * w;
    const y = ((90 - lat) / 180.0) * h;
    return [x, y];
  }

  render(date) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = this.dpr;
    const opt = this.options;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // 1. Ocean Background
    ctx.fillStyle = opt.oceanFill;
    ctx.fillRect(0, 0, w, h);

    // 2. Graticule Lines (Equator, Meridians, Tropics, Polar Circles)
    this.drawGraticule(ctx, w, h);

    // 3. World Continents Landmass Polygons
    this.drawLandmasses(ctx);

    // 4. Multi-band Solar Twilight and Night Shadow
    this.drawTwilightAndNightShadow(ctx, date, w, h);

    // 5. Preset Observatories Markers
    this.drawPresetObservatories(ctx, dpr);

    // 6. Subsolar Point (Zenith Reticle) & Antipodal Nadir
    this.drawSubsolarPoints(ctx, date, dpr);

    // 7. Observer Crosshairs & Telemetry Tag
    this.drawObserver(ctx, dpr);

    // 8. Hairline Platinum Border & Frame Accents
    this.drawObservatoryFrame(ctx, w, h, dpr);

    ctx.restore();
  }

  drawGraticule(ctx, w, h) {
    const opt = this.options;
    const dpr = this.dpr;

    ctx.lineWidth = 0.5 * dpr;

    // Meridians every 15° (1 hour of solar time)
    for (let lon = -180; lon <= 180; lon += 15) {
      const [x] = this.project(lon, 0);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.strokeStyle = lon === 0 ? 'rgba(200, 170, 110, 0.4)' : opt.gridColor;
      ctx.stroke();
    }

    // Parallels every 15°
    for (let lat = -75; lat <= 75; lat += 15) {
      const [, y] = this.project(0, lat);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.strokeStyle = opt.gridColor;
      ctx.stroke();
    }

    // Equator (0°)
    const [, eqY] = this.project(0, 0);
    ctx.beginPath();
    ctx.moveTo(0, eqY);
    ctx.lineTo(w, eqY);
    ctx.strokeStyle = opt.equatorColor;
    ctx.lineWidth = 1 * dpr;
    ctx.stroke();

    // Tropics of Cancer & Capricorn (+/- 23.44°)
    for (const lat of [23.44, -23.44]) {
      const [, y] = this.project(0, lat);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.strokeStyle = opt.tropicColor;
      ctx.lineWidth = 0.7 * dpr;
      ctx.setLineDash([3 * dpr, 4 * dpr]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Arctic and Antarctic circles (+/- 66.56°)
    for (const lat of [66.56, -66.56]) {
      const [, y] = this.project(0, lat);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.strokeStyle = 'rgba(79, 164, 232, 0.15)';
      ctx.lineWidth = 0.7 * dpr;
      ctx.setLineDash([2 * dpr, 5 * dpr]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawLandmasses(ctx) {
    const opt = this.options;
    const dpr = this.dpr;

    ctx.fillStyle = opt.landFill;
    ctx.strokeStyle = opt.landBorder;
    ctx.lineWidth = 0.8 * dpr;

    for (const polygon of WORLD_CONTINENTS) {
      if (polygon.length < 3) continue;
      ctx.beginPath();
      const [firstLon, firstLat] = polygon[0];
      const [startX, startY] = this.project(firstLon, firstLat);
      ctx.moveTo(startX, startY);

      for (let i = 1; i < polygon.length; i++) {
        const [lon, lat] = polygon[i];
        const [x, y] = this.project(lon, lat);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  initShadowMap() {
    if (typeof document !== 'undefined') {
      this.shadowW = 360;
      this.shadowH = 180;
      this.shadowCanvas = document.createElement('canvas');
      this.shadowCanvas.width = this.shadowW;
      this.shadowCanvas.height = this.shadowH;
      this.shadowCtx = this.shadowCanvas.getContext('2d');
      this.shadowImageData = this.shadowCtx.createImageData(this.shadowW, this.shadowH);
    }
  }

  /**
   * Draws multi-band twilight gradients and deep night shadow using direct
   * spherical solar altitude matrix. Eliminates polygon self-intersection artifacts.
   */
  drawTwilightAndNightShadow(ctx, date, w, h) {
    const { subsolarPoint } = getSolarPosition(date);
    const phiSRad = subsolarPoint.latitudeDeg * (Math.PI / 180);
    const lamSRad = subsolarPoint.longitudeDeg * (Math.PI / 180);
    const sinPhiS = Math.sin(phiSRad);
    const cosPhiS = Math.cos(phiSRad);

    if (!this.shadowImageData) {
      this.initShadowMap();
    }

    if (this.shadowImageData) {
      const buf = this.shadowImageData.data;
      const sw = this.shadowW;
      const sh = this.shadowH;

      for (let y = 0; y < sh; y++) {
        const phi = (90 - (y / sh) * 180) * (Math.PI / 180);
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
        const term1 = sinPhi * sinPhiS;
        const term2 = cosPhi * cosPhiS;
        const rowOffset = y * sw * 4;

        for (let x = 0; x < sw; x++) {
          const lam = ((x / sw) * 360 - 180) * (Math.PI / 180);
          const sinAlt = term1 + term2 * Math.cos(lam - lamSRad);
          const idx = rowOffset + x * 4;

          // Atmospheric nocturnal shadow palette:
          // Deep obsidian/navy with warm golden glow at optical horizon
          if (sinAlt >= 0.1045) {
            // Full daylight (altitude >= +6°)
            buf[idx + 3] = 0;
          } else if (sinAlt > 0) {
            // Golden hour (0° to +6°)
            buf[idx] = 200;
            buf[idx + 1] = 170;
            buf[idx + 2] = 110;
            buf[idx + 3] = Math.round((1 - sinAlt / 0.1045) * 30);
          } else if (sinAlt >= -0.1045) {
            // Civil twilight (0° to -6°)
            buf[idx] = 10;
            buf[idx + 1] = 16;
            buf[idx + 2] = 32;
            buf[idx + 3] = Math.round(50 + (-sinAlt / 0.1045) * 60);
          } else if (sinAlt >= -0.2079) {
            // Nautical twilight (-6° to -12°)
            buf[idx] = 7;
            buf[idx + 1] = 10;
            buf[idx + 2] = 22;
            buf[idx + 3] = Math.round(110 + ((-sinAlt - 0.1045) / 0.1034) * 55);
          } else if (sinAlt >= -0.3090) {
            // Astronomical twilight (-12° to -18°)
            buf[idx] = 5;
            buf[idx + 1] = 7;
            buf[idx + 2] = 16;
            buf[idx + 3] = Math.round(165 + ((-sinAlt - 0.2079) / 0.1011) * 35);
          } else {
            // Complete astronomical night (< -18°)
            buf[idx] = 4;
            buf[idx + 1] = 5;
            buf[idx + 2] = 11;
            buf[idx + 3] = 215; // deep obsidian shadow
          }
        }
      }

      this.shadowCtx.putImageData(this.shadowImageData, 0, 0);

      // Render smooth interpolated shadow over the map
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.shadowCanvas, 0, 0, w, h);
      ctx.restore();
    }

    // Crisp glowing optical horizon line (alt = 0°)
    const term0 = getTerminatorPoints(date, 360, 0);
    ctx.save();
    ctx.strokeStyle = 'rgba(200, 170, 110, 0.7)';
    ctx.lineWidth = 1.4 * this.dpr;
    ctx.shadowColor = 'rgba(200, 170, 110, 0.6)';
    ctx.shadowBlur = 8 * this.dpr;

    ctx.beginPath();
    let isDrawing = false;
    for (let i = 0; i < term0.length; i++) {
      const pt = term0[i];
      const [tx, ty] = this.project(pt.longitudeDeg, pt.latitudeDeg);
      if (i > 0) {
        const prevPt = term0[i - 1];
        // Break path across antimeridian wrap (-180 / +180) to avoid screen-wide horizontal lines
        if (Math.abs(pt.longitudeDeg - prevPt.longitudeDeg) > 180) {
          ctx.stroke();
          ctx.beginPath();
          isDrawing = false;
        }
      }
      if (!isDrawing) {
        ctx.moveTo(tx, ty);
        isDrawing = true;
      } else {
        ctx.lineTo(tx, ty);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  drawPresetObservatories(ctx, dpr) {
    for (const obs of PRESET_OBSERVATORIES) {
      // Don't duplicate active observer
      if (Math.abs(obs.lat - this.observer.lat) < 0.1 && Math.abs(obs.lon - this.observer.lon) < 0.1) {
        continue;
      }
      const [x, y] = this.project(obs.lon, obs.lat);
      ctx.beginPath();
      ctx.arc(x, y, 1.8 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(216, 226, 236, 0.4)';
      ctx.fill();
    }
  }

  drawSubsolarPoints(ctx, date, dpr) {
    const { subsolarPoint } = getSolarPosition(date);
    const [sunX, sunY] = this.project(subsolarPoint.longitudeDeg, subsolarPoint.latitudeDeg);

    // Golden solar zenith reticle
    ctx.save();
    ctx.translate(sunX, sunY);

    // Glowing solar disc
    const sunGrad = ctx.createRadialGradient(0, 0, 1 * dpr, 0, 0, 8 * dpr);
    sunGrad.addColorStop(0, '#fff4d0');
    sunGrad.addColorStop(0.4, '#c8aa6e');
    sunGrad.addColorStop(1, 'rgba(200, 170, 110, 0)');

    ctx.beginPath();
    ctx.arc(0, 0, 8 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    // Central sun dot
    ctx.beginPath();
    ctx.arc(0, 0, 2.5 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Radiating reticle crosshairs
    ctx.strokeStyle = '#c8aa6e';
    ctx.lineWidth = 1 * dpr;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 4 * dpr);
      ctx.lineTo(0, 9 * dpr);
      ctx.stroke();
    }

    ctx.restore();

    // Antipodal Nadir (midnight center)
    let nadirLon = subsolarPoint.longitudeDeg + 180;
    if (nadirLon > 180) nadirLon -= 360;
    const nadirLat = -subsolarPoint.latitudeDeg;
    const [nadirX, nadirY] = this.project(nadirLon, nadirLat);

    ctx.save();
    ctx.beginPath();
    ctx.arc(nadirX, nadirY, 3 * dpr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(79, 164, 232, 0.5)';
    ctx.lineWidth = 1 * dpr;
    ctx.stroke();
    ctx.restore();
  }

  drawObserver(ctx, dpr) {
    const [x, y] = this.project(this.observer.lon, this.observer.lat);

    ctx.save();
    // Pulsing outer beacon ring
    ctx.beginPath();
    ctx.arc(x, y, 7 * dpr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200, 170, 110, 0.7)';
    ctx.lineWidth = 1.2 * dpr;
    ctx.stroke();

    // Inner bright core
    ctx.beginPath();
    ctx.arc(x, y, 2.5 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Crosshair lines
    ctx.strokeStyle = 'rgba(232, 202, 142, 0.8)';
    ctx.lineWidth = 1 * dpr;

    ctx.beginPath();
    ctx.moveTo(x - 11 * dpr, y);
    ctx.lineTo(x - 8 * dpr, y);
    ctx.moveTo(x + 8 * dpr, y);
    ctx.lineTo(x + 11 * dpr, y);
    ctx.moveTo(x, y - 11 * dpr);
    ctx.lineTo(x, y - 8 * dpr);
    ctx.moveTo(x, y + 8 * dpr);
    ctx.lineTo(x, y + 11 * dpr);
    ctx.stroke();

    // Label
    ctx.fillStyle = '#e8ca8e';
    ctx.font = `600 ${Math.round(8 * dpr)}px "Space Mono", monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`⌖ ${this.observer.name}`, x + 9 * dpr, y - 8 * dpr);

    ctx.restore();
  }

  drawObservatoryFrame(ctx, w, h, dpr) {
    const opt = this.options;

    // Hairline platinum frame
    ctx.strokeStyle = 'rgba(216, 226, 236, 0.16)';
    ctx.lineWidth = 1 * dpr;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // Corner bracket ornaments (Observatory telemetry style)
    const bracketSize = 10 * dpr;
    ctx.strokeStyle = opt.primaryGold;
    ctx.lineWidth = 1.5 * dpr;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(0.5, bracketSize);
    ctx.lineTo(0.5, 0.5);
    ctx.lineTo(bracketSize, 0.5);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(w - bracketSize, 0.5);
    ctx.lineTo(w - 0.5, 0.5);
    ctx.lineTo(w - 0.5, bracketSize);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(0.5, h - bracketSize);
    ctx.lineTo(0.5, h - 0.5);
    ctx.lineTo(bracketSize, h - 0.5);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(w - bracketSize, h - 0.5);
    ctx.lineTo(w - 0.5, h - 0.5);
    ctx.lineTo(w - 0.5, h - bracketSize);
    ctx.stroke();

    // Telemetry stamp in top corner
    ctx.fillStyle = 'rgba(200, 170, 110, 0.8)';
    ctx.font = `600 ${Math.round(7 * dpr)}px "Space Mono", monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('SOLAR TERMINATOR OBSERVATORY // EQUIRECTANGULAR', w - 14 * dpr, 6 * dpr);
  }
}
