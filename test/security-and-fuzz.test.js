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
  getTerminatorPoints,
  getNightShadowPolygon,
  raDecToAltAz,
  projectOrthographic,
  unprojectOrthographic,
  getPlanetaryPositions
} from '../src/engine/astronomy.js';

import { TimeController } from '../src/engine/time-controller.js';
import { EscapementAudio } from '../src/ui/audio-escapement.js';

describe('Astronomical & Math Boundary Tests', () => {

  describe('Julian Date & Centuries Calculators Fuzzing', () => {
    it('handles Year 0, Year 9999, and negative BC years without NaN or throwing', () => {
      // Year 0 (1 BCE in astronomical numbering)
      const y0 = new Date(0);
      y0.setUTCFullYear(0, 0, 1);
      y0.setUTCHours(0, 0, 0, 0);
      const jd0 = getJulianDate(y0);
      assert.ok(Number.isFinite(jd0), `Year 0 JD must be finite, got ${jd0}`);
      assert.ok(Number.isFinite(getJulianCenturies(jd0)));

      // Year 9999
      const y9999 = new Date(0);
      y9999.setUTCFullYear(9999, 11, 31);
      y9999.setUTCHours(23, 59, 59, 999);
      const jd9999 = getJulianDate(y9999);
      assert.ok(Number.isFinite(jd9999), `Year 9999 JD must be finite, got ${jd9999}`);
      assert.ok(Number.isFinite(getJulianCenturies(jd9999)));

      // Negative BC year (-4712)
      const yNeg = new Date(0);
      yNeg.setUTCFullYear(-4712, 0, 1);
      yNeg.setUTCHours(12, 0, 0, 0);
      const jdNeg = getJulianDate(yNeg);
      assert.ok(Number.isFinite(jdNeg), `Year -4712 JD must be finite, got ${jdNeg}`);
      assert.ok(Number.isFinite(getJulianCenturies(jdNeg)));
    });

    it('handles leap years, leap seconds, and sub-millisecond calendar boundaries', () => {
      // Leap year 2000 (century leap)
      const d2000 = new Date('2000-02-29T12:00:00Z');
      const jd2000 = getJulianDate(d2000);
      assert.ok(Number.isFinite(jd2000));
      assert.equal(jd2000, 2451604.0);

      // Leap year 2024
      const d2024 = new Date('2024-02-29T23:59:59.999Z');
      const jd2024 = getJulianDate(d2024);
      assert.ok(Number.isFinite(jd2024));

      // Dec 31 millisecond boundary
      const dDec31 = new Date('2024-12-31T23:59:59.999Z');
      const jdDec31 = getJulianDate(dDec31);
      assert.ok(Number.isFinite(jdDec31));

      // Leap second representation (second 60 rollover)
      const leapSec = new Date('2016-12-31T23:59:59.000Z');
      leapSec.setUTCSeconds(60);
      const jdLeapSec = getJulianDate(leapSec);
      assert.ok(Number.isFinite(jdLeapSec));
    });

    it('gracefully handles invalid, null, undefined, or NaN date inputs without propagating NaN', () => {
      const badInputs = [null, undefined, NaN, Infinity, -Infinity, 'invalid date string', new Date('invalid')];

      for (const bad of badInputs) {
        const jd = getJulianDate(bad);
        assert.ok(Number.isFinite(jd), `getJulianDate(${String(bad)}) must be finite, got ${jd}`);

        const jc = getJulianCenturies(jd);
        assert.ok(Number.isFinite(jc), `getJulianCenturies(${jd}) must be finite, got ${jc}`);

        const gmst = getGMST(bad);
        assert.ok(Number.isFinite(gmst), `getGMST(${String(bad)}) must be finite, got ${gmst}`);
      }
    });
  });

  describe('Coordinate Boundaries & Singularities', () => {
    it('evaluates telemetry at North (+90°) and South (-90°) poles without NaN or division by zero', () => {
      const summerSolstice = new Date('2024-06-21T12:00:00Z');
      const winterSolstice = new Date('2024-12-21T12:00:00Z');
      const vernalEquinox = new Date('2024-03-20T12:00:00Z');

      // North Pole summer: polar day
      const npSummer = getCelestialTelemetry(summerSolstice, 90.0, 0.0);
      assert.equal(npSummer.sunriseUTC, null);
      assert.equal(npSummer.sunsetUTC, null);
      assert.equal(npSummer.dayLengthHours, 24);
      assert.ok(Number.isFinite(npSummer.solarElevationAtNoonDeg));

      // North Pole winter: polar night
      const npWinter = getCelestialTelemetry(winterSolstice, 90.0, 0.0);
      assert.equal(npWinter.sunriseUTC, null);
      assert.equal(npWinter.sunsetUTC, null);
      assert.equal(npWinter.dayLengthHours, 0);

      // South Pole summer (Dec): polar day
      const spSummer = getCelestialTelemetry(winterSolstice, -90.0, 0.0);
      assert.equal(spSummer.dayLengthHours, 24);

      // South Pole winter (June): polar night
      const spWinter = getCelestialTelemetry(summerSolstice, -90.0, 0.0);
      assert.equal(spWinter.dayLengthHours, 0);

      // Equinox at poles
      const npEq = getCelestialTelemetry(vernalEquinox, 90.0, 0.0);
      assert.ok(Number.isFinite(npEq.dayLengthHours));
      assert.ok(Number.isFinite(npEq.solarElevationAtNoonDeg));

      const spEq = getCelestialTelemetry(vernalEquinox, -90.0, 0.0);
      assert.ok(Number.isFinite(spEq.dayLengthHours));
      assert.ok(Number.isFinite(spEq.solarElevationAtNoonDeg));
    });

    it('evaluates Altitude/Azimuth conversions at North and South poles without NaN or division by zero', () => {
      // Multiple RA/Dec combinations at lat +90 and -90
      const testCases = [
        { ra: 0, dec: 0, lmst: 0, lat: 90.0 },
        { ra: 6, dec: 23.5, lmst: 12, lat: 90.0 },
        { ra: 18, dec: -23.5, lmst: 6, lat: 90.0 },
        { ra: 2.53, dec: 89.26, lmst: 12, lat: 90.0 }, // Polaris
        { ra: 0, dec: 0, lmst: 0, lat: -90.0 },
        { ra: 12, dec: -45, lmst: 18, lat: -90.0 },
        { ra: 0, dec: 90.0, lmst: 0, lat: 90.0 }, // Zenith at pole
        { ra: 0, dec: -90.0, lmst: 0, lat: -90.0 } // Nadir at pole
      ];

      for (const tc of testCases) {
        const res = raDecToAltAz(tc.ra, tc.dec, tc.lmst, tc.lat);
        assert.ok(Number.isFinite(res.altitudeDeg), `Altitude must be finite at lat ${tc.lat}, got ${res.altitudeDeg}`);
        assert.ok(Number.isFinite(res.azimuthDeg), `Azimuth must be finite at lat ${tc.lat}, got ${res.azimuthDeg}`);
        assert.ok(res.azimuthDeg >= 0 && res.azimuthDeg < 360, `Azimuth must be in [0, 360), got ${res.azimuthDeg}`);
        assert.ok(res.altitudeDeg >= -90 && res.altitudeDeg <= 90, `Altitude must be in [-90, 90], got ${res.altitudeDeg}`);
      }
    });

    it('performs forward and inverse orthographic projections at poles cleanly', () => {
      const radius = 200;

      // Project centered at North Pole (centerLat = 90)
      const projNP = projectOrthographic(0, 90, 0, 90, radius);
      assert.equal(projNP.visible, true);
      assert.ok(Math.abs(projNP.x) < 1e-6);
      assert.ok(Math.abs(projNP.y) < 1e-6);

      // Project South Pole when centered at North Pole
      const projSPfromNP = projectOrthographic(0, -90, 0, 90, radius);
      assert.equal(projSPfromNP.visible, false);

      // Inverse unproject at center (0, 0) of North Pole globe
      const unprojCenter = unprojectOrthographic(0, 0, 0, 90, radius);
      assert.equal(unprojCenter.hit, true);
      assert.equal(unprojCenter.lat, 90);

      // Inverse unproject at South Pole globe
      const unprojSPCenter = unprojectOrthographic(0, 0, 0, -90, radius);
      assert.equal(unprojSPCenter.hit, true);
      assert.equal(unprojSPCenter.lat, -90);

      // Unproject various points on polar projection
      const unprojPoint = unprojectOrthographic(100, 100, 45, 90, radius);
      assert.equal(unprojPoint.hit, true);
      assert.ok(Number.isFinite(unprojPoint.lat));
      assert.ok(Number.isFinite(unprojPoint.lon));
      assert.ok(unprojPoint.lat >= -90 && unprojPoint.lat <= 90);
      assert.ok(unprojPoint.lon >= -180 && unprojPoint.lon <= 180);
    });

    it('wraps longitudes across the antimeridian boundary (±180°, ±180.0001°) cleanly without loops or NaN', () => {
      const date = new Date('2024-03-20T12:00:00Z');
      const testLons = [180.0, -180.0, 180.0001, -180.0001, 360.0, -360.0, 540.0, 1000000.0];

      for (const lon of testLons) {
        // LMST wrapping
        const lmst = getLMST(date, lon);
        assert.ok(Number.isFinite(lmst), `LMST for lon ${lon} must be finite`);
        assert.ok(lmst >= 0 && lmst < 24, `LMST must be in [0, 24), got ${lmst}`);

        // Local Solar Time wrapping
        const solTime = getLocalSolarTime(date, lon);
        assert.ok(Number.isFinite(solTime.meanHours));
        assert.ok(Number.isFinite(solTime.apparentHours));
        assert.ok(solTime.meanHours >= 0 && solTime.meanHours < 24);
        assert.ok(solTime.apparentHours >= 0 && solTime.apparentHours < 24);

        // Orthographic projection wrapping
        const proj = projectOrthographic(lon, 0, 0, 0, 200);
        assert.ok(Number.isFinite(proj.x));
        assert.ok(Number.isFinite(proj.y));
        assert.ok(Number.isFinite(proj.cosC));
      }

      // Exact antimeridian symmetry: +180° and -180° should produce equivalent hour angles
      const lmstPos180 = getLMST(date, 180.0);
      const lmstNeg180 = getLMST(date, -180.0);
      assert.ok(Math.abs(lmstPos180 - lmstNeg180) < 1e-9, `LMST(+180) ${lmstPos180} should equal LMST(-180) ${lmstNeg180}`);
    });

    it('handles equinox singularity with solar declination passing through 0.000000° without division by zero', () => {
      // Construct exact equinox instant or simulated zero declination date
      // Solar terminator calculation with declination = 0
      const vernalEquinox = new Date('2024-03-20T03:06:00Z');
      const terminator = getTerminatorPoints(vernalEquinox, 360, 0);

      assert.equal(terminator.length, 360);
      for (const pt of terminator) {
        assert.ok(Number.isFinite(pt.latitudeDeg), `Terminator lat must be finite, got ${pt.latitudeDeg}`);
        assert.ok(Number.isFinite(pt.longitudeDeg), `Terminator lon must be finite, got ${pt.longitudeDeg}`);
        assert.ok(pt.latitudeDeg >= -90.0001 && pt.latitudeDeg <= 90.0001);
        assert.ok(pt.longitudeDeg >= -180.0001 && pt.longitudeDeg <= 180.0001);
      }

      // Night shadow polygon
      const shadowPoly = getNightShadowPolygon(vernalEquinox, 180);
      assert.ok(shadowPoly.length >= 180);
      for (const pt of shadowPoly) {
        assert.ok(Number.isFinite(pt.latitudeDeg));
        assert.ok(Number.isFinite(pt.longitudeDeg));
      }
    });

    it('safely returns { hit: false, lat: 0, lon: 0 } and never throws or returns NaN when clicks are off-globe', () => {
      const radius = 200;
      const offGlobeCoords = [
        [300, 300],
        [-201, 0],
        [0, 201],
        [-300, -300],
        [1000, 1000],
        [NaN, 0],
        [0, Infinity],
        [-Infinity, -Infinity]
      ];

      for (const [x, y] of offGlobeCoords) {
        const res = unprojectOrthographic(x, y, 0, 0, radius);
        assert.equal(res.hit, false, `Expected hit = false for (${x}, ${y})`);
        assert.equal(res.lat, 0, `Expected lat = 0 for off-globe (${x}, ${y})`);
        assert.equal(res.lon, 0, `Expected lon = 0 for off-globe (${x}, ${y})`);
        assert.ok(!Number.isNaN(res.lat) && !Number.isNaN(res.lon));
      }

      // Also verify invalid radius (zero or negative)
      const resBadRadius = unprojectOrthographic(0, 0, 0, 0, 0);
      assert.equal(resBadRadius.hit, false);
      assert.equal(resBadRadius.lat, 0);
      assert.equal(resBadRadius.lon, 0);
    });
  });

  describe('Planetary & Celestial Fuzzing Across 500+ Dates (BCE 1000 to CE 3000)', () => {
    it('guarantees all astronomical outputs are strictly finite across 500+ randomized dates', () => {
      // BCE 1000 corresponds to roughly year -999, CE 3000 to year 3000
      const startMs = new Date('0001-01-01T00:00:00Z').getTime() - 1000 * 365.25 * 86400000;
      const endMs = new Date('3000-01-01T00:00:00Z').getTime();

      for (let i = 0; i < 550; i++) {
        const timeMs = startMs + Math.random() * (endMs - startMs);
        const date = new Date(timeMs);

        // 1. Solar Position
        const solar = getSolarPosition(date);
        assert.ok(Number.isFinite(solar.declinationDeg), `solar.declinationDeg non-finite on ${date.toISOString()}`);
        assert.ok(Number.isFinite(solar.rightAscensionDeg), `solar.rightAscensionDeg non-finite`);
        assert.ok(Number.isFinite(solar.rightAscensionHours), `solar.rightAscensionHours non-finite`);
        assert.ok(Number.isFinite(solar.equationOfTimeMinutes), `solar.equationOfTimeMinutes non-finite`);
        assert.ok(Number.isFinite(solar.subsolarPoint.latitudeDeg), `subsolarPoint.latitudeDeg non-finite`);
        assert.ok(Number.isFinite(solar.subsolarPoint.longitudeDeg), `subsolarPoint.longitudeDeg non-finite`);

        // 2. Lunar Complication
        const lunar = getLunarComplication(date);
        assert.ok(Number.isFinite(lunar.illuminationFraction), `lunar.illuminationFraction non-finite`);
        assert.ok(Number.isFinite(lunar.phaseAngleDeg), `lunar.phaseAngleDeg non-finite`);
        assert.ok(Number.isFinite(lunar.lunarAgeDays), `lunar.lunarAgeDays non-finite`);
        assert.ok(Number.isFinite(lunar.daysToNextFullMoon), `lunar.daysToNextFullMoon non-finite`);
        assert.ok(Number.isFinite(lunar.daysToNextNewMoon), `lunar.daysToNextNewMoon non-finite`);

        // 3. Planetary Positions (Venus, Mars, Jupiter)
        const planets = getPlanetaryPositions(date);
        for (const [pName, pData] of Object.entries(planets)) {
          assert.ok(Number.isFinite(pData.raHours), `${pName}.raHours non-finite`);
          assert.ok(Number.isFinite(pData.decDeg), `${pName}.decDeg non-finite`);
          assert.ok(Number.isFinite(pData.distAU), `${pName}.distAU non-finite`);
        }

        // 4. Coordinate Conversion
        const lmst = getLMST(date, (Math.random() - 0.5) * 360);
        const altAz = raDecToAltAz(
          Math.random() * 24,
          (Math.random() - 0.5) * 180,
          lmst,
          (Math.random() - 0.5) * 180
        );
        assert.ok(Number.isFinite(altAz.altitudeDeg), `altAz.altitudeDeg non-finite`);
        assert.ok(Number.isFinite(altAz.azimuthDeg), `altAz.azimuthDeg non-finite`);
      }
    });
  });

});

