/**
 * Meridian Chronometer — Time Controller
 * Coordinates system realtime synchronization, simulated time progression,
 * scrub timeline manipulation, acceleration multipliers, and change listener subscriptions.
 */

export class TimeController {
  constructor(initialDate = null) {
    this.isRealtime = !initialDate;
    this.simulatedTimeMs = initialDate ? new Date(initialDate).getTime() : Date.now();
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
    this.isRealtime = false;
    this.simulatedTimeMs = dateOrMs instanceof Date ? dateOrMs.getTime() : Number(dateOrMs);
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
    this.speedMultiplier = Math.max(0.1, Number(multiplier) || 1);
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
    this.direction = direction < 0 ? -1 : 1;
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
    this.simulatedTimeMs += deltaSeconds * 1000;
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
      const deltaSimMs = realElapsedMs * this.speedMultiplier * this.direction;
      this.simulatedTimeMs += deltaSimMs;
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
