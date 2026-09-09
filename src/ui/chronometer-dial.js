/**
 * Meridian Chronometer — Main Chronometer Dial
 * High-precision luxury astronomical horological dial.
 * Renders 24-hour UTC, Local Apparent Solar Time, and Sidereal Time with continuous sweeping hands.
 */

export class ChronometerDial {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.options = {
      primaryGold: '#c8aa6e',
      goldLight: '#e8ca8e',
      goldDark: '#8f7645',
      platinum: '#d8e2ec',
      platinumMuted: 'rgba(216, 226, 236, 0.35)',
      siderealBlue: '#4fa4e8',
      obsidian: '#090a0f',
      dialPlate: '#0e1118',
      ...options
    };

    this.width = 0;
    this.height = 0;
    this.radius = 0;
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width || 380;
    this.height = rect.height || 380;
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.radius = (Math.min(this.width, this.height) / 2) * 0.94;
  }

  /**
   * Renders the complete chronometer dial with current astronomical times.
   * @param {Object} times
   *   times.utcDate: Date
   *   times.solarApparentHours: number [0, 24)
   *   times.siderealHours: number [0, 24)
   */
  render(times) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = this.radius * dpr;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Outer Dial Plate & Bezel
    this.drawBezel(ctx, cx, cy, r);

    // Concentric Chapter Rings
    this.drawUtcChapterRing(ctx, cx, cy, r);
    this.drawSolarRing(ctx, cx, cy, r * 0.72);
    this.drawSiderealSubdial(ctx, cx, cy, r * 0.44);

    // Mechanical Hands (drawn from bottom layer to top)
    // 1. Sidereal Time Hand (Blued steel / Azure)
    this.drawSiderealHand(ctx, cx, cy, r * 0.42, times.siderealHours);

    // 2. Local Solar Time Hand (Meridian Gold)
    this.drawSolarHand(ctx, cx, cy, r * 0.60, times.solarApparentHours);

    // 3. UTC 24-Hour Hand (Faceted Platinum Baton)
    const utcHours24 =
      times.utcDate.getUTCHours() +
      times.utcDate.getUTCMinutes() / 60.0 +
      times.utcDate.getUTCSeconds() / 3600.0 +
      times.utcDate.getUTCMilliseconds() / 3600000.0;
    this.drawUtcHand(ctx, cx, cy, r * 0.68, utcHours24);

    // 4. 60-Minute Hand (Slender Breguet Platinum Hand)
    const utcMinutes =
      times.utcDate.getUTCMinutes() +
      times.utcDate.getUTCSeconds() / 60.0 +
      times.utcDate.getUTCMilliseconds() / 60000.0;
    this.drawMinuteHand(ctx, cx, cy, r * 0.86, utcMinutes);

    // 5. Sweeping Continuous Seconds Hand
    const utcSeconds = times.utcDate.getUTCSeconds() + times.utcDate.getUTCMilliseconds() / 1000.0;
    this.drawSecondsHand(ctx, cx, cy, r * 0.90, utcSeconds);

    // Center Jewel Pinion Cap
    this.drawCenterPinion(ctx, cx, cy, r);

    ctx.restore();
  }

  drawBezel(ctx, cx, cy, r) {
    const opt = this.options;

    // Dial background gradient
    const bgGrad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    bgGrad.addColorStop(0, '#131824');
    bgGrad.addColorStop(0.7, '#0b0e14');
    bgGrad.addColorStop(1, '#07080c');

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // Outer machined titanium & platinum rings
    ctx.lineWidth = Math.max(1, 2 * this.dpr);
    ctx.strokeStyle = opt.primaryGold;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r - 3 * this.dpr, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(0.5, 0.75 * this.dpr);
    ctx.strokeStyle = 'rgba(216, 226, 236, 0.25)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r - 7 * this.dpr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200, 170, 110, 0.18)';
    ctx.stroke();
  }

  drawUtcChapterRing(ctx, cx, cy, r) {
    const opt = this.options;
    const dpr = this.dpr;

    ctx.save();
    // 24 Hour graduations around the outer bezel
    // 0h / 24h at top (zenith)
    for (let h = 0; h < 24; h++) {
      const angle = (h / 24) * Math.PI * 2 - Math.PI / 2;
      const isMajor = h % 3 === 0;
      const tickLength = (isMajor ? 8 : 4.5) * dpr;

      const x1 = cx + Math.cos(angle) * (r - 9 * dpr);
      const y1 = cy + Math.sin(angle) * (r - 9 * dpr);
      const x2 = cx + Math.cos(angle) * (r - 9 * dpr - tickLength);
      const y2 = cy + Math.sin(angle) * (r - 9 * dpr - tickLength);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = (isMajor ? 1.5 : 0.8) * dpr;
      ctx.strokeStyle = isMajor ? opt.primaryGold : opt.platinumMuted;
      ctx.stroke();

      // Numerals at major 24h marks
      if (isMajor) {
        const textR = r - 22 * dpr;
        const tx = cx + Math.cos(angle) * textR;
        const ty = cy + Math.sin(angle) * textR;

        ctx.fillStyle = opt.platinum;
        ctx.font = `600 ${Math.round(9 * dpr)}px "Cinzel", "Times New Roman", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(h).padStart(2, '0'), tx, ty);
      }
    }

    // 60-second micro-tick ring
    for (let s = 0; s < 60; s++) {
      if (s % 2.5 === 0) continue;
      const angle = (s / 60) * Math.PI * 2 - Math.PI / 2;
      const x1 = cx + Math.cos(angle) * (r - 10 * dpr);
      const y1 = cy + Math.sin(angle) * (r - 10 * dpr);
      const x2 = cx + Math.cos(angle) * (r - 12 * dpr);
      const y2 = cy + Math.sin(angle) * (r - 12 * dpr);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = 0.5 * dpr;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();
    }

    ctx.restore();
  }

  drawSolarRing(ctx, cx, cy, r) {
    const opt = this.options;
    const dpr = this.dpr;

    ctx.save();
    // Inner track circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200, 170, 110, 0.3)';
    ctx.lineWidth = 1 * dpr;
    ctx.setLineDash([2 * dpr, 4 * dpr]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Solar ticks and Roman numerals (XII at zenith)
    for (let h = 0; h < 24; h += 2) {
      const angle = (h / 24) * Math.PI * 2 - Math.PI / 2;
      const x1 = cx + Math.cos(angle) * r;
      const y1 = cy + Math.sin(angle) * r;
      const x2 = cx + Math.cos(angle) * (r - 5 * dpr);
      const y2 = cy + Math.sin(angle) * (r - 5 * dpr);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = 1 * dpr;
      ctx.strokeStyle = opt.primaryGold;
      ctx.stroke();

      if (h % 6 === 0) {
        const textR = r - 12 * dpr;
        const tx = cx + Math.cos(angle) * textR;
        const ty = cy + Math.sin(angle) * textR;
        ctx.fillStyle = opt.primaryGold;
        ctx.font = `500 ${Math.round(7.5 * dpr)}px "Space Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${h}h`, tx, ty);
      }
    }

    // "SOLAR" inscription
    ctx.fillStyle = 'rgba(200, 170, 110, 0.6)';
    ctx.font = `600 ${Math.round(6.5 * dpr)}px "Cinzel", serif`;
    ctx.textAlign = 'center';
    ctx.fillText('SOLAR APPARENT', cx, cy - r + 24 * dpr);

    ctx.restore();
  }

  drawSiderealSubdial(ctx, cx, cy, r) {
    const opt = this.options;
    const dpr = this.dpr;

    ctx.save();
    // Subdial plate
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, '#0c121d');
    grad.addColorStop(1, '#070a10');

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(79, 164, 232, 0.4)';
    ctx.lineWidth = 1 * dpr;
    ctx.stroke();

    // Sidereal 24h indices (Vernal equinox indicator ♈ at top)
    for (let h = 0; h < 24; h += 3) {
      const angle = (h / 24) * Math.PI * 2 - Math.PI / 2;
      const x1 = cx + Math.cos(angle) * (r - 2 * dpr);
      const y1 = cy + Math.sin(angle) * (r - 2 * dpr);
      const x2 = cx + Math.cos(angle) * (r - 6 * dpr);
      const y2 = cy + Math.sin(angle) * (r - 6 * dpr);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = 1 * dpr;
      ctx.strokeStyle = opt.siderealBlue;
      ctx.stroke();

      const textR = r - 12 * dpr;
      const tx = cx + Math.cos(angle) * textR;
      const ty = cy + Math.sin(angle) * textR;

      ctx.fillStyle = opt.siderealBlue;
      ctx.font = `600 ${Math.round(6.5 * dpr)}px "Space Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(h === 0 ? '♈' : `${h}`, tx, ty);
    }

    // "SIDEREAL" inscription
    ctx.fillStyle = 'rgba(79, 164, 232, 0.7)';
    ctx.font = `600 ${Math.round(6 * dpr)}px "Cinzel", serif`;
    ctx.textAlign = 'center';
    ctx.fillText('SIDEREAL LMST', cx, cy + r - 14 * dpr);

    ctx.restore();
  }

  drawSiderealHand(ctx, cx, cy, length, siderealHours) {
    const dpr = this.dpr;
    const angle = (siderealHours / 24.0) * Math.PI * 2 - Math.PI / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Azure blued-steel needle hand with star counterweight
    ctx.shadowColor = 'rgba(79, 164, 232, 0.4)';
    ctx.shadowBlur = 4 * dpr;

    ctx.beginPath();
    ctx.moveTo(0, 8 * dpr); // counterweight tail
    ctx.lineTo(-1.5 * dpr, 0);
    ctx.lineTo(-0.8 * dpr, -length);
    ctx.lineTo(0, -length - 4 * dpr); // pointed tip
    ctx.lineTo(0.8 * dpr, -length);
    ctx.lineTo(1.5 * dpr, 0);
    ctx.closePath();

    ctx.fillStyle = '#5fb3f8';
    ctx.fill();

    // Azure ring on tail
    ctx.beginPath();
    ctx.arc(0, 10 * dpr, 3 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#4fa4e8';
    ctx.fill();

    ctx.restore();
  }

  drawSolarHand(ctx, cx, cy, length, solarHours) {
    const opt = this.options;
    const dpr = this.dpr;
    const angle = (solarHours / 24.0) * Math.PI * 2 - Math.PI / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    ctx.shadowColor = 'rgba(200, 170, 110, 0.45)';
    ctx.shadowBlur = 6 * dpr;

    // Meridian Gold hand with solar motif
    // Hand shaft
    ctx.beginPath();
    ctx.moveTo(0, 12 * dpr);
    ctx.lineTo(-2 * dpr, 0);
    ctx.lineTo(-1.2 * dpr, -length + 14 * dpr);
    ctx.lineTo(0, -length);
    ctx.lineTo(1.2 * dpr, -length + 14 * dpr);
    ctx.lineTo(2 * dpr, 0);
    ctx.closePath();

    const goldGrad = ctx.createLinearGradient(-2 * dpr, 0, 2 * dpr, 0);
    goldGrad.addColorStop(0, opt.goldDark);
    goldGrad.addColorStop(0.5, opt.goldLight);
    goldGrad.addColorStop(1, opt.goldDark);

    ctx.fillStyle = goldGrad;
    ctx.fill();

    // Solar sunburst disc along the hand
    ctx.beginPath();
    ctx.arc(0, -length * 0.65, 4.5 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = opt.primaryGold;
    ctx.fill();
    ctx.strokeStyle = opt.goldLight;
    ctx.lineWidth = 1 * dpr;
    ctx.stroke();

    ctx.restore();
  }

  drawUtcHand(ctx, cx, cy, length, utcHours) {
    const opt = this.options;
    const dpr = this.dpr;
    const angle = (utcHours / 24.0) * Math.PI * 2 - Math.PI / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    ctx.shadowColor = 'rgba(255, 255, 255, 0.25)';
    ctx.shadowBlur = 4 * dpr;

    // Faceted platinum hand with open Breguet eye
    // Counterbalance tail
    ctx.beginPath();
    ctx.arc(0, 14 * dpr, 4 * dpr, 0, Math.PI * 2);
    ctx.strokeStyle = opt.platinum;
    ctx.lineWidth = 1.2 * dpr;
    ctx.stroke();

    // Main needle
    ctx.beginPath();
    ctx.moveTo(0, 10 * dpr);
    ctx.lineTo(-2.2 * dpr, 0);
    ctx.lineTo(-1.2 * dpr, -length * 0.7);
    ctx.arc(0, -length * 0.75, 3.5 * dpr, Math.PI / 2, -Math.PI / 2, true);
    ctx.lineTo(0, -length);
    ctx.lineTo(1.2 * dpr, -length * 0.7);
    ctx.lineTo(2.2 * dpr, 0);
    ctx.closePath();

    const platGrad = ctx.createLinearGradient(-2.2 * dpr, 0, 2.2 * dpr, 0);
    platGrad.addColorStop(0, '#a5b4c4');
    platGrad.addColorStop(0.5, '#ffffff');
    platGrad.addColorStop(1, '#8f9dae');

    ctx.fillStyle = platGrad;
    ctx.fill();

    ctx.restore();
  }

  drawMinuteHand(ctx, cx, cy, length, minutes) {
    const dpr = this.dpr;
    const angle = (minutes / 60.0) * Math.PI * 2 - Math.PI / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    ctx.shadowColor = 'rgba(216, 226, 236, 0.35)';
    ctx.shadowBlur = 4 * dpr;

    // Slender Breguet faceted minute hand
    ctx.beginPath();
    ctx.moveTo(0, 14 * dpr);
    ctx.lineTo(-1.8 * dpr, 0);
    ctx.lineTo(-1.0 * dpr, -length * 0.72);
    ctx.arc(0, -length * 0.78, 3.2 * dpr, Math.PI / 2, -Math.PI / 2, true);
    ctx.lineTo(0, -length);
    ctx.lineTo(1.0 * dpr, -length * 0.72);
    ctx.lineTo(1.8 * dpr, 0);
    ctx.closePath();

    const minGrad = ctx.createLinearGradient(-1.8 * dpr, 0, 1.8 * dpr, 0);
    minGrad.addColorStop(0, '#c2cedb');
    minGrad.addColorStop(0.5, '#ffffff');
    minGrad.addColorStop(1, '#9ba9b8');

    ctx.fillStyle = minGrad;
    ctx.fill();

    // Pear counterweight
    ctx.beginPath();
    ctx.arc(0, 14 * dpr, 2.5 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  drawSecondsHand(ctx, cx, cy, length, seconds) {
    const dpr = this.dpr;
    const angle = (seconds / 60.0) * Math.PI * 2 - Math.PI / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // High-precision sweeping needle
    ctx.beginPath();
    ctx.moveTo(0, 16 * dpr); // counterweight tail
    ctx.lineTo(0, -length);
    ctx.lineWidth = 0.9 * dpr;
    ctx.strokeStyle = '#e27d60'; // warm flame-treated terracotta
    ctx.stroke();

    // Counterweight circle
    ctx.beginPath();
    ctx.arc(0, 16 * dpr, 2.5 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#e27d60';
    ctx.fill();

    ctx.restore();
  }

  drawCenterPinion(ctx, cx, cy, r) {
    const opt = this.options;
    const dpr = this.dpr;

    // Gold collar
    ctx.beginPath();
    ctx.arc(cx, cy, 6 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = opt.primaryGold;
    ctx.fill();
    ctx.strokeStyle = opt.goldLight;
    ctx.lineWidth = 1 * dpr;
    ctx.stroke();

    // Synthetic ruby / sapphire horological jewel cap
    const jewelGrad = ctx.createRadialGradient(cx - 1 * dpr, cy - 1 * dpr, 0.5 * dpr, cx, cy, 4 * dpr);
    jewelGrad.addColorStop(0, '#ff476e');
    jewelGrad.addColorStop(0.6, '#96112e');
    jewelGrad.addColorStop(1, '#4a0514');

    ctx.beginPath();
    ctx.arc(cx, cy, 3.5 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = jewelGrad;
    ctx.fill();
  }
}
