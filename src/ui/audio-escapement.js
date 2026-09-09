/**
 * Meridian Chronometer — Mechanical Escapement Synthesizer
 * Uses Web Audio API to create authentic, subtle horological ticking sound.
 * Zero external audio assets required.
 */

export class EscapementAudio {
  constructor() {
    this.ctx = null;
    this.isEnabled = false;
    this.volume = 0.15;
    this.lastTickSec = -1;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.init();
    this.isEnabled = !this.isEnabled;
    return this.isEnabled;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  /**
   * Triggers a subtle mechanical tick-tock impulse.
   * alternates pitch slightly for realistic anchor pallet jewel striking escape wheel tooth.
   */
  tick(isTock = false) {
    if (!this.isEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // High-frequency mechanical resonant metallic impulse
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isTock ? 3200 : 3800, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.008);

      // Sharp exponential decay envelope (6-8ms duration)
      gain.gain.setValueAtTime(this.volume * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.009);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.01);
    } catch {
      // AudioContext unavailable or blocked
    }
  }
}
