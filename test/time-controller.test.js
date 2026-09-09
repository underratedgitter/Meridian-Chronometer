import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TimeController } from '../src/engine/time-controller.js';

describe('TimeController Engine', () => {
  it('initializes with current time in realtime mode', () => {
    const controller = new TimeController();
    assert.equal(controller.isRealtime, true);
    assert.equal(controller.speedMultiplier, 1);
    assert.equal(controller.isPlaying, true);
    const now = Date.now();
    assert.ok(Math.abs(controller.getTime().getTime() - now) < 100);
  });

  it('allows jumping to custom epoch and enters simulated mode', () => {
    const controller = new TimeController();
    const targetDate = new Date('2024-06-20T20:51:00Z');
    controller.setTime(targetDate);

    assert.equal(controller.isRealtime, false);
    assert.equal(controller.getTime().getTime(), targetDate.getTime());
  });

  it('resets back to realtime when syncRealtime is called', () => {
    const controller = new TimeController();
    controller.setTime(new Date('1969-07-20T20:17:40Z'));
    assert.equal(controller.isRealtime, false);

    controller.syncRealtime();
    assert.equal(controller.isRealtime, true);
    assert.ok(Math.abs(controller.getTime().getTime() - Date.now()) < 100);
  });

  it('advances simulated time correctly based on speed multiplier', () => {
    const controller = new TimeController();
    const base = new Date('2024-01-01T00:00:00Z');
    controller.setTime(base);
    controller.setSpeed(3600); // 1 real sec = 1 simulated hour

    // Simulate 1000ms elapsed in real time
    controller.tick(1000);
    const elapsedSimMs = controller.getTime().getTime() - base.getTime();
    // 1000ms * 3600 = 3600000ms = 1 hour
    assert.equal(elapsedSimMs, 3600000);
  });

  it('supports reverse playback direction', () => {
    const controller = new TimeController();
    const base = new Date('2024-01-01T12:00:00Z');
    controller.setTime(base);
    controller.setSpeed(60);
    controller.setDirection(-1);

    controller.tick(500); // 500ms real time * 60 * -1 = -30000ms (-30 seconds)
    const elapsedSimMs = controller.getTime().getTime() - base.getTime();
    assert.equal(elapsedSimMs, -30000);
  });

  it('pauses and resumes without drifting', () => {
    const controller = new TimeController();
    const base = new Date('2024-01-01T12:00:00Z');
    controller.setTime(base);
    controller.pause();
    assert.equal(controller.isPlaying, false);

    controller.tick(1000);
    assert.equal(controller.getTime().getTime(), base.getTime());

    controller.play();
    assert.equal(controller.isPlaying, true);
  });
});
