import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeDegrees,
  normalizeHours
} from '../src/engine/astronomy.js';

describe('Angle & Time Normalization Utilities', () => {

  describe('normalizeDegrees', () => {
    it('leaves values already in [0, 360) unchanged', () => {
      assert.equal(normalizeDegrees(0), 0);
      assert.equal(normalizeDegrees(180), 180);
      assert.equal(normalizeDegrees(359.9), 359.9);
    });

    it('wraps values >= 360 back into [0, 360)', () => {
      assert.equal(normalizeDegrees(360), 0);
      assert.equal(normalizeDegrees(450), 90);
      assert.equal(normalizeDegrees(720), 0);
    });

    it('wraps negative values into [0, 360)', () => {
      assert.equal(normalizeDegrees(-90), 270);
      // Add 0 to fold the -0 that (-360 % 360) produces into +0 for comparison.
      assert.equal(normalizeDegrees(-360) + 0, 0);
      assert.equal(normalizeDegrees(-720) + 0, 0);
    });

    it('returns 0.0 for non-finite or non-numeric input', () => {
      assert.equal(normalizeDegrees(NaN), 0.0);
      assert.equal(normalizeDegrees(Infinity), 0.0);
      assert.equal(normalizeDegrees(-Infinity), 0.0);
      assert.equal(normalizeDegrees(undefined), 0.0);
      assert.equal(normalizeDegrees('not-a-number'), 0.0);
    });
  });

  describe('normalizeHours', () => {
    it('leaves values already in [0, 24) unchanged', () => {
      assert.equal(normalizeHours(0), 0);
      assert.equal(normalizeHours(12), 12);
      assert.equal(normalizeHours(23.9), 23.9);
    });

    it('wraps values >= 24 back into [0, 24)', () => {
      assert.equal(normalizeHours(24), 0);
      assert.equal(normalizeHours(30), 6);
      assert.equal(normalizeHours(48), 0);
    });

    it('wraps negative values into [0, 24)', () => {
      assert.equal(normalizeHours(-6), 18);
      // Add 0 to fold the -0 that (-24 % 24) produces into +0 for comparison.
      assert.equal(normalizeHours(-24) + 0, 0);
      assert.equal(normalizeHours(-48) + 0, 0);
    });

    it('returns 0.0 for non-finite or non-numeric input', () => {
      assert.equal(normalizeHours(NaN), 0.0);
      assert.equal(normalizeHours(Infinity), 0.0);
      assert.equal(normalizeHours(-Infinity), 0.0);
      assert.equal(normalizeHours(undefined), 0.0);
      assert.equal(normalizeHours('not-a-number'), 0.0);
    });
  });

});
