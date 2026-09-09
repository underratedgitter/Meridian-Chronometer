import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESET_OBSERVATORIES,
  PRESET_EPOCHS,
  WORLD_CONTINENTS
} from '../src/engine/world-geometry.js';

describe('World Geometry & Ephemeris Presets', () => {
  it('defines valid astronomical observatories with proper coordinates', () => {
    assert.ok(PRESET_OBSERVATORIES.length >= 6);
    for (const obs of PRESET_OBSERVATORIES) {
      assert.ok(obs.id && typeof obs.id === 'string');
      assert.ok(obs.name && typeof obs.name === 'string');
      assert.ok(obs.lat >= -90 && obs.lat <= 90, `Invalid lat ${obs.lat} for ${obs.id}`);
      assert.ok(obs.lon >= -180 && obs.lon <= 180, `Invalid lon ${obs.lon} for ${obs.id}`);
    }
  });

  it('defines valid astronomical epoch presets', () => {
    assert.ok(PRESET_EPOCHS.length >= 5);
    for (const ep of PRESET_EPOCHS) {
      assert.ok(ep.label);
      if (ep.iso) {
        const d = new Date(ep.iso);
        assert.ok(!Number.isNaN(d.getTime()), `Invalid ISO timestamp: ${ep.iso}`);
      }
    }
  });

  it('contains valid closed continental polygons for equirectangular projection', () => {
    assert.ok(WORLD_CONTINENTS.length >= 6);
    for (const poly of WORLD_CONTINENTS) {
      assert.ok(poly.length >= 3, 'Polygons must have at least 3 vertices');
      for (const [lon, lat] of poly) {
        assert.ok(lon >= -180 && lon <= 180, `Longitude ${lon} out of bounds`);
        assert.ok(lat >= -90 && lat <= 90, `Latitude ${lat} out of bounds`);
      }
    }
  });
});
