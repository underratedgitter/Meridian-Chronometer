import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  raDecToAltAz,
  projectOrthographic,
  unprojectOrthographic,
  getPlanetaryPositions
} from '../src/engine/astronomy.js';

describe('Celestial Sphere & Orthographic Projection Math', () => {

  describe('RA/Dec to Altitude/Azimuth Conversion', () => {
    it('accurately computes Polaris at near-zenith for high northern latitudes', () => {
      // Polaris: RA ~ 2.53h, Dec ~ +89.26°
      // At North Pole (lat 90°), Polaris altitude should be ~89.26° regardless of LMST
      const altAzPole = raDecToAltAz(2.53, 89.26, 12.0, 90.0);
      assert.ok(Math.abs(altAzPole.altitudeDeg - 89.26) < 0.2, `Expected ~89.26°, got ${altAzPole.altitudeDeg}°`);

      // At equator (lat 0°), Polaris altitude should be near horizon (~0°)
      const altAzEquator = raDecToAltAz(2.53, 89.26, 12.0, 0.0);
      assert.ok(Math.abs(altAzEquator.altitudeDeg) < 1.0, `Expected near 0°, got ${altAzEquator.altitudeDeg}°`);
    });

    it('identifies exact meridian transit when Hour Angle is 0 (LMST equals RA)', () => {
      // Observer in Greenwich (lat 51.48° N)
      // Sirius: RA = 6.75h, Dec = -16.72°
      // When LMST = 6.75h (transit), Sirius is due South (Azimuth = 180°)
      // Max altitude = 90 - lat + dec = 90 - 51.48 + (-16.72) = 21.8°
      const altAz = raDecToAltAz(6.75, -16.72, 6.75, 51.48);
      assert.ok(Math.abs(altAz.altitudeDeg - 21.8) < 0.5, `Transit altitude expected ~21.8°, got ${altAz.altitudeDeg}°`);
      assert.ok(Math.abs(altAz.azimuthDeg - 180.0) < 1.0, `Transit azimuth expected ~180°, got ${altAz.azimuthDeg}°`);
    });

    it('computes object below horizon with negative altitude', () => {
      // Sirius when LMST is 12 hours away (anti-meridian)
      const altAz = raDecToAltAz(6.75, -16.72, 18.75, 51.48);
      assert.ok(altAz.altitudeDeg < 0, `Expected below horizon, got ${altAz.altitudeDeg}°`);
    });
  });

  describe('3D Orthographic Sphere Projection & Raycasting', () => {
    it('projects center of sphere directly to (0, 0) with visibility = true', () => {
      const radius = 200;
      const centerLon = 0;
      const centerLat = 0;
      const proj = projectOrthographic(0, 0, centerLon, centerLat, radius);

      assert.equal(proj.visible, true);
      assert.ok(Math.abs(proj.x) < 1e-6);
      assert.ok(Math.abs(proj.y) < 1e-6);
    });

    it('projects limb points at exactly radius distance', () => {
      const radius = 200;
      // Point at 90° East on equator: x should be +radius, y should be 0
      const projEast = projectOrthographic(90, 0, 0, 0, radius);
      assert.equal(projEast.visible, true);
      assert.ok(Math.abs(projEast.x - radius) < 1e-6, `Expected x = ${radius}, got ${projEast.x}`);
      assert.ok(Math.abs(projEast.y) < 1e-6);

      // Point at North Pole when centered on equator: x = 0, y = -radius (upwards on screen)
      const projNorth = projectOrthographic(0, 90, 0, 0, radius);
      assert.equal(projNorth.visible, true);
      assert.ok(Math.abs(projNorth.x) < 1e-6);
      assert.ok(Math.abs(projNorth.y - (-radius)) < 1e-6, `Expected y = -${radius}, got ${projNorth.y}`);
    });

    it('marks antipodal back hemisphere as not visible', () => {
      const projBack = projectOrthographic(180, 0, 0, 0, 200);
      assert.equal(projBack.visible, false);
    });

    it('correctly unprojects / raycasts screen coordinates back to geographic lon/lat', () => {
      const radius = 200;
      const centerLon = 20.0;
      const centerLat = 15.0;

      // Unproject the center (0, 0) -> should be (centerLon, centerLat)
      const centerUnproj = unprojectOrthographic(0, 0, centerLon, centerLat, radius);
      assert.ok(centerUnproj.hit, 'Center should hit sphere');
      assert.ok(Math.abs(centerUnproj.lon - centerLon) < 1e-4);
      assert.ok(Math.abs(centerUnproj.lat - centerLat) < 1e-4);

      // Round-trip test: project a point, then unproject it
      const origLon = 45.0;
      const origLat = 30.0;
      const p = projectOrthographic(origLon, origLat, centerLon, centerLat, radius);
      assert.equal(p.visible, true);

      const unproj = unprojectOrthographic(p.x, p.y, centerLon, centerLat, radius);
      assert.ok(unproj.hit);
      assert.ok(Math.abs(unproj.lon - origLon) < 0.01, `Expected lon ${origLon}, got ${unproj.lon}`);
      assert.ok(Math.abs(unproj.lat - origLat) < 0.01, `Expected lat ${origLat}, got ${unproj.lat}`);

      // Point outside radius should report hit = false
      const miss = unprojectOrthographic(300, 300, centerLon, centerLat, radius);
      assert.equal(miss.hit, false);
    });
  });

  describe('Planetary Ephemeris Calculations', () => {
    it('computes positions for Venus, Mars, and Jupiter with valid RA/Dec bounds', () => {
      const testDate = new Date('2024-06-20T12:00:00Z');
      const planets = getPlanetaryPositions(testDate);

      assert.ok(planets.venus, 'Venus should exist');
      assert.ok(planets.mars, 'Mars should exist');
      assert.ok(planets.jupiter, 'Jupiter should exist');

      for (const [name, p] of Object.entries(planets)) {
        assert.ok(p.raHours >= 0 && p.raHours < 24, `${name} RA out of bounds: ${p.raHours}`);
        assert.ok(p.decDeg >= -90 && p.decDeg <= 90, `${name} Dec out of bounds: ${p.decDeg}`);
      }
    });
  });

});
