/**
 * Meridian Chronometer — Time Controller
 * Coordinates system realtime synchronization, simulated time progression,
 * scrub timeline manipulation, acceleration multipliers, and change listener subscriptions.
 */

export class TimeController {
  constructor(initialDate = null) {
    this.isRealtime = !initialDate;
    let initialMs = Date.now();
    if (initialDate) {
      const parsed = initialDate instanceof Date ? initialDate.getTime() : new Date(initialDate).getTime();
      if (Number.isFinite(parsed)) initialMs = parsed;
    }
    this.simulatedTimeMs = initialMs;
    this.speedMultiplier = 1;
    this.direction = 1; // 1 = forward, -1 = reverse
    this.isPlaying = true;
    this.subscribers = new Set();
    this.lastRealTimestamp = null;
  }

  /**
   * Retrieves current chronometer time as Date object.
   */
  getTime() {
    if (this.isRealtime) {
      return new Date();
    }
    return new Date(this.simulatedTimeMs);
  }

  /**
   * Directly sets the current chronometer time (switches to simulated mode).
   */
  setTime(dateOrMs) {
    const ms = dateOrMs instanceof Date ? dateOrMs.getTime() : Number(dateOrMs);
    if (!Number.isFinite(ms)) {
      return;
    }
    this.isRealtime = false;
    this.simulatedTimeMs = Math.max(-8.64e15, Math.min(8.64e15, ms));
    this.notify();
  }

  /**
   * Re-synchronizes chronometer with real system clock.
   */
  syncRealtime() {
    this.isRealtime = true;
    this.simulatedTimeMs = Date.now();
    this.speedMultiplier = 1;
    this.direction = 1;
    this.isPlaying = true;
    this.notify();
  }

  /**
   * Sets simulation speed multiplier (e.g. 1, 60, 3600, 86400).
   */
  setSpeed(multiplier) {
    let speed = Number(multiplier);
    if (!Number.isFinite(speed) || speed < 0.1) {
      speed = 1;
    }
    this.speedMultiplier = Math.max(0.1, speed);
    if (this.speedMultiplier !== 1 && this.isRealtime) {
      // Switching to accelerated speed automatically moves from realtime to simulated
      this.isRealtime = false;
      this.simulatedTimeMs = Date.now();
    }
    this.notify();
  }

  /**
   * Sets playback direction: +1 for forward, -1 for backward.
   */
  setDirection(direction) {
    const d = Number(direction);
    this.direction = Number.isFinite(d) && d < 0 ? -1 : 1;
    if (this.direction !== 1 && this.isRealtime) {
      this.isRealtime = false;
      this.simulatedTimeMs = Date.now();
    }
    this.notify();
  }

  /**
   * Pauses progression.
   */
  pause() {
    if (this.isRealtime) {
      this.simulatedTimeMs = Date.now();
      this.isRealtime = false;
    }
    this.isPlaying = false;
    this.notify();
  }

  /**
   * Resumes progression.
   */
  play() {
    this.isPlaying = true;
    this.notify();
  }

  /**
   * Toggles play/pause state.
   */
  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Steps forward or backward by a specific number of seconds.
   */
  step(deltaSeconds) {
    if (this.isRealtime) {
      this.simulatedTimeMs = Date.now();
      this.isRealtime = false;
    }
    const delta = Number(deltaSeconds);
    if (Number.isFinite(delta)) {
      this.simulatedTimeMs = Math.max(-8.64e15, Math.min(8.64e15, this.simulatedTimeMs + delta * 1000));
    }
    this.notify();
  }

  /**
   * Advances time based on elapsed real-world milliseconds.
   */
  tick(realElapsedMs) {
    if (!this.isPlaying) return;

    if (this.isRealtime) {
      this.simulatedTimeMs = Date.now();
    } else {
      const elapsed = Number(realElapsedMs);
      if (Number.isFinite(elapsed)) {
        const deltaSimMs = elapsed * this.speedMultiplier * this.direction;
        if (Number.isFinite(deltaSimMs)) {
          this.simulatedTimeMs = Math.max(-8.64e15, Math.min(8.64e15, this.simulatedTimeMs + deltaSimMs));
        }
      }
    }

    this.notify();
  }

  /**
   * Subscribe to time updates. Returns unsubscribe function.
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    const time = this.getTime();
    for (const callback of this.subscribers) {
      try {
        callback(time, this);
      } catch (err) {
        console.error('TimeController notification error:', err);
      }
    }
  }
}
