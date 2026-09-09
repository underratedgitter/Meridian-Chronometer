import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getJulianDate,
  getJulianCenturies,
  getGMST,
  getLMST,
  getSolarPosition,
  getLocalSolarTime,
  getCelestialTelemetry,
  getLunarComplication,
  getTerminatorPoints
} from '../src/engine/astronomy.js';

describe('Astronomical Math Engine — Seams Verification', () => {

  describe('Seam 1: Julian Date & Centuries', () => {
    it('accurately computes JD for standard astronomical epoch J2000.0 (2000-01-01 12:00:00 UTC)', () => {
      const epochJ2000 = new Date(Date.UTC(2000, 0, 1, 12, 0, 0));
      const jd = getJulianDate(epochJ2000);
      assert.ok(Math.abs(jd - 2451545.0) < 0.0001, `Expected 2451545.0, got ${jd}`);

      const centuries = getJulianCenturies(jd);
      assert.ok(Math.abs(centuries - 0.0) < 1e-7, `Expected 0.0 centuries, got ${centuries}`);
    });

    it('accurately computes JD for 2024-01-01 00:00:00 UTC', () => {
      const date2024 = new Date(Date.UTC(2024, 0, 1, 0, 0, 0));
      const jd = getJulianDate(date2024);
      assert.ok(Math.abs(jd - 2460310.5) < 0.0001, `Expected 2460310.5, got ${jd}`);
    });

    it('accurately handles fractional days and leap years', () => {
      const leapDayNoon = new Date(Date.UTC(2024, 1, 29, 12, 0, 0));
      const jd = getJulianDate(leapDayNoon);
      // Jan has 31 days, 28 days to Feb 29 noon = 59.5 days after 2024-01-01 00:00
      assert.ok(Math.abs(jd - (2460310.5 + 59.5)) < 0.0001);
    });
  });

  describe('Seam 2: Greenwich Mean Sidereal Time (GMST) & Local Mean Sidereal Time (LMST)', () => {
    it('matches IAU standard GMST at epoch J2000.0 (18h 41m 50.55s = 18.697375 hours)', () => {
      const epochJ2000 = new Date(Date.UTC(2000, 0, 1, 12, 0, 0));
      const gmstHours = getGMST(epochJ2000);
      assert.ok(Math.abs(gmstHours - 18.697375) < 0.005, `Expected ~18.6974h, got ${gmstHours}`);
    });

    it('advances sidereal time ~24.0657 hours per solar day', () => {
      const t1 = new Date(Date.UTC(2024, 5, 1, 0, 0, 0));
      const t2 = new Date(Date.UTC(2024, 5, 2, 0, 0, 0));
      const gmst1 = getGMST(t1);
      const gmst2 = getGMST(t2);
      let diff = (gmst2 - gmst1 + 24) % 24;
      // Sidereal day is ~23h 56m 04s of solar time, so in 24 solar hours sidereal advances ~24h 03m 56s = 24.0657h
      // Modulo 24 leaves ~0.0657 hours = ~3.94 minutes
      assert.ok(Math.abs(diff - 0.0657) < 0.01, `Expected diff ~0.0657h, got ${diff}`);
    });

    it('calculates LMST adjusted for observer longitude (e.g. Tokyo +139.69° and Greenwich 0°)', () => {
      const date = new Date(Date.UTC(2024, 2, 20, 12, 0, 0));
      const gmst = getGMST(date);
      const lmstGreenwich = getLMST(date, 0);
      assert.ok(Math.abs(gmst - lmstGreenwich) < 1e-6);

      const tokyoLon = 139.6917; // East
      const lmstTokyo = getLMST(date, tokyoLon);
      const expectedOffset = (tokyoLon / 15) % 24;
      const actualOffset = (lmstTokyo - gmst + 24) % 24;
      assert.ok(Math.abs(actualOffset - expectedOffset) < 0.001);
    });
  });

  describe('Seam 3: Solar Position, Declination & Equation of Time', () => {
    it('computes near-zero declination at equinoxes (~March 20 and ~Sept 22)', () => {
      const vernalEquinox = new Date(Date.UTC(2024, 2, 20, 3, 6, 0));
      const posVernal = getSolarPosition(vernalEquinox);
      assert.ok(Math.abs(posVernal.declinationDeg) < 0.5, `Vernal declination ${posVernal.declinationDeg} not close to 0`);

      const autumnalEquinox = new Date(Date.UTC(2024, 8, 22, 12, 44, 0));
      const posAutumnal = getSolarPosition(autumnalEquinox);
      assert.ok(Math.abs(posAutumnal.declinationDeg) < 0.5, `Autumnal declination ${posAutumnal.declinationDeg} not close to 0`);
    });

    it('computes maximum extreme declination (~ +23.44° and -23.44°) at solstices', () => {
      const summerSolstice = new Date(Date.UTC(2024, 5, 20, 20, 51, 0));
      const posSummer = getSolarPosition(summerSolstice);
      assert.ok(Math.abs(posSummer.declinationDeg - 23.44) < 0.3, `Summer solstice declination ${posSummer.declinationDeg} not ~23.44°`);

      const winterSolstice = new Date(Date.UTC(2024, 11, 21, 9, 21, 0));
      const posWinter = getSolarPosition(winterSolstice);
      assert.ok(Math.abs(posWinter.declinationDeg - (-23.44)) < 0.3, `Winter solstice declination ${posWinter.declinationDeg} not ~ -23.44°`);
    });

    it('evaluates Equation of Time within authentic physical bounds (-15 to +17 minutes)', () => {
      // Test across multiple months
      const dates = [
        new Date(Date.UTC(2024, 1, 11, 12, 0, 0)), // Mid Feb: near min ~ -14m
        new Date(Date.UTC(2024, 4, 15, 12, 0, 0)), // Mid May: near +3.7m
        new Date(Date.UTC(2024, 6, 26, 12, 0, 0)), // Late July: near -6.5m
        new Date(Date.UTC(2024, 10, 3, 12, 0, 0))  // Early Nov: near max ~ +16.4m
      ];
      for (const d of dates) {
        const { equationOfTimeMinutes } = getSolarPosition(d);
        assert.ok(equationOfTimeMinutes >= -15 && equationOfTimeMinutes <= 17, `EoT out of range: ${equationOfTimeMinutes}`);
      }

      // Specific check for Nov peak
      const novDate = new Date(Date.UTC(2024, 10, 3, 12, 0, 0));
      const eotNov = getSolarPosition(novDate).equationOfTimeMinutes;
      assert.ok(eotNov > 14 && eotNov < 17, `Expected Nov peak ~16m, got ${eotNov}`);
    });

    it('identifies the Subsolar Point accurately', () => {
      // At 12:00 UTC, subsolar longitude should be near Prime Meridian (-EoT offset in degrees)
      const noonDate = new Date(Date.UTC(2024, 2, 20, 12, 0, 0));
      const pos = getSolarPosition(noonDate);
      assert.ok(Math.abs(pos.subsolarPoint.latitudeDeg) < 1.0);
      assert.ok(Math.abs(pos.subsolarPoint.longitudeDeg) < 5.0, `Subsolar longitude ${pos.subsolarPoint.longitudeDeg} not near 0° at 12:00 UTC`);
    });
  });

  describe('Seam 4: Local Solar Time (Apparent & Mean)', () => {
    it('calculates Local Apparent Solar Time correctly with longitude and EoT offset', () => {
      const date = new Date(Date.UTC(2024, 10, 3, 12, 0, 0));
      const solarTime = getLocalSolarTime(date, 0); // Greenwich longitude 0
      // In early Nov, EoT is ~+16.4m, so at 12:00:00 UTC mean time, apparent solar time is 12h + ~16.4m ≈ 12.27h
      assert.ok(solarTime.apparentHours > 12.2 && solarTime.apparentHours < 12.35);
      assert.ok(Math.abs(solarTime.meanHours - 12.0) < 0.001);
    });

    it('adjusts by +1 hour per +15° of geographic longitude', () => {
      const date = new Date(Date.UTC(2024, 5, 21, 12, 0, 0));
      const greenwich = getLocalSolarTime(date, 0);
      const cairo = getLocalSolarTime(date, 30); // 30° East (+2 hours)
      const diff = (cairo.meanHours - greenwich.meanHours + 24) % 24;
      assert.ok(Math.abs(diff - 2.0) < 0.001);
    });
  });

  describe('Seam 5: Celestial Telemetry (Solar Transit, Sunrise, Sunset, Twilights)', () => {
    it('calculates solar transit and equinox sunrise/sunset times for Greenwich (lat 51.48°, lon 0°)', () => {
      const equinoxDate = new Date(Date.UTC(2024, 2, 20, 0, 0, 0));
      const telemetry = getCelestialTelemetry(equinoxDate, 51.4769, 0.0);

      assert.ok(telemetry.solarNoonUTC, 'Solar noon should be defined');
      assert.ok(telemetry.sunriseUTC, 'Sunrise should be defined');
      assert.ok(telemetry.sunsetUTC, 'Sunset should be defined');

      // Solar noon at Greenwich is ~12:07 UTC due to EoT on March 20 (~-7 min)
      const noonHours = telemetry.solarNoonUTC.getUTCHours() + telemetry.solarNoonUTC.getUTCMinutes() / 60;
      assert.ok(Math.abs(noonHours - 12.12) < 0.2, `Noon hours ${noonHours} not expected ~12.12`);

      // Day length around equinox should be ~12 hours (refraction makes it ~12h 10m)
      const dayLengthHours = (telemetry.sunsetUTC.getTime() - telemetry.sunriseUTC.getTime()) / 3600000;
      assert.ok(dayLengthHours >= 12.0 && dayLengthHours <= 12.35, `Day length ${dayLengthHours}h not ~12.15h`);
    });

    it('provides twilight bounds in correct chronological order in the morning', () => {
      const date = new Date(Date.UTC(2024, 5, 21, 0, 0, 0));
      const telemetry = getCelestialTelemetry(date, 40.7128, -74.0060); // New York

      assert.ok(telemetry.astronomicalDawnUTC.getTime() < telemetry.nauticalDawnUTC.getTime());
      assert.ok(telemetry.nauticalDawnUTC.getTime() < telemetry.civilDawnUTC.getTime());
      assert.ok(telemetry.civilDawnUTC.getTime() < telemetry.sunriseUTC.getTime());
      assert.ok(telemetry.sunriseUTC.getTime() < telemetry.goldenHourEndMorningUTC.getTime());
    });
  });

  describe('Seam 6: Lunar Complication (Illumination Fraction & Lunar Age)', () => {
    it('matches known Full Moon on 2024-01-25 (illumination > 0.98)', () => {
      const fullMoonDate = new Date(Date.UTC(2024, 0, 25, 17, 54, 0));
      const complication = getLunarComplication(fullMoonDate);

      assert.ok(complication.illuminationFraction >= 0.97, `Expected >= 0.97 illumination, got ${complication.illuminationFraction}`);
      assert.equal(complication.phaseName, 'Full Moon');
    });

    it('matches known New Moon on 2024-02-09 (illumination < 0.03)', () => {
      const newMoonDate = new Date(Date.UTC(2024, 1, 9, 23, 0, 0));
      const complication = getLunarComplication(newMoonDate);

      assert.ok(complication.illuminationFraction <= 0.03, `Expected <= 0.03 illumination, got ${complication.illuminationFraction}`);
      assert.equal(complication.phaseName, 'New Moon');
    });

    it('calculates lunar age within standard 0 to 29.53 days and predicts next Full/New Moon', () => {
      const testDate = new Date(Date.UTC(2024, 6, 15, 12, 0, 0));
      const complication = getLunarComplication(testDate);

      assert.ok(complication.lunarAgeDays >= 0 && complication.lunarAgeDays < 29.53);
      assert.ok(complication.daysToNextFullMoon >= 0 && complication.daysToNextFullMoon <= 29.53);
      assert.ok(complication.daysToNextNewMoon >= 0 && complication.daysToNextNewMoon <= 29.53);
    });
  });

  describe('Seam 7: Solar Terminator Curve for World Map', () => {
    it('computes 360 continuous boundary points spanning longitude -180° to +180°', () => {
      const date = new Date(Date.UTC(2024, 5, 21, 12, 0, 0)); // Solstice
      const terminator = getTerminatorPoints(date, 360);

      assert.equal(terminator.length, 360);
      assert.ok(terminator[0].longitudeDeg >= -180 && terminator[0].longitudeDeg <= 180);

      // Latitudes should all stay within valid globe range [-90°, +90°]
      for (const pt of terminator) {
        assert.ok(pt.latitudeDeg >= -90 && pt.latitudeDeg <= 90);
      }
    });

    it('handles equinox when subsolar latitude is near 0° without NaN or singularity', () => {
      const equinoxDate = new Date(Date.UTC(2024, 2, 20, 12, 0, 0));
      const terminator = getTerminatorPoints(equinoxDate, 180);

      assert.equal(terminator.length, 180);
      for (const pt of terminator) {
        assert.ok(!Number.isNaN(pt.latitudeDeg), 'Latitude must not be NaN at equinox');
        assert.ok(!Number.isNaN(pt.longitudeDeg), 'Longitude must not be NaN at equinox');
      }
    });
  });

});