describe('State & Memory Leak Stress-Testing', () => {

  describe('TimeController Resilience & Continuity', () => {
    it('executes 100,000 tick cycles at 86400x maximum acceleration in forward and reverse without drift or overflow', () => {
      const initialIso = '2024-01-01T00:00:00.000Z';
      const tc = new TimeController(initialIso);

      // Verify starting condition
      assert.equal(tc.getTime().toISOString(), initialIso);
      tc.setSpeed(86400);
      assert.equal(tc.speedMultiplier, 86400);

      // Monitor memory and state buffer
      const initialSubscribersCount = tc.subscribers.size;

      // 1. Forward 100,000 tick cycles (simulating 16ms frames)
      tc.setDirection(1);
      let lastTimeMs = tc.getTime().getTime();
      let leapDayCrossed = false;

      for (let i = 0; i < 100000; i++) {
        tc.tick(16);
        const curTimeMs = tc.getTime().getTime();
        assert.ok(curTimeMs > lastTimeMs, `Time must be strictly increasing at cycle ${i}`);

        // Check if leap day (2024-02-29) is observed
        const curDate = tc.getTime();
        if (curDate.getUTCFullYear() === 2024 && curDate.getUTCMonth() === 1 && curDate.getUTCDate() === 29) {
          leapDayCrossed = true;
        }

        lastTimeMs = curTimeMs;
      }

      assert.ok(leapDayCrossed, 'Time progression must cleanly navigate through leap day (Feb 29, 2024)');
      const forwardEndIso = tc.getTime().toISOString();
      assert.equal(forwardEndIso, '2028-05-19T00:00:00.000Z');

      // 2. Reverse 100,000 tick cycles back to exact origin
      tc.setDirection(-1);
      for (let i = 0; i < 100000; i++) {
        tc.tick(16);
        const curTimeMs = tc.getTime().getTime();
        assert.ok(curTimeMs < lastTimeMs, `Time must be strictly decreasing at reverse cycle ${i}`);
        lastTimeMs = curTimeMs;
      }

      // Time should return precisely to the initial instant
      assert.equal(tc.getTime().toISOString(), initialIso);

      // Check for lack of state buffer overflow
      assert.equal(tc.subscribers.size, initialSubscribersCount);
    });

    it('robustly sanitizes corrupt inputs (NaN, null, negative speeds, non-finite values)', () => {
      const tc = new TimeController(new Date(1700000000000));

      // Corrupt setTime
      tc.setTime(NaN);
      assert.ok(Number.isFinite(tc.getTime().getTime()));

      tc.setTime(Infinity);
      assert.ok(Number.isFinite(tc.getTime().getTime()));

      // Corrupt setSpeed
      tc.setSpeed(NaN);
      assert.ok(tc.speedMultiplier >= 0.1);

      tc.setSpeed(-100);
      assert.ok(tc.speedMultiplier >= 0.1);

      tc.setSpeed(Infinity);
      assert.ok(Number.isFinite(tc.speedMultiplier));

      // Corrupt tick elapsed
      const beforeTick = tc.getTime().getTime();
      tc.tick(NaN);
      assert.equal(tc.getTime().getTime(), beforeTick);

      tc.tick(Infinity);
      assert.equal(tc.getTime().getTime(), beforeTick);
    });
  });

  describe('Audio Escapement Resilience & Lifecycle Cleanup', () => {
    it('manages Web Audio node lifecycles cleanly, disconnecting on completion and preventing memory leaks', () => {
      const audio = new EscapementAudio();

      // Mock Web Audio Context
      const createdNodes = {
        oscillators: [],
        gains: []
      };

      const mockCtx = {
        currentTime: 100.0,
        state: 'running',
        destination: {},
        createOscillator() {
          const osc = {
            type: 'sine',
            frequency: {
              setValueAtTime() {},
              exponentialRampToValueAtTime() {}
            },
            connectedTo: null,
            startedAt: null,
            stoppedAt: null,
            isStopped: false,
            isDisconnected: false,
            onended: null,
            connect(dest) {
              this.connectedTo = dest;
            },
            start(t) {
              this.startedAt = t;
            },
            stop() {
              this.isStopped = true;
            },
            disconnect() {
              this.isDisconnected = true;
              this.connectedTo = null;
            }
          };
          createdNodes.oscillators.push(osc);
          return osc;
        },
        createGain() {
          const gain = {
            gain: {
              setValueAtTime() {},
              exponentialRampToValueAtTime() {}
            },
            connectedTo: null,
            isDisconnected: false,
            connect(dest) {
              this.connectedTo = dest;
            },
            disconnect() {
              this.isDisconnected = true;
              this.connectedTo = null;
            }
          };
          createdNodes.gains.push(gain);
          return gain;
        },
        close() {
          this.state = 'closed';
        }
      };

      audio.ctx = mockCtx;
      audio.isEnabled = true;

      // 1. Fire a tick
      audio.tick(false);
      assert.equal(createdNodes.oscillators.length, 1);
      assert.equal(createdNodes.gains.length, 1);

      const osc1 = createdNodes.oscillators[0];
      const gain1 = createdNodes.gains[0];

      // Nodes should be registered in active tracking
      assert.ok(audio.activeNodes, 'Audio must have activeNodes collection');
      assert.equal(audio.activeNodes.size, 1);

      // Fire onended event to simulate completion
      assert.ok(typeof osc1.onended === 'function', 'Oscillator must have onended cleanup handler');
      osc1.onended();

      // Node should be disconnected and removed from active set
      assert.equal(osc1.isDisconnected, true, 'Oscillator must be disconnected upon ending');
      assert.equal(gain1.isDisconnected, true, 'Gain must be disconnected upon ending');
      assert.equal(audio.activeNodes.size, 0, 'Active nodes set must be empty after playback concludes');

      // 2. Fire multiple ticks and test stop() / cleanup()
      audio.tick(true);
      audio.tick(false);
      assert.equal(audio.activeNodes.size, 2);

      // Calling stop() should immediately stop and disconnect all running nodes
      audio.stop();
      assert.equal(audio.activeNodes.size, 0, 'Active nodes set must be cleared on stop()');

      // 3. Toggling off should also stop running nodes
      audio.tick(false);
      assert.equal(audio.activeNodes.size, 1);
      audio.toggle(); // Disables audio
      assert.equal(audio.isEnabled, false);
      assert.equal(audio.activeNodes.size, 0, 'Active nodes must be cleared when audio is toggled off');

      // 4. Destroy should release context
      audio.destroy();
      assert.equal(audio.ctx, null);
      assert.equal(mockCtx.state, 'closed');
    });
  });

  describe('Client Scalability & Adaptive Low-Power Mode (<30 FPS)', () => {
    it('supports dynamic setLowPowerMode toggling across dial, world observatory, and telemetry', async () => {
      const { ChronometerDial } = await import('../src/ui/chronometer-dial.js');
      const { WorldObservatory } = await import('../src/ui/world-observatory.js');
      const { TelemetryDisplay } = await import('../src/ui/telemetry-display.js');

      // Mock canvas & 2D context
      const createMockCanvas = () => {
        const ctx = {
          save: () => {},
          restore: () => {},
          clearRect: () => {},
          fillRect: () => {},
          strokeRect: () => {},
          beginPath: () => {},
          arc: () => {},
          fill: () => {},
          stroke: () => {},
          moveTo: () => {},
          lineTo: () => {},
          closePath: () => {},
          translate: () => {},
          rotate: () => {},
          scale: () => {},
          drawImage: () => {},
          putImageData: () => {},
          createImageData: () => ({ data: new Uint8ClampedArray(4) }),
          setLineDash: () => {},
          getLineDash: () => [],
          createRadialGradient: () => ({ addColorStop: () => {} }),
          createLinearGradient: () => ({ addColorStop: () => {} }),
          fillText: () => {},
          strokeText: () => {},
          measureText: () => ({ width: 10 }),
          clip: () => {}
        };
        return {
          getContext: () => ctx,
          getBoundingClientRect: () => ({ width: 380, height: 380 }),
          addEventListener: () => {},
          removeEventListener: () => {},
          width: 380,
          height: 380
        };
      };

      const dialCanvas = createMockCanvas();
      const dial = new ChronometerDial(dialCanvas);
      assert.equal(dial.isLowPowerMode, false);

      dial.setLowPowerMode(true);
      assert.equal(dial.isLowPowerMode, true);
      // Verify rendering succeeds without throwing in low power mode
      dial.render({
        utcDate: new Date(),
        solarApparentHours: 12.5,
        siderealHours: 6.2
      });

      dial.setLowPowerMode(false);
      assert.equal(dial.isLowPowerMode, false);

      // World Observatory
      const mapCanvas = createMockCanvas();
      const observatory = new WorldObservatory(mapCanvas);
      assert.equal(observatory.isLowPowerMode, false);

      observatory.setLowPowerMode(true);
      assert.equal(observatory.isLowPowerMode, true);
      observatory.setProjectionMode('orthographic');
      observatory.render(new Date());

      observatory.setProjectionMode('equirectangular');
      observatory.render(new Date());

      observatory.setLowPowerMode(false);
      assert.equal(observatory.isLowPowerMode, false);

      // Telemetry Display
      const analemmaCanvas = createMockCanvas();
      const container = { innerHTML: '' };
      const telemetry = new TelemetryDisplay(container, analemmaCanvas);
      assert.equal(telemetry.isLowPowerMode, false);

      telemetry.setLowPowerMode(true);
      assert.equal(telemetry.isLowPowerMode, true);
      telemetry.render(new Date(), { lat: 51.5, lon: 0.0, name: 'Greenwich' });
    });

    it('executes 1,000 continuous render frames without memory leak or context explosion', async () => {
      const { ChronometerDial } = await import('../src/ui/chronometer-dial.js');
      let contextAllocations = 0;
      const mockCanvas = {
        getContext: () => {
          contextAllocations++;
          return {
            save: () => {},
            restore: () => {},
            clearRect: () => {},
            beginPath: () => {},
            arc: () => {},
            fill: () => {},
            stroke: () => {},
            moveTo: () => {},
            lineTo: () => {},
            closePath: () => {},
            translate: () => {},
            rotate: () => {},
            scale: () => {},
            setLineDash: () => {},
            getLineDash: () => [],
            createRadialGradient: () => ({ addColorStop: () => {} }),
            createLinearGradient: () => ({ addColorStop: () => {} }),
            fillText: () => {},
            strokeText: () => {},
            measureText: () => ({ width: 10 }),
            clip: () => {}
          };
        },
        getBoundingClientRect: () => ({ width: 380, height: 380 }),
        width: 380,
        height: 380
      };

      const dial = new ChronometerDial(mockCanvas);
      assert.equal(contextAllocations, 1, 'Canvas context should be initialized exactly once');

      const now = Date.now();
      for (let i = 0; i < 1000; i++) {
        dial.render({
          utcDate: new Date(now + i * 16),
          solarApparentHours: (i * 0.01) % 24,
          siderealHours: (i * 0.010027) % 24
        });
      }

      // Context allocations must remain exactly 1 across all 1,000 frames
      assert.equal(contextAllocations, 1, 'Zero redundant 2D contexts created during animation loop');
    });
  });

});

