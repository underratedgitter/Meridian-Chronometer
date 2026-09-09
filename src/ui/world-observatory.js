/**
 * Meridian Chronometer — World Solar Observatory
 * Multi-projection Earth observatory supporting both:
 * 1. 2D Equirectangular Projection
 * 2. 3D Orthographic Spherical Globe with atmospheric limb glow,
 *    interactive 3D rotation, and nighttime city lights.
 */

import {
  WORLD_CONTINENTS,
  PRESET_OBSERVATORIES,
  MAJOR_CITIES
} from '../engine/world-geometry.js';

import {
  getSolarPosition,
  getTerminatorPoints,
  projectOrthographic,
  unprojectOrthographic
} from '../engine/astronomy.js';

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

    // Projection Mode: 'equirectangular' or 'orthographic'
    this.projectionMode = 'equirectangular';

    // 3D Globe camera orientation (center lon/lat)
    this.globeCenter = { lon: 0.0, lat: 20.0 };

    this.hoverCoord = null;
    this.onObserverChange = null;
    this.onOpenSkyDome = null;
    this.isDragging = false;
    this.dragStartPos = null;
    this.dragStartGlobe = null;
    this.totalDragDist = 0;
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

    // Invalidate cached shadow map so it recreates if needed
    this.shadowCanvas = null;
    this.shadowImageData = null;
  }

  setProjectionMode(mode) {
    this.projectionMode = mode === 'orthographic' ? 'orthographic' : 'equirectangular';
    if (this.projectionMode === 'orthographic') {
      // Center globe on current observer initially
      this.globeCenter.lon = this.observer.lon;
      this.globeCenter.lat = Math.max(-60, Math.min(60, this.observer.lat));
    }
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
    const getCanvasPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        clientX: e.clientX - rect.left,
        clientY: e.clientY - rect.top,
        rectW: rect.width,
        rectH: rect.height
      };
    };

    this.canvas.addEventListener('mousedown', (e) => {
      const p = getCanvasPos(e);
      this.isDragging = true;
      this.dragStartPos = { x: p.clientX, y: p.clientY };
      this.dragStartGlobe = { lon: this.globeCenter.lon, lat: this.globeCenter.lat };
      this.totalDragDist = 0;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const p = getCanvasPos(e);

      if (this.projectionMode === 'orthographic') {
        const cx = p.rectW / 2;
        const cy = p.rectH / 2;
        const radius = Math.min(p.rectW, p.rectH) * 0.42;
        const relX = p.clientX - cx;
        const relY = p.clientY - cy;

        if (this.isDragging && this.dragStartPos) {
          const dx = p.clientX - this.dragStartPos.x;
          const dy = p.clientY - this.dragStartPos.y;
          this.totalDragDist += Math.abs(dx) + Math.abs(dy);

          // Rotate 3D globe smoothly with drag
          const sens = 0.5;
          let newLon = this.dragStartGlobe.lon - dx * sens;
          let newLat = this.dragStartGlobe.lat + dy * sens;

          while (newLon > 180) newLon -= 360;
          while (newLon < -180) newLon += 360;
          newLat = Math.max(-85, Math.min(85, newLat));

          this.globeCenter.lon = newLon;
          this.globeCenter.lat = newLat;
        } else {
          // Hover raycasting
          const hit = unprojectOrthographic(relX, relY, this.globeCenter.lon, this.globeCenter.lat, radius);
          this.hoverCoord = hit.hit ? { lat: hit.lat, lon: hit.lon } : null;
        }
      } else {
        // 2D Equirectangular
        const lon = (p.clientX / p.rectW) * 360 - 180;
        const lat = 90 - (p.clientY / p.rectH) * 180;
        this.hoverCoord = {
          lat: Math.max(-90, Math.min(90, lat)),
          lon: Math.max(-180, Math.min(180, lon))
        };

        if (this.isDragging) {
          if (this.dragStartPos) {
            const dx = p.clientX - this.dragStartPos.x;
            const dy = p.clientY - this.dragStartPos.y;
            this.totalDragDist += Math.abs(dx) + Math.abs(dy);
          }
          this.setObserver(this.hoverCoord.lat, this.hoverCoord.lon, 'Selected Position');
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.isDragging) return;
      const p = getCanvasPos(e);
      const isClick = this.totalDragDist < 6;

      if (this.projectionMode === 'orthographic') {
        if (isClick) {
          const cx = p.rectW / 2;
          const cy = p.rectH / 2;
          const radius = Math.min(p.rectW, p.rectH) * 0.41;
          const relX = p.clientX - cx;
          const relY = p.clientY - cy;

          const hit = unprojectOrthographic(relX, relY, this.globeCenter.lon, this.globeCenter.lat, radius);
          if (hit.hit) {
            // Check if clicking close to any preset observatory
            let targetObs = null;
            let minDist = 16;
            for (const obs of PRESET_OBSERVATORIES) {
              const proj = projectOrthographic(obs.lon, obs.lat, this.globeCenter.lon, this.globeCenter.lat, radius);
              if (proj.visible) {
                const dist = Math.hypot(proj.x - relX, proj.y - relY);
                if (dist < minDist) {
                  minDist = dist;
                  targetObs = obs;
                }
              }
            }

            if (targetObs) {
              this.setObserver(targetObs.lat, targetObs.lon, targetObs.name);
            } else {
              this.setObserver(hit.lat, hit.lon, 'Selected Position');
            }

            if (this.onOpenSkyDome) {
              this.onOpenSkyDome(this.observer);
            }
          }
        }
      } else {
        // 2D Equirectangular
        if (isClick) {
          const lon = (p.clientX / p.rectW) * 360 - 180;
          const lat = 90 - (p.clientY / p.rectH) * 180;
          let targetObs = null;
          let minDist = 16;
          for (const obs of PRESET_OBSERVATORIES) {
            const [ox, oy] = [((obs.lon + 180) / 360) * p.rectW, ((90 - obs.lat) / 180) * p.rectH];
            const dist = Math.hypot(ox - p.clientX, oy - p.clientY);
            if (dist < minDist) {
              minDist = dist;
              targetObs = obs;
            }
          }

          if (targetObs) {
            this.setObserver(targetObs.lat, targetObs.lon, targetObs.name);
          } else {
            this.setObserver(lat, lon, 'Selected Position');
          }

          if (this.onOpenSkyDome) {
            this.onOpenSkyDome(this.observer);
          }
        }
      }

      this.isDragging = false;
      this.dragStartPos = null;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverCoord = null;
      this.isDragging = false;
    });
  }

  /**
   * Project geographic coordinates [lon, lat] to Canvas coordinates [x, y] in 2D mode.
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

    if (this.projectionMode === 'orthographic') {
      this.renderOrthographicGlobe(ctx, date, w, h, dpr);
    } else {
      this.renderEquirectangular(ctx, date, w, h, dpr);
    }

    ctx.restore();
  }

  /* ==========================================================================
     2D EQUIRECTANGULAR PROJECTION
     ========================================================================== */
  renderEquirectangular(ctx, date, w, h, dpr) {
    const opt = this.options;

    // 1. Ocean Background
    ctx.fillStyle = opt.oceanFill;
    ctx.fillRect(0, 0, w, h);

    // 2. Graticule Lines
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
    this.drawObservatoryFrame(ctx, w, h, dpr, 'EQUIRECTANGULAR');
  }

  /* ==========================================================================
     3D ORTHOGRAPHIC SPHERICAL GLOBE PROJECTION
     ========================================================================== */
  renderOrthographicGlobe(ctx, date, w, h, dpr) {
    const opt = this.options;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.41;
    const centerLon = this.globeCenter.lon;
    const centerLat = this.globeCenter.lat;

    const { subsolarPoint } = getSolarPosition(date);
    const sunPhiRad = subsolarPoint.latitudeDeg * (Math.PI / 180);
    const sunLamRad = subsolarPoint.longitudeDeg * (Math.PI / 180);

    // 1. Deep space backdrop with subtle stars
    ctx.fillStyle = '#06080d';
    ctx.fillRect(0, 0, w, h);

    // 2. Atmospheric Outer Limb Glow (Aerospace cyan luminescence)
    const limbGrad = ctx.createRadialGradient(cx, cy, radius * 0.95, cx, cy, radius * 1.07);
    limbGrad.addColorStop(0, 'rgba(79, 164, 232, 0.45)');
    limbGrad.addColorStop(0.5, 'rgba(79, 164, 232, 0.18)');
    limbGrad.addColorStop(1, 'rgba(79, 164, 232, 0)');

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.07, 0, Math.PI * 2);
    ctx.fillStyle = limbGrad;
    ctx.fill();

    // 3. Spherical Ocean Base (Clip to Globe)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // Deep oceanic gradient
    const oceanGrad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
    oceanGrad.addColorStop(0, '#101726');
    oceanGrad.addColorStop(0.7, '#0a0f1c');
    oceanGrad.addColorStop(1, '#060912');
    ctx.fillStyle = oceanGrad;
    ctx.fill();

    // 4. 3D Projected Graticule
    this.drawOrthographicGraticule(ctx, cx, cy, radius, centerLon, centerLat, dpr);

    // 5. 3D Projected Continents
    this.drawOrthographicContinents(ctx, cx, cy, radius, centerLon, centerLat, dpr);

    // 6. 3D Spherical Day/Night Shadow Terminator
    this.drawOrthographicDayNight(ctx, cx, cy, radius, centerLon, centerLat, sunPhiRad, sunLamRad);

    // 7. City Lights Glowing on Night Side of Earth
    this.drawOrthographicCityLights(ctx, cx, cy, radius, centerLon, centerLat, sunPhiRad, sunLamRad, dpr);

    // 8. Preset Observatories on 3D Globe
    for (const obs of PRESET_OBSERVATORIES) {
      if (Math.abs(obs.lat - this.observer.lat) < 0.1 && Math.abs(obs.lon - this.observer.lon) < 0.1) {
        continue;
      }
      const proj = projectOrthographic(obs.lon, obs.lat, centerLon, centerLat, radius);
      if (proj.visible) {
        ctx.beginPath();
        ctx.arc(cx + proj.x, cy + proj.y, 2.0 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(216, 226, 236, 0.55)';
        ctx.fill();
      }
    }

    // 9. 3D Subsolar Zenith Reticle on Globe
    const projSun = projectOrthographic(subsolarPoint.longitudeDeg, subsolarPoint.latitudeDeg, centerLon, centerLat, radius);
    if (projSun.visible) {
      this.drawGlobeSunMarker(ctx, cx + projSun.x, cy + projSun.y, dpr);
    }

    // 10. 3D Observer Crosshairs on Globe
    const projObs = projectOrthographic(this.observer.lon, this.observer.lat, centerLon, centerLat, radius);
    if (projObs.visible) {
      this.drawGlobeObserverMarker(ctx, cx + projObs.x, cy + projObs.y, dpr);
    }

    ctx.restore(); // End globe clip

    // 10. Outer Titanium & Platinum Horological Bezel Ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = opt.primaryGold;
    ctx.lineWidth = 1.8 * dpr;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius + 3 * dpr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(216, 226, 236, 0.25)';
    ctx.lineWidth = 0.8 * dpr;
    ctx.stroke();

    this.drawObservatoryFrame(ctx, w, h, dpr, '3D ORTHOGRAPHIC GLOBE');
  }

  drawOrthographicGraticule(ctx, cx, cy, radius, centerLon, centerLat, dpr) {
    const opt = this.options;
    ctx.lineWidth = 0.6 * dpr;

    // Projected Parallels every 30°
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let hasStarted = false;
      for (let lon = -180; lon <= 180; lon += 4) {
        const p = projectOrthographic(lon, lat, centerLon, centerLat, radius);
        if (p.visible) {
          if (!hasStarted) {
            ctx.moveTo(cx + p.x, cy + p.y);
            hasStarted = true;
          } else {
            ctx.lineTo(cx + p.x, cy + p.y);
          }
        } else {
          hasStarted = false;
        }
      }
      ctx.strokeStyle = lat === 0 ? opt.equatorColor : opt.gridColor;
      ctx.stroke();
    }

    // Projected Meridians every 30°
    for (let lon = -180; lon < 180; lon += 30) {
      ctx.beginPath();
      let hasStarted = false;
      for (let lat = -88; lat <= 88; lat += 3) {
        const p = projectOrthographic(lon, lat, centerLon, centerLat, radius);
        if (p.visible) {
          if (!hasStarted) {
            ctx.moveTo(cx + p.x, cy + p.y);
            hasStarted = true;
          } else {
            ctx.lineTo(cx + p.x, cy + p.y);
          }
        } else {
          hasStarted = false;
        }
      }
      ctx.strokeStyle = lon === 0 ? 'rgba(200, 170, 110, 0.35)' : opt.gridColor;
      ctx.stroke();
    }
  }

  drawOrthographicContinents(ctx, cx, cy, radius, centerLon, centerLat, dpr) {
    const opt = this.options;
    ctx.fillStyle = opt.landFill;
    ctx.strokeStyle = opt.landBorder;
    ctx.lineWidth = 0.9 * dpr;

    for (const poly of WORLD_CONTINENTS) {
      ctx.beginPath();
      let started = false;

      for (let i = 0; i < poly.length; i++) {
        const [lon, lat] = poly[i];
        const p = projectOrthographic(lon, lat, centerLon, centerLat, radius);

        if (p.visible) {
          if (!started) {
            ctx.moveTo(cx + p.x, cy + p.y);
            started = true;
          } else {
            ctx.lineTo(cx + p.x, cy + p.y);
          }
        } else {
          started = false;
        }
      }
      ctx.fill();
      ctx.stroke();
    }
  }

  drawOrthographicDayNight(ctx, cx, cy, radius, centerLon, centerLat, sunPhiRad, sunLamRad) {
    // Render spherical day/night shadow using an offscreen grid buffer
    if (!this.orthoShadowCanvas) {
      this.orthoShadowW = 160;
      this.orthoShadowH = 160;
      this.orthoShadowCanvas = document.createElement('canvas');
      this.orthoShadowCanvas.width = this.orthoShadowW;
      this.orthoShadowCanvas.height = this.orthoShadowH;
      this.orthoShadowCtx = this.orthoShadowCanvas.getContext('2d');
      this.orthoShadowData = this.orthoShadowCtx.createImageData(this.orthoShadowW, this.orthoShadowH);
    }

    const sw = this.orthoShadowW;
    const sh = this.orthoShadowH;
    const sRadius = sw / 2;
    const buf = this.orthoShadowData.data;

    const sinPhiS = Math.sin(sunPhiRad);
    const cosPhiS = Math.cos(sunPhiRad);

    for (let py = 0; py < sh; py++) {
      const relY = py - sRadius;
      const rowOffset = py * sw * 4;

      for (let px = 0; px < sw; px++) {
        const relX = px - sRadius;
        const idx = rowOffset + px * 4;

        // Check if inside globe sphere
        const rho = Math.sqrt(relX * relX + relY * relY);
        if (rho > sRadius) {
          buf[idx + 3] = 0;
          continue;
        }

        // Raycast back to (lon, lat)
        const hit = unprojectOrthographic(relX, relY, centerLon, centerLat, sRadius);
        if (!hit.hit) {
          buf[idx + 3] = 0;
          continue;
        }

        const phi = hit.lat * (Math.PI / 180);
        const lam = hit.lon * (Math.PI / 180);
        const sinAlt = Math.sin(phi) * sinPhiS + Math.cos(phi) * cosPhiS * Math.cos(lam - sunLamRad);

        if (sinAlt >= 0.08) {
          // Daylight
          buf[idx + 3] = 0;
        } else if (sinAlt > 0) {
          // Golden hour
          buf[idx] = 200;
          buf[idx + 1] = 170;
          buf[idx + 2] = 110;
          buf[idx + 3] = Math.round((1 - sinAlt / 0.08) * 35);
        } else if (sinAlt >= -0.1045) {
          // Civil twilight
          buf[idx] = 8;
          buf[idx + 1] = 12;
          buf[idx + 2] = 28;
          buf[idx + 3] = Math.round(50 + (-sinAlt / 0.1045) * 60);
        } else if (sinAlt >= -0.2079) {
          // Nautical twilight
          buf[idx] = 6;
          buf[idx + 1] = 9;
          buf[idx + 2] = 20;
          buf[idx + 3] = Math.round(110 + ((-sinAlt - 0.1045) / 0.1034) * 55);
        } else {
          // Full nocturnal night
          buf[idx] = 4;
          buf[idx + 1] = 5;
          buf[idx + 2] = 12;
          buf[idx + 3] = 215;
        }
      }
    }

    this.orthoShadowCtx.putImageData(this.orthoShadowData, 0, 0);

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.orthoShadowCanvas, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  drawOrthographicCityLights(ctx, cx, cy, radius, centerLon, centerLat, sunPhiRad, sunLamRad, dpr) {
    const sinPhiS = Math.sin(sunPhiRad);
    const cosPhiS = Math.cos(sunPhiRad);

    ctx.save();
    for (const city of MAJOR_CITIES) {
      const p = projectOrthographic(city.lon, city.lat, centerLon, centerLat, radius);
      if (!p.visible) continue;

      // Check if city is on the night hemisphere
      const phi = city.lat * (Math.PI / 180);
      const lam = city.lon * (Math.PI / 180);
      const sinAlt = Math.sin(phi) * sinPhiS + Math.cos(phi) * cosPhiS * Math.cos(lam - sunLamRad);

      if (sinAlt < -0.05) {
        // Darkness intensity factor
        const darkness = Math.min(1.0, (-sinAlt - 0.05) / 0.15);
        const cityR = (1.5 * city.weight) * dpr;

        // Warm golden incandescent city light
        ctx.beginPath();
        ctx.arc(cx + p.x, cy + p.y, cityR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 224, 130, ${0.75 * darkness})`;
        ctx.shadowColor = '#ffca28';
        ctx.shadowBlur = 6 * dpr;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawGlobeSunMarker(ctx, sx, sy, dpr) {
    ctx.save();
    const sunGrad = ctx.createRadialGradient(sx, sy, 1 * dpr, sx, sy, 10 * dpr);
    sunGrad.addColorStop(0, '#ffffff');
    sunGrad.addColorStop(0.4, '#c8aa6e');
    sunGrad.addColorStop(1, 'rgba(200, 170, 110, 0)');

    ctx.beginPath();
    ctx.arc(sx, sy, 10 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sx, sy, 3 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }

  drawGlobeObserverMarker(ctx, ox, oy, dpr) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ox, oy, 7 * dpr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200, 170, 110, 0.85)';
    ctx.lineWidth = 1.4 * dpr;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(ox, oy, 2.5 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Crosshairs
    ctx.strokeStyle = '#e8ca8e';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.moveTo(ox - 10 * dpr, oy);
    ctx.lineTo(ox - 6 * dpr, oy);
    ctx.moveTo(ox + 6 * dpr, oy);
    ctx.lineTo(ox + 10 * dpr, oy);
    ctx.moveTo(ox, oy - 10 * dpr);
    ctx.lineTo(ox, oy - 6 * dpr);
    ctx.moveTo(ox, oy + 6 * dpr);
    ctx.lineTo(ox, oy + 10 * dpr);
    ctx.stroke();

    ctx.fillStyle = '#e8ca8e';
    ctx.font = `600 ${Math.round(8 * dpr)}px "Space Mono", monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(`⌖ ${this.observer.name}`, ox + 9 * dpr, oy - 7 * dpr);
    ctx.restore();
  }

  /* ==========================================================================
     SHARED HELPERS (Graticule, Frame, Telemetry)
     ========================================================================== */
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

          if (sinAlt >= 0.1045) {
            buf[idx + 3] = 0;
          } else if (sinAlt > 0) {
            buf[idx] = 200;
            buf[idx + 1] = 170;
            buf[idx + 2] = 110;
            buf[idx + 3] = Math.round((1 - sinAlt / 0.1045) * 30);
          } else if (sinAlt >= -0.1045) {
            buf[idx] = 10;
            buf[idx + 1] = 16;
            buf[idx + 2] = 32;
            buf[idx + 3] = Math.round(50 + (-sinAlt / 0.1045) * 60);
          } else if (sinAlt >= -0.2079) {
            buf[idx] = 7;
            buf[idx + 1] = 10;
            buf[idx + 2] = 22;
            buf[idx + 3] = Math.round(110 + ((-sinAlt - 0.1045) / 0.1034) * 55);
          } else if (sinAlt >= -0.3090) {
            buf[idx] = 5;
            buf[idx + 1] = 7;
            buf[idx + 2] = 16;
            buf[idx + 3] = Math.round(165 + ((-sinAlt - 0.2079) / 0.1011) * 35);
          } else {
            buf[idx] = 4;
            buf[idx + 1] = 5;
            buf[idx + 2] = 11;
            buf[idx + 3] = 215;
          }
        }
      }

      this.shadowCtx.putImageData(this.shadowImageData, 0, 0);

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.shadowCanvas, 0, 0, w, h);
      ctx.restore();
    }

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

  drawGraticule(ctx, w, h) {
    const opt = this.options;
    const dpr = this.dpr;
    ctx.lineWidth = 0.5 * dpr;

    for (let lon = -180; lon <= 180; lon += 15) {
      const [x] = this.project(lon, 0);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.strokeStyle = lon === 0 ? 'rgba(200, 170, 110, 0.4)' : opt.gridColor;
      ctx.stroke();
    }

    for (let lat = -75; lat <= 75; lat += 15) {
      const [, y] = this.project(0, lat);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.strokeStyle = opt.gridColor;
      ctx.stroke();
    }

    const [, eqY] = this.project(0, 0);
    ctx.beginPath();
    ctx.moveTo(0, eqY);
    ctx.lineTo(w, eqY);
    ctx.strokeStyle = opt.equatorColor;
    ctx.lineWidth = 1 * dpr;
    ctx.stroke();
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

  drawPresetObservatories(ctx, dpr) {
    for (const obs of PRESET_OBSERVATORIES) {
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

    ctx.save();
    ctx.translate(sunX, sunY);

    const sunGrad = ctx.createRadialGradient(0, 0, 1 * dpr, 0, 0, 8 * dpr);
    sunGrad.addColorStop(0, '#fff4d0');
    sunGrad.addColorStop(0.4, '#c8aa6e');
    sunGrad.addColorStop(1, 'rgba(200, 170, 110, 0)');

    ctx.beginPath();
    ctx.arc(0, 0, 8 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 2.5 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

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
  }

  drawObserver(ctx, dpr) {
    const [x, y] = this.project(this.observer.lon, this.observer.lat);

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 7 * dpr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200, 170, 110, 0.7)';
    ctx.lineWidth = 1.2 * dpr;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, 2.5 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

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

    ctx.fillStyle = '#e8ca8e';
    ctx.font = `600 ${Math.round(8 * dpr)}px "Space Mono", monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`⌖ ${this.observer.name}`, x + 9 * dpr, y - 8 * dpr);

    ctx.restore();
  }

  drawObservatoryFrame(ctx, w, h, dpr, projectionLabel) {
    const opt = this.options;

    ctx.strokeStyle = 'rgba(216, 226, 236, 0.16)';
    ctx.lineWidth = 1 * dpr;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    const bracketSize = 10 * dpr;
    ctx.strokeStyle = opt.primaryGold;
    ctx.lineWidth = 1.5 * dpr;

    ctx.beginPath();
    ctx.moveTo(0.5, bracketSize);
    ctx.lineTo(0.5, 0.5);
    ctx.lineTo(bracketSize, 0.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w - bracketSize, 0.5);
    ctx.lineTo(w - 0.5, 0.5);
    ctx.lineTo(w - 0.5, bracketSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0.5, h - bracketSize);
    ctx.lineTo(0.5, h - 0.5);
    ctx.lineTo(bracketSize, h - 0.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w - bracketSize, h - 0.5);
    ctx.lineTo(w - 0.5, h - 0.5);
    ctx.lineTo(w - 0.5, h - bracketSize);
    ctx.stroke();

    ctx.fillStyle = 'rgba(200, 170, 110, 0.8)';
    ctx.font = `600 ${Math.round(7 * dpr)}px "Space Mono", monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`SOLAR TERMINATOR OBSERVATORY // ${projectionLabel}`, w - 14 * dpr, 6 * dpr);
  }
}
