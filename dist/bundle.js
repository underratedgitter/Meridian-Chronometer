/**
 * Meridian Chronometer — Standalone Production Bundle
 * Zero external dependencies. Works on both http:// and file:// protocols.
 */
(() => {
  "use strict";

  // ==========================================
  // Module: src/engine/astronomy.js
  // ==========================================
  /**
   * Meridian Chronometer — Astronomical Mathematics Engine
   * High-precision celestial mechanics based on IAU standards and Jean Meeus algorithms.
   * Zero external runtime dependencies.
   */
  
  const DEG2RAD = Math.PI / 180.0;
  const RAD2DEG = 180.0 / Math.PI;
  
  /**
   * Normalizes an angle in degrees to [0, 360).
   */
  function normalizeDegrees(deg) {
    const b = deg % 360.0;
    return b < 0 ? b + 360.0 : b;
  }
  
  /**
   * Normalizes an angle in hours to [0, 24).
   */
  function normalizeHours(hours) {
    const b = hours % 24.0;
    return b < 0 ? b + 24.0 : b;
  }
  
  /**
   * Converts a JS Date (UTC) to Julian Date (JD).
   * J2000.0 epoch (2000-01-01 12:00:00 UTC) = 2451545.0
   * Unix epoch (1970-01-01 00:00:00 UTC) = 2440587.5
   */
  function getJulianDate(date) {
    const time = date instanceof Date ? date.getTime() : Number(date);
    return time / 86400000.0 + 2440587.5;
  }
  
  /**
   * Converts Julian Date to Julian Centuries elapsed since J2000.0 (T).
   */
  function getJulianCenturies(jd) {
    return (jd - 2451545.0) / 36525.0;
  }
  
  /**
   * Computes Greenwich Mean Sidereal Time (GMST) in decimal hours [0, 24).
   * Standard IAU 1982 / Jean Meeus formula.
   */
  function getGMST(date) {
    const jd = getJulianDate(date);
    const t = getJulianCenturies(jd);
    // Theta in degrees
    const theta = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - (t * t * t) / 38710000.0;
    return normalizeHours(normalizeDegrees(theta) / 15.0);
  }
  
  /**
   * Computes Local Mean Sidereal Time (LMST) in decimal hours [0, 24)
   * for a given geographic longitude in degrees East.
   */
  function getLMST(date, longitudeDeg) {
    const gmst = getGMST(date);
    const offsetHours = longitudeDeg / 15.0;
    return normalizeHours(gmst + offsetHours);
  }
  
  /**
   * Computes detailed Solar Position, Declination, Right Ascension,
   * Equation of Time, and Subsolar Point coordinates.
   */
  function getSolarPosition(date) {
    const jd = getJulianDate(date);
    const t = getJulianCenturies(jd);
  
    // Geometric mean longitude of the Sun (degrees)
    const l0 = normalizeDegrees(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
  
    // Mean anomaly of the Sun (degrees)
    const m = normalizeDegrees(357.52911 + 35999.05029 * t - 0.0001537 * t * t);
    const mRad = m * DEG2RAD;
  
    // Eccentricity of Earth's orbit
    const e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
  
    // Sun's equation of center (degrees)
    const c =
      (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(mRad) +
      (0.019993 - 0.000101 * t) * Math.sin(2 * mRad) +
      0.000289 * Math.sin(3 * mRad);
  
    // Sun's true longitude & apparent longitude
    const sunTrueLon = normalizeDegrees(l0 + c);
    const omega = 125.04 - 1934.136 * t;
    const lambdaApparent = sunTrueLon - 0.00569 - 0.00478 * Math.sin(omega * DEG2RAD);
    const lambdaRad = lambdaApparent * DEG2RAD;
  
    // Mean & true obliquity of the ecliptic (degrees)
    const eps0 = 23.439291 - 0.0130042 * t - 0.00000016 * t * t + 0.000000504 * t * t * t;
    const eps = (eps0 + 0.00256 * Math.cos(omega * DEG2RAD)) * DEG2RAD;
  
    // Right Ascension (alpha in degrees [0, 360))
    const sinAlpha = Math.cos(eps) * Math.sin(lambdaRad);
    const cosAlpha = Math.cos(lambdaRad);
    let alphaDeg = Math.atan2(sinAlpha, cosAlpha) * RAD2DEG;
    alphaDeg = normalizeDegrees(alphaDeg);
  
    // Declination (delta in degrees [-90, +90])
    const sinDelta = Math.sin(eps) * Math.sin(lambdaRad);
    const deltaDeg = Math.asin(sinDelta) * RAD2DEG;
  
    // Equation of Time (EoT in minutes)
    // Smartrigorous formulation using orbital eccentricity and obliquity
    const y = Math.tan(eps / 2.0) ** 2;
    const l0Rad = l0 * DEG2RAD;
    const eotRad =
      y * Math.sin(2 * l0Rad) -
      2 * e * Math.sin(mRad) +
      4 * e * y * Math.sin(mRad) * Math.cos(2 * l0Rad) -
      0.5 * y * y * Math.sin(4 * l0Rad) -
      1.25 * e * e * Math.sin(2 * mRad);
    const equationOfTimeMinutes = eotRad * RAD2DEG * 4.0;
  
    // Subsolar Point (where Sun is at zenith)
    const d = date instanceof Date ? date : new Date(date);
    const utcHours =
      d.getUTCHours() +
      d.getUTCMinutes() / 60.0 +
      d.getUTCSeconds() / 3600.0 +
      d.getUTCMilliseconds() / 3600000.0;
  
    // Longitude where apparent solar time is 12:00:
    // Apparent solar time at Greenwich = utcHours + equationOfTimeMinutes / 60
    // Solar noon at Greenwich occurs when utcHours = 12 - equationOfTimeMinutes / 60
    // Lon = -(utcHours - 12 + EoT/60) * 15
    let subsolarLon = -(utcHours - 12.0 + equationOfTimeMinutes / 60.0) * 15.0;
    // Wrap to [-180, 180]
    while (subsolarLon > 180) subsolarLon -= 360;
    while (subsolarLon < -180) subsolarLon += 360;
  
    return {
      declinationDeg: deltaDeg,
      rightAscensionDeg: alphaDeg,
      rightAscensionHours: alphaDeg / 15.0,
      equationOfTimeMinutes,
      subsolarPoint: {
        latitudeDeg: deltaDeg,
        longitudeDeg: subsolarLon
      }
    };
  }
  
  /**
   * Calculates Local Solar Time (Mean and Apparent) in hours [0, 24).
   */
  function getLocalSolarTime(date, longitudeDeg) {
    const d = date instanceof Date ? date : new Date(date);
    const utcHours =
      d.getUTCHours() +
      d.getUTCMinutes() / 60.0 +
      d.getUTCSeconds() / 3600.0 +
      d.getUTCMilliseconds() / 3600000.0;
  
    const { equationOfTimeMinutes } = getSolarPosition(d);
    const meanHours = normalizeHours(utcHours + longitudeDeg / 15.0);
    const apparentHours = normalizeHours(meanHours + equationOfTimeMinutes / 60.0);
  
    return {
      meanHours,
      apparentHours,
      equationOfTimeMinutes
    };
  }
  
  /**
   * Calculates high-precision Celestial Telemetry for an observer:
   * Solar noon, sunrise, sunset, golden hour, civil/nautical/astronomical twilights.
   */
  function getCelestialTelemetry(date, latitudeDeg, longitudeDeg) {
    const d = date instanceof Date ? date : new Date(date);
    // Reference date at UTC midnight of the target day
    const midnightUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  
    // Solar position near midday
    const middayDate = new Date(midnightUtc + 12 * 3600 * 1000);
    const { declinationDeg, equationOfTimeMinutes } = getSolarPosition(middayDate);
  
    // Solar noon in UTC hours
    const solarNoonHours = 12.0 - longitudeDeg / 15.0 - equationOfTimeMinutes / 60.0;
    const solarNoonTimeMs = midnightUtc + solarNoonHours * 3600 * 1000;
    const solarNoonUTC = new Date(solarNoonTimeMs);
  
    const phiRad = latitudeDeg * DEG2RAD;
    const deltaRad = declinationDeg * DEG2RAD;
  
    /**
     * Computes event times for a given solar altitude h0 in degrees.
     * Returns { rise: Date | null, set: Date | null, status: 'normal'|'polar_day'|'polar_night' }
     */
    function calcTimesForAltitude(h0Deg) {
      const h0Rad = h0Deg * DEG2RAD;
      const cosH = (Math.sin(h0Rad) - Math.sin(phiRad) * Math.sin(deltaRad)) /
                   (Math.cos(phiRad) * Math.cos(deltaRad));
  
      if (cosH > 1.0) {
        return { rise: null, set: null, status: 'polar_night' };
      }
      if (cosH < -1.0) {
        return { rise: null, set: null, status: 'polar_day' };
      }
  
      const hRad = Math.acos(cosH);
      const deltaHours = (hRad * RAD2DEG) / 15.0;
      const deltaMs = deltaHours * 3600 * 1000;
  
      return {
        rise: new Date(solarNoonTimeMs - deltaMs),
        set: new Date(solarNoonTimeMs + deltaMs),
        status: 'normal'
      };
    }
  
    // Standard atmospheric refraction + solar disc semi-diameter: h0 = -0.833°
    const solarTimes = calcTimesForAltitude(-0.833);
    // Golden hour upper boundary: h0 = +6.0°
    const goldenHourTimes = calcTimesForAltitude(6.0);
    // Civil twilight: h0 = -6.0°
    const civilTimes = calcTimesForAltitude(-6.0);
    // Nautical twilight: h0 = -12.0°
    const nauticalTimes = calcTimesForAltitude(-12.0);
    // Astronomical twilight: h0 = -18.0°
    const astroTimes = calcTimesForAltitude(-18.0);
  
    const dayLengthMs = solarTimes.rise && solarTimes.set
      ? solarTimes.set.getTime() - solarTimes.rise.getTime()
      : (solarTimes.status === 'polar_day' ? 86400000 : 0);
  
    return {
      solarNoonUTC,
      sunriseUTC: solarTimes.rise,
      sunsetUTC: solarTimes.set,
      dayLengthHours: dayLengthMs / 3600000.0,
      solarElevationAtNoonDeg: 90 - Math.abs(latitudeDeg - declinationDeg),
      goldenHourEndMorningUTC: goldenHourTimes.set ? goldenHourTimes.rise : null,
      goldenHourStartEveningUTC: goldenHourTimes.set,
      civilDawnUTC: civilTimes.rise,
      civilDuskUTC: civilTimes.set,
      nauticalDawnUTC: nauticalTimes.rise,
      nauticalDuskUTC: nauticalTimes.set,
      astronomicalDawnUTC: astroTimes.rise,
      astronomicalDuskUTC: astroTimes.set,
      equationOfTimeMinutes
    };
  }
  
  /**
   * Computes Lunar Complication:
   * Illuminated fraction, phase name, lunar age, and countdowns to next Full/New Moon.
   * Jean Meeus astronomical algorithms (ch. 48 & 49).
   */
  function getLunarComplication(date) {
    const jd = getJulianDate(date);
    const t = getJulianCenturies(jd);
  
    // Mean elongation of the Moon (degrees)
    const d = normalizeDegrees(
      297.8501921 + 445267.1114034 * t - 0.0018819 * t * t + (t * t * t) / 545868.0
    );
  
    // Sun's mean anomaly (degrees)
    const m = normalizeDegrees(
      357.5291092 + 35999.0502909 * t - 0.0001536 * t * t + (t * t * t) / 24490000.0
    );
  
    // Moon's mean anomaly (degrees)
    const mPrime = normalizeDegrees(
      134.9633964 + 477198.8675055 * t + 0.0087414 * t * t + (t * t * t) / 69699.0
    );
  
    const dRad = d * DEG2RAD;
    const mRad = m * DEG2RAD;
    const mpRad = mPrime * DEG2RAD;
  
    // Phase angle i (degrees)
    let i =
      180.0 -
      d -
      6.289 * Math.sin(mpRad) +
      2.100 * Math.sin(mRad) -
      1.274 * Math.sin(2 * dRad - mpRad) -
      0.658 * Math.sin(2 * dRad) -
      0.214 * Math.sin(2 * mpRad) -
      0.110 * Math.sin(dRad);
  
    i = normalizeDegrees(i);
  
    // Illuminated fraction k [0, 1]
    const illuminationFraction = (1.0 + Math.cos(i * DEG2RAD)) / 2.0;
  
    // Mean synodic month = 29.530588853 days
    const SYNODIC_MONTH = 29.530588853;
    const lunarAgeDays = (d / 360.0) * SYNODIC_MONTH;
  
    // Next Full Moon occurs at d = 180°
    let daysToNextFullMoon = ((180.0 - d + 360.0) % 360.0) / 360.0 * SYNODIC_MONTH;
    // Next New Moon occurs at d = 360° (0°)
    let daysToNextNewMoon = ((360.0 - d) % 360.0) / 360.0 * SYNODIC_MONTH;
  
    // Phase Name determination
    let phaseName;
    if (illuminationFraction <= 0.025 || d < 6 || d > 354) {
      phaseName = 'New Moon';
    } else if (illuminationFraction >= 0.975 || (d >= 174 && d <= 186)) {
      phaseName = 'Full Moon';
    } else if (d > 6 && d < 84) {
      phaseName = 'Waxing Crescent';
    } else if (d >= 84 && d <= 96) {
      phaseName = 'First Quarter';
    } else if (d > 96 && d < 174) {
      phaseName = 'Waxing Gibbous';
    } else if (d > 186 && d < 264) {
      phaseName = 'Waning Gibbous';
    } else if (d >= 264 && d <= 276) {
      phaseName = 'Last Quarter';
    } else {
      phaseName = 'Waning Crescent';
    }
  
    const isWaxing = d < 180.0;
  
    return {
      illuminationFraction,
      illuminationPercent: (illuminationFraction * 100).toFixed(1),
      phaseAngleDeg: i,
      lunarAgeDays,
      phaseName,
      isWaxing,
      daysToNextFullMoon,
      daysToNextNewMoon
    };
  }
  
  /**
   * Computes Solar Terminator boundary coordinates across Earth for a given date/time.
   * Returns an array of { latitudeDeg, longitudeDeg } points.
   * Uses robust spherical small/great circle geometry avoiding any division-by-zero singularities.
   */
  function getTerminatorPoints(date, numPoints = 360, altitudeDeg = 0) {
    const { subsolarPoint } = getSolarPosition(date);
    const phiSRad = subsolarPoint.latitudeDeg * DEG2RAD;
    const lambdaSDeg = subsolarPoint.longitudeDeg;
  
    // Angular radius of circle from subsolar point on sphere: psi = 90° - altitudeDeg
    const psiRad = (90.0 - altitudeDeg) * DEG2RAD;
    const sinPsi = Math.sin(psiRad);
    const cosPsi = Math.cos(psiRad);
    const sinPhiS = Math.sin(phiSRad);
    const cosPhiS = Math.cos(phiSRad);
  
    const points = [];
    for (let i = 0; i < numPoints; i++) {
      const alpha = (i / numPoints) * 2.0 * Math.PI;
      // Spherical trigonometry small/great circle formula
      const sinPhi = sinPhiS * cosPsi + cosPhiS * sinPsi * Math.cos(alpha);
      const clampedSinPhi = Math.max(-1.0, Math.min(1.0, sinPhi));
      const latDeg = Math.asin(clampedSinPhi) * RAD2DEG;
  
      const y = Math.sin(alpha) * sinPsi;
      const x = cosPsi * cosPhiS - sinPhiS * sinPsi * Math.cos(alpha);
      const dLamDeg = Math.atan2(y, x) * RAD2DEG;
  
      let lonDeg = lambdaSDeg + dLamDeg;
      while (lonDeg > 180.0) lonDeg -= 360.0;
      while (lonDeg < -180.0) lonDeg += 360.0;
  
      points.push({ latitudeDeg: latDeg, longitudeDeg: lonDeg });
    }
  
    return points;
  }
  
  /**
   * Returns a smooth closed polygon of the Night Shadow on an equirectangular projection.
   * Coordinates are formatted for canvas or SVG paths.
   */
  function getNightShadowPolygon(date, numSteps = 360) {
    const { subsolarPoint } = getSolarPosition(date);
    const terminator = getTerminatorPoints(date, numSteps, 0);
  
    // Determine which pole is in darkness (opposite hemisphere of subsolar point)
    const southPoleDark = subsolarPoint.latitudeDeg > 0;
  
    // Points starting along terminator
    const polygon = [...terminator];
  
    if (southPoleDark) {
      // Traverse bottom edge of map (-90 lat) from lon 180 to -180
      polygon.push({ latitudeDeg: -90, longitudeDeg: 180 });
      polygon.push({ latitudeDeg: -90, longitudeDeg: -180 });
    } else {
      // Traverse top edge of map (+90 lat) from lon 180 to -180
      polygon.push({ latitudeDeg: 90, longitudeDeg: 180 });
      polygon.push({ latitudeDeg: 90, longitudeDeg: -180 });
    }
  
    return polygon;
  }
  

  // ==========================================
  // Module: src/engine/world-geometry.js
  // ==========================================
  /**
   * Meridian Chronometer — World Geometry
   * Simplified high-accuracy equirectangular landmass contours for Earth's continents.
   * Zero external dependencies. Designed for fast Canvas 2D / SVG projection.
   * Coordinates are [longitudeDeg, latitudeDeg].
   */
  
  const PRESET_OBSERVATORIES = [
    { id: 'greenwich', name: 'Royal Observatory Greenwich', lat: 51.4769, lon: 0.0005, country: 'United Kingdom' },
    { id: 'mauna_kea', name: 'Mauna Kea Observatories', lat: 19.8206, lon: -155.4681, country: 'Hawaii, USA' },
    { id: 'paranal', name: 'ESO Paranal Observatory', lat: -24.6272, lon: -70.4042, country: 'Chile (Atacama)' },
    { id: 'roque', name: 'Roque de los Muchachos', lat: 28.7606, lon: -17.8816, country: 'Canary Islands, Spain' },
    { id: 'tokyo', name: 'National Astronomical Observatory', lat: 35.6762, lon: 139.6503, country: 'Japan' },
    { id: 'siding_spring', name: 'Siding Spring Observatory', lat: -31.2756, lon: 149.0700, country: 'Australia' },
    { id: 'south_african', name: 'South African Astronomical Obs', lat: -32.3783, lon: 20.8108, country: 'South Africa' },
    { id: 'jpl', name: 'NASA Jet Propulsion Laboratory', lat: 34.2003, lon: -118.1712, country: 'California, USA' }
  ];
  
  const PRESET_EPOCHS = [
    { label: 'Live Realtime', timestamp: null },
    { label: 'Summer Solstice 2024', iso: '2024-06-20T20:51:00Z' },
    { label: 'Winter Solstice 2024', iso: '2024-12-21T09:21:00Z' },
    { label: 'Vernal Equinox 2024', iso: '2024-03-20T03:06:00Z' },
    { label: 'Autumnal Equinox 2024', iso: '2024-09-22T12:44:00Z' },
    { label: 'Great American Eclipse 2024', iso: '2024-04-08T18:18:00Z' },
    { label: 'Apollo 11 Lunar Landing 1969', iso: '1969-07-20T20:17:40Z' }
  ];
  
  // Simplified high-fidelity closed polygonal contours for the world's main landmasses:
  // Longitude: -180 to 180, Latitude: -90 to 90.
  const WORLD_CONTINENTS = [
    // North America
    [
      [-168, 65], [-162, 70], [-152, 71], [-130, 69], [-115, 68], [-95, 70], [-82, 65], [-76, 73],
      [-65, 64], [-60, 55], [-55, 52], [-60, 44], [-67, 44], [-70, 42], [-76, 35], [-81, 31],
      [-81, 25], [-84, 30], [-90, 30], [-97, 26], [-97, 20], [-91, 19], [-87, 21], [-83, 10],
      [-77, 8], [-80, 9], [-84, 10], [-90, 14], [-96, 16], [-105, 20], [-106, 23], [-110, 24],
      [-112, 30], [-117, 32], [-124, 38], [-124, 46], [-128, 51], [-136, 58], [-146, 60], [-158, 58],
      [-164, 60], [-168, 65]
    ],
    // Greenland
    [
      [-44, 60], [-35, 66], [-20, 70], [-18, 77], [-22, 82], [-35, 83], [-50, 82], [-60, 81],
      [-70, 77], [-56, 72], [-50, 65], [-44, 60]
    ],
    // South America
    [
      [-77, 8], [-72, 11], [-62, 10], [-52, 5], [-48, 0], [-35, -5], [-35, -9], [-39, -15],
      [-42, -23], [-48, -27], [-54, -34], [-58, -34], [-65, -42], [-66, -48], [-66, -55], [-74, -53],
      [-74, -45], [-71, -38], [-71, -30], [-76, -18], [-81, -5], [-79, 1], [-77, 8]
    ],
    // Eurasia
    [
      [-9, 36], [-9, 43], [-1, 44], [0, 46], [2, 51], [8, 55], [10, 58], [12, 55], [18, 55],
      [24, 60], [30, 70], [42, 67], [50, 68], [60, 70], [75, 73], [85, 73], [100, 76], [115, 73],
      [135, 72], [145, 72], [160, 70], [170, 68], [180, 65], [170, 64], [163, 60], [160, 54],
      [156, 51], [143, 48], [135, 43], [130, 42], [128, 38], [122, 38], [120, 32], [118, 25],
      [109, 20], [108, 15], [104, 10], [100, 3], [104, 1], [99, 10], [93, 18], [90, 22],
      [80, 16], [78, 8], [74, 15], [68, 24], [60, 25], [56, 26], [50, 30], [48, 30],
      [40, 22], [44, 14], [44, 12], [35, 15], [35, 28], [34, 32], [28, 37], [26, 40],
      [20, 40], [15, 40], [15, 45], [5, 43], [-1, 42], [-5, 36], [-9, 36]
    ],
    // Africa
    [
      [-17, 15], [-17, 21], [-13, 28], [-6, 36], [0, 36], [11, 37], [12, 33], [24, 32],
      [32, 31], [35, 28], [39, 22], [43, 13], [51, 12], [44, 2], [40, -5], [36, -17],
      [32, -29], [26, -34], [18, -34], [14, -28], [12, -18], [9, -4], [9, 4], [2, 6],
      [-5, 5], [-13, 9], [-17, 15]
    ],
    // Australia
    [
      [114, -22], [114, -34], [118, -35], [128, -32], [135, -34], [138, -35], [140, -38],
      [148, -38], [153, -28], [150, -22], [143, -13], [137, -12], [136, -16], [130, -12],
      [124, -16], [118, -20], [114, -22]
    ],
    // United Kingdom & Ireland
    [
      [-5, 50], [1, 51], [1, 53], [-1, 54], [-2, 58], [-5, 58], [-5, 55], [-3, 53],
      [-5, 50]
    ],
    // Japan (Honshu/Hokkaido)
    [
      [130, 32], [132, 34], [136, 35], [140, 36], [141, 41], [144, 44], [141, 45], [140, 41],
      [137, 37], [133, 35], [130, 32]
    ],
    // Madagascar
    [
      [44, -13], [50, -15], [48, -25], [44, -25], [44, -13]
    ],
    // Antarctica
    [
      [-180, -78], [-140, -75], [-100, -72], [-60, -65], [-30, -72], [0, -70],
      [30, -68], [60, -66], [90, -66], [120, -66], [150, -68], [180, -78]
    ]
  ];
  

  // ==========================================
  // Module: src/engine/time-controller.js
  // ==========================================
  /**
   * Meridian Chronometer — Time Controller
   * Coordinates system realtime synchronization, simulated time progression,
   * scrub timeline manipulation, acceleration multipliers, and change listener subscriptions.
   */
  
  class TimeController {
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
  

  // ==========================================
  // Module: src/ui/audio-escapement.js
  // ==========================================
  /**
   * Meridian Chronometer — Mechanical Escapement Synthesizer
   * Uses Web Audio API to create authentic, subtle horological ticking sound.
   * Zero external audio assets required.
   */
  
  class EscapementAudio {
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
  

  // ==========================================
  // Module: src/ui/chronometer-dial.js
  // ==========================================
  /**
   * Meridian Chronometer — Main Chronometer Dial
   * High-precision luxury astronomical horological dial.
   * Renders 24-hour UTC, Local Apparent Solar Time, and Sidereal Time with continuous sweeping hands.
   */
  
  class ChronometerDial {
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
  

  // ==========================================
  // Module: src/ui/world-observatory.js
  // ==========================================
  /**
   * Meridian Chronometer — World Solar Observatory
   * Real-time equirectangular Earth observatory map.
   * Projects real-time solar terminator, multi-band twilight gradients,
   * subsolar zenith reticle, and interactive observer coordinates.
   */
  
  
  
  
  class WorldObservatory {
    constructor(canvasElement, options = {}) {
      this.canvas = canvasElement;
      this.ctx = canvasElement.getContext('2d');
      this.options = {
        primaryGold: '#c8aa6e',
        goldLight: '#e8ca8e',
        platinum: '#d8e2ec',
        obsidianDark: '#080a0f',
        landFill: '#171c26',
        landBorder: 'rgba(216, 226, 236, 0.22)',
        oceanFill: '#0b0e14',
        gridColor: 'rgba(216, 226, 236, 0.08)',
        equatorColor: 'rgba(200, 170, 110, 0.25)',
        tropicColor: 'rgba(200, 170, 110, 0.15)',
        ...options
      };
  
      this.observer = {
        lat: 51.4769,
        lon: 0.0005,
        name: 'Royal Observatory Greenwich'
      };
  
      this.hoverCoord = null;
      this.onObserverChange = null;
      this.isDragging = false;
      this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  
      this.setupInteractivity();
      this.resize();
    }
  
    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.width = rect.width || 600;
      this.height = rect.height || 300;
      this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
    }
  
    setObserver(lat, lon, name = 'Custom Observer') {
      this.observer.lat = Math.max(-90, Math.min(90, lat));
      this.observer.lon = Math.max(-180, Math.min(180, lon));
      this.observer.name = name;
      if (this.onObserverChange) {
        this.onObserverChange(this.observer);
      }
    }
  
    setupInteractivity() {
      const handleCoordEvent = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
  
        // Convert Canvas pixel to equirectangular [lon, lat]
        const lon = (x / rect.width) * 360 - 180;
        const lat = 90 - (y / rect.height) * 180;
  
        return {
          lat: Math.max(-90, Math.min(90, lat)),
          lon: Math.max(-180, Math.min(180, lon))
        };
      };
  
      this.canvas.addEventListener('mousemove', (e) => {
        const coord = handleCoordEvent(e);
        this.hoverCoord = coord;
        if (this.isDragging) {
          this.setObserver(coord.lat, coord.lon, 'Selected Position');
        }
      });
  
      this.canvas.addEventListener('mousedown', (e) => {
        this.isDragging = true;
        const coord = handleCoordEvent(e);
        this.setObserver(coord.lat, coord.lon, 'Selected Position');
      });
  
      window.addEventListener('mouseup', () => {
        this.isDragging = false;
      });
  
      this.canvas.addEventListener('mouseleave', () => {
        this.hoverCoord = null;
        this.isDragging = false;
      });
    }
  
    /**
     * Project geographic coordinates [lon, lat] to Canvas coordinates [x, y].
     */
    project(lon, lat) {
      const w = this.canvas.width;
      const h = this.canvas.height;
      const x = ((lon + 180) / 360.0) * w;
      const y = ((90 - lat) / 180.0) * h;
      return [x, y];
    }
  
    render(date) {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;
      const dpr = this.dpr;
      const opt = this.options;
  
      ctx.save();
      ctx.clearRect(0, 0, w, h);
  
      // 1. Ocean Background
      ctx.fillStyle = opt.oceanFill;
      ctx.fillRect(0, 0, w, h);
  
      // 2. Graticule Lines (Equator, Meridians, Tropics, Polar Circles)
      this.drawGraticule(ctx, w, h);
  
      // 3. World Continents Landmass Polygons
      this.drawLandmasses(ctx);
  
      // 4. Multi-band Solar Twilight and Night Shadow
      this.drawTwilightAndNightShadow(ctx, date, w, h);
  
      // 5. Preset Observatories Markers
      this.drawPresetObservatories(ctx, dpr);
  
      // 6. Subsolar Point (Zenith Reticle) & Antipodal Nadir
      this.drawSubsolarPoints(ctx, date, dpr);
  
      // 7. Observer Crosshairs & Telemetry Tag
      this.drawObserver(ctx, dpr);
  
      // 8. Hairline Platinum Border & Frame Accents
      this.drawObservatoryFrame(ctx, w, h, dpr);
  
      ctx.restore();
    }
  
    drawGraticule(ctx, w, h) {
      const opt = this.options;
      const dpr = this.dpr;
  
      ctx.lineWidth = 0.5 * dpr;
  
      // Meridians every 15° (1 hour of solar time)
      for (let lon = -180; lon <= 180; lon += 15) {
        const [x] = this.project(lon, 0);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.strokeStyle = lon === 0 ? 'rgba(200, 170, 110, 0.4)' : opt.gridColor;
        ctx.stroke();
      }
  
      // Parallels every 15°
      for (let lat = -75; lat <= 75; lat += 15) {
        const [, y] = this.project(0, lat);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.strokeStyle = opt.gridColor;
        ctx.stroke();
      }
  
      // Equator (0°)
      const [, eqY] = this.project(0, 0);
      ctx.beginPath();
      ctx.moveTo(0, eqY);
      ctx.lineTo(w, eqY);
      ctx.strokeStyle = opt.equatorColor;
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();
  
      // Tropics of Cancer & Capricorn (+/- 23.44°)
      for (const lat of [23.44, -23.44]) {
        const [, y] = this.project(0, lat);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.strokeStyle = opt.tropicColor;
        ctx.lineWidth = 0.7 * dpr;
        ctx.setLineDash([3 * dpr, 4 * dpr]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
  
      // Arctic and Antarctic circles (+/- 66.56°)
      for (const lat of [66.56, -66.56]) {
        const [, y] = this.project(0, lat);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.strokeStyle = 'rgba(79, 164, 232, 0.15)';
        ctx.lineWidth = 0.7 * dpr;
        ctx.setLineDash([2 * dpr, 5 * dpr]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  
    drawLandmasses(ctx) {
      const opt = this.options;
      const dpr = this.dpr;
  
      ctx.fillStyle = opt.landFill;
      ctx.strokeStyle = opt.landBorder;
      ctx.lineWidth = 0.8 * dpr;
  
      for (const polygon of WORLD_CONTINENTS) {
        if (polygon.length < 3) continue;
        ctx.beginPath();
        const [firstLon, firstLat] = polygon[0];
        const [startX, startY] = this.project(firstLon, firstLat);
        ctx.moveTo(startX, startY);
  
        for (let i = 1; i < polygon.length; i++) {
          const [lon, lat] = polygon[i];
          const [x, y] = this.project(lon, lat);
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  
    initShadowMap() {
      if (typeof document !== 'undefined') {
        this.shadowW = 360;
        this.shadowH = 180;
        this.shadowCanvas = document.createElement('canvas');
        this.shadowCanvas.width = this.shadowW;
        this.shadowCanvas.height = this.shadowH;
        this.shadowCtx = this.shadowCanvas.getContext('2d');
        this.shadowImageData = this.shadowCtx.createImageData(this.shadowW, this.shadowH);
      }
    }
  
    /**
     * Draws multi-band twilight gradients and deep night shadow using direct
     * spherical solar altitude matrix. Eliminates polygon self-intersection artifacts.
     */
    drawTwilightAndNightShadow(ctx, date, w, h) {
      const { subsolarPoint } = getSolarPosition(date);
      const phiSRad = subsolarPoint.latitudeDeg * (Math.PI / 180);
      const lamSRad = subsolarPoint.longitudeDeg * (Math.PI / 180);
      const sinPhiS = Math.sin(phiSRad);
      const cosPhiS = Math.cos(phiSRad);
  
      if (!this.shadowImageData) {
        this.initShadowMap();
      }
  
      if (this.shadowImageData) {
        const buf = this.shadowImageData.data;
        const sw = this.shadowW;
        const sh = this.shadowH;
  
        for (let y = 0; y < sh; y++) {
          const phi = (90 - (y / sh) * 180) * (Math.PI / 180);
          const sinPhi = Math.sin(phi);
          const cosPhi = Math.cos(phi);
          const term1 = sinPhi * sinPhiS;
          const term2 = cosPhi * cosPhiS;
          const rowOffset = y * sw * 4;
  
          for (let x = 0; x < sw; x++) {
            const lam = ((x / sw) * 360 - 180) * (Math.PI / 180);
            const sinAlt = term1 + term2 * Math.cos(lam - lamSRad);
            const idx = rowOffset + x * 4;
  
            // Atmospheric nocturnal shadow palette:
            // Deep obsidian/navy with warm golden glow at optical horizon
            if (sinAlt >= 0.1045) {
              // Full daylight (altitude >= +6°)
              buf[idx + 3] = 0;
            } else if (sinAlt > 0) {
              // Golden hour (0° to +6°)
              buf[idx] = 200;
              buf[idx + 1] = 170;
              buf[idx + 2] = 110;
              buf[idx + 3] = Math.round((1 - sinAlt / 0.1045) * 30);
            } else if (sinAlt >= -0.1045) {
              // Civil twilight (0° to -6°)
              buf[idx] = 10;
              buf[idx + 1] = 16;
              buf[idx + 2] = 32;
              buf[idx + 3] = Math.round(50 + (-sinAlt / 0.1045) * 60);
            } else if (sinAlt >= -0.2079) {
              // Nautical twilight (-6° to -12°)
              buf[idx] = 7;
              buf[idx + 1] = 10;
              buf[idx + 2] = 22;
              buf[idx + 3] = Math.round(110 + ((-sinAlt - 0.1045) / 0.1034) * 55);
            } else if (sinAlt >= -0.3090) {
              // Astronomical twilight (-12° to -18°)
              buf[idx] = 5;
              buf[idx + 1] = 7;
              buf[idx + 2] = 16;
              buf[idx + 3] = Math.round(165 + ((-sinAlt - 0.2079) / 0.1011) * 35);
            } else {
              // Complete astronomical night (< -18°)
              buf[idx] = 4;
              buf[idx + 1] = 5;
              buf[idx + 2] = 11;
              buf[idx + 3] = 215; // deep obsidian shadow
            }
          }
        }
  
        this.shadowCtx.putImageData(this.shadowImageData, 0, 0);
  
        // Render smooth interpolated shadow over the map
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this.shadowCanvas, 0, 0, w, h);
        ctx.restore();
      }
  
      // Crisp glowing optical horizon line (alt = 0°)
      const term0 = getTerminatorPoints(date, 360, 0);
      ctx.save();
      ctx.strokeStyle = 'rgba(200, 170, 110, 0.7)';
      ctx.lineWidth = 1.4 * this.dpr;
      ctx.shadowColor = 'rgba(200, 170, 110, 0.6)';
      ctx.shadowBlur = 8 * this.dpr;
  
      ctx.beginPath();
      let isDrawing = false;
      for (let i = 0; i < term0.length; i++) {
        const pt = term0[i];
        const [tx, ty] = this.project(pt.longitudeDeg, pt.latitudeDeg);
        if (i > 0) {
          const prevPt = term0[i - 1];
          // Break path across antimeridian wrap (-180 / +180) to avoid screen-wide horizontal lines
          if (Math.abs(pt.longitudeDeg - prevPt.longitudeDeg) > 180) {
            ctx.stroke();
            ctx.beginPath();
            isDrawing = false;
          }
        }
        if (!isDrawing) {
          ctx.moveTo(tx, ty);
          isDrawing = true;
        } else {
          ctx.lineTo(tx, ty);
        }
      }
      ctx.stroke();
      ctx.restore();
    }
  
    drawPresetObservatories(ctx, dpr) {
      for (const obs of PRESET_OBSERVATORIES) {
        // Don't duplicate active observer
        if (Math.abs(obs.lat - this.observer.lat) < 0.1 && Math.abs(obs.lon - this.observer.lon) < 0.1) {
          continue;
        }
        const [x, y] = this.project(obs.lon, obs.lat);
        ctx.beginPath();
        ctx.arc(x, y, 1.8 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(216, 226, 236, 0.4)';
        ctx.fill();
      }
    }
  
    drawSubsolarPoints(ctx, date, dpr) {
      const { subsolarPoint } = getSolarPosition(date);
      const [sunX, sunY] = this.project(subsolarPoint.longitudeDeg, subsolarPoint.latitudeDeg);
  
      // Golden solar zenith reticle
      ctx.save();
      ctx.translate(sunX, sunY);
  
      // Glowing solar disc
      const sunGrad = ctx.createRadialGradient(0, 0, 1 * dpr, 0, 0, 8 * dpr);
      sunGrad.addColorStop(0, '#fff4d0');
      sunGrad.addColorStop(0.4, '#c8aa6e');
      sunGrad.addColorStop(1, 'rgba(200, 170, 110, 0)');
  
      ctx.beginPath();
      ctx.arc(0, 0, 8 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = sunGrad;
      ctx.fill();
  
      // Central sun dot
      ctx.beginPath();
      ctx.arc(0, 0, 2.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
  
      // Radiating reticle crosshairs
      ctx.strokeStyle = '#c8aa6e';
      ctx.lineWidth = 1 * dpr;
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, 4 * dpr);
        ctx.lineTo(0, 9 * dpr);
        ctx.stroke();
      }
  
      ctx.restore();
  
      // Antipodal Nadir (midnight center)
      let nadirLon = subsolarPoint.longitudeDeg + 180;
      if (nadirLon > 180) nadirLon -= 360;
      const nadirLat = -subsolarPoint.latitudeDeg;
      const [nadirX, nadirY] = this.project(nadirLon, nadirLat);
  
      ctx.save();
      ctx.beginPath();
      ctx.arc(nadirX, nadirY, 3 * dpr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(79, 164, 232, 0.5)';
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();
      ctx.restore();
    }
  
    drawObserver(ctx, dpr) {
      const [x, y] = this.project(this.observer.lon, this.observer.lat);
  
      ctx.save();
      // Pulsing outer beacon ring
      ctx.beginPath();
      ctx.arc(x, y, 7 * dpr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200, 170, 110, 0.7)';
      ctx.lineWidth = 1.2 * dpr;
      ctx.stroke();
  
      // Inner bright core
      ctx.beginPath();
      ctx.arc(x, y, 2.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
  
      // Crosshair lines
      ctx.strokeStyle = 'rgba(232, 202, 142, 0.8)';
      ctx.lineWidth = 1 * dpr;
  
      ctx.beginPath();
      ctx.moveTo(x - 11 * dpr, y);
      ctx.lineTo(x - 8 * dpr, y);
      ctx.moveTo(x + 8 * dpr, y);
      ctx.lineTo(x + 11 * dpr, y);
      ctx.moveTo(x, y - 11 * dpr);
      ctx.lineTo(x, y - 8 * dpr);
      ctx.moveTo(x, y + 8 * dpr);
      ctx.lineTo(x, y + 11 * dpr);
      ctx.stroke();
  
      // Label
      ctx.fillStyle = '#e8ca8e';
      ctx.font = `600 ${Math.round(8 * dpr)}px "Space Mono", monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`⌖ ${this.observer.name}`, x + 9 * dpr, y - 8 * dpr);
  
      ctx.restore();
    }
  
    drawObservatoryFrame(ctx, w, h, dpr) {
      const opt = this.options;
  
      // Hairline platinum frame
      ctx.strokeStyle = 'rgba(216, 226, 236, 0.16)';
      ctx.lineWidth = 1 * dpr;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  
      // Corner bracket ornaments (Observatory telemetry style)
      const bracketSize = 10 * dpr;
      ctx.strokeStyle = opt.primaryGold;
      ctx.lineWidth = 1.5 * dpr;
  
      // Top-left
      ctx.beginPath();
      ctx.moveTo(0.5, bracketSize);
      ctx.lineTo(0.5, 0.5);
      ctx.lineTo(bracketSize, 0.5);
      ctx.stroke();
  
      // Top-right
      ctx.beginPath();
      ctx.moveTo(w - bracketSize, 0.5);
      ctx.lineTo(w - 0.5, 0.5);
      ctx.lineTo(w - 0.5, bracketSize);
      ctx.stroke();
  
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(0.5, h - bracketSize);
      ctx.lineTo(0.5, h - 0.5);
      ctx.lineTo(bracketSize, h - 0.5);
      ctx.stroke();
  
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(w - bracketSize, h - 0.5);
      ctx.lineTo(w - 0.5, h - 0.5);
      ctx.lineTo(w - 0.5, h - bracketSize);
      ctx.stroke();
  
      // Telemetry stamp in top corner
      ctx.fillStyle = 'rgba(200, 170, 110, 0.8)';
      ctx.font = `600 ${Math.round(7 * dpr)}px "Space Mono", monospace`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('SOLAR TERMINATOR OBSERVATORY // EQUIRECTANGULAR', w - 14 * dpr, 6 * dpr);
    }
  }
  

  // ==========================================
  // Module: src/ui/lunar-complication.js
  // ==========================================
  /**
   * Meridian Chronometer — Lunar Complication
   * Physically accurate mechanical moon phase complication dial.
   * Renders dynamic spherical lunar illumination, crater shading,
   * and precision lunar telemetry.
   */
  
  
  
  class LunarComplication {
    constructor(canvasElement, telemetryContainer, options = {}) {
      this.canvas = canvasElement;
      this.ctx = canvasElement.getContext('2d');
      this.container = telemetryContainer;
      this.options = {
        primaryGold: '#c8aa6e',
        goldLight: '#e8ca8e',
        platinum: '#d8e2ec',
        deepSky: '#05070e',
        moonBright: '#eaf0f8',
        moonDark: '#121620',
        craterColor: 'rgba(90, 105, 125, 0.28)',
        ...options
      };
  
      this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      this.resize();
    }
  
    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.width = rect.width || 180;
      this.height = rect.height || 180;
      this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
    }
  
    render(date) {
      const complication = getLunarComplication(date);
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;
      const dpr = this.dpr;
      const cx = w / 2;
      const cy = h / 2;
      const r = (Math.min(w, h) / 2) * 0.88;
  
      ctx.save();
      ctx.clearRect(0, 0, w, h);
  
      // 1. Dial Bezel and Starfield Background
      this.drawStarfieldAperture(ctx, cx, cy, r, dpr);
  
      // 2. Realistic Spherical Moon with Exact Terminator Curvature
      this.drawSphericalMoon(ctx, cx, cy, r * 0.72, complication, dpr);
  
      // 3. Complication Bezel & Graduated Indices
      this.drawComplicationBezel(ctx, cx, cy, r, dpr);
  
      ctx.restore();
  
      // 4. Update DOM telemetry throttled at 2Hz
      const curSec = Math.floor(date.getTime() / 500);
      if (curSec !== this.lastRenderSec) {
        this.lastRenderSec = curSec;
        this.updateTelemetry(complication);
      }
    }
  
    drawStarfieldAperture(ctx, cx, cy, r, dpr) {
      // Deep nocturnal aperture
      const skyGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      skyGrad.addColorStop(0, '#0a0f1c');
      skyGrad.addColorStop(0.8, '#060810');
      skyGrad.addColorStop(1, '#030408');
  
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = skyGrad;
      ctx.fill();
  
      // Engraved celestial gold stars
      const starAngles = [0.3, 0.85, 1.4, 2.1, 2.7, 3.5, 4.2, 4.9, 5.7];
      const starRadii = [0.82, 0.78, 0.85, 0.80, 0.84, 0.79, 0.83, 0.76, 0.82];
  
      for (let i = 0; i < starAngles.length; i++) {
        const sx = cx + Math.cos(starAngles[i]) * r * starRadii[i];
        const sy = cy + Math.sin(starAngles[i]) * r * starRadii[i];
  
        ctx.beginPath();
        ctx.arc(sx, sy, (i % 2 === 0 ? 1.2 : 0.8) * dpr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(232, 202, 142, 0.7)';
        ctx.fill();
      }
    }
  
    /**
     * Draws the Moon's spherical disc with authentic phase terminator.
     * Uses parametric 2D projection of spherical illumination.
     */
    drawSphericalMoon(ctx, cx, cy, mr, complication, dpr) {
      const k = complication.illuminationFraction; // [0, 1]
      const isWaxing = complication.isWaxing;
  
      ctx.save();
  
      // Base dark moon sphere (subtle earthshine)
      const darkGrad = ctx.createRadialGradient(cx - mr * 0.2, cy - mr * 0.2, mr * 0.1, cx, cy, mr);
      darkGrad.addColorStop(0, '#1c2230');
      darkGrad.addColorStop(0.7, '#10141e');
      darkGrad.addColorStop(1, '#090b10');
  
      ctx.beginPath();
      ctx.arc(cx, cy, mr, 0, Math.PI * 2);
      ctx.fillStyle = darkGrad;
      ctx.fill();
  
      // Maria (lunar plains) on dark side
      this.drawLunarFeatures(ctx, cx, cy, mr, false);
  
      // Clip to circle of moon
      ctx.beginPath();
      ctx.arc(cx, cy, mr, 0, Math.PI * 2);
      ctx.clip();
  
      // Illuminated hemisphere
      // The illuminated portion is bounded by:
      // 1. Semi-circle on the illuminated limb
      // 2. Semi-ellipse of the terminator with x-radius = mr * |2k - 1|
      if (k > 0.005) {
        ctx.beginPath();
        // Right limb is illuminated during Waxing, Left limb during Waning
        const semiMinor = mr * Math.abs(2 * k - 1);
        const isGibbous = k >= 0.5;
  
        if (isWaxing) {
          // Waxing: Right limb is always illuminated [ -PI/2 to PI/2 ]
          ctx.arc(cx, cy, mr, -Math.PI / 2, Math.PI / 2, false);
  
          if (isGibbous) {
            // Terminator bulges to the dark side (left, so x-radius points left)
            ctx.ellipse(cx, cy, semiMinor, mr, 0, Math.PI / 2, -Math.PI / 2, false);
          } else {
            // Crescent: Terminator curves into the illuminated side (right)
            ctx.ellipse(cx, cy, semiMinor, mr, 0, Math.PI / 2, -Math.PI / 2, true);
          }
        } else {
          // Waning: Left limb is illuminated [ PI/2 to 3*PI/2 ]
          ctx.arc(cx, cy, mr, Math.PI / 2, -Math.PI / 2, false);
  
          if (isGibbous) {
            // Terminator bulges right into dark side
            ctx.ellipse(cx, cy, semiMinor, mr, 0, -Math.PI / 2, Math.PI / 2, false);
          } else {
            // Crescent: Terminator curves left
            ctx.ellipse(cx, cy, semiMinor, mr, 0, -Math.PI / 2, Math.PI / 2, true);
          }
        }
  
        ctx.closePath();
  
        // 3D Illuminated Lunar Surface gradient
        const lightGrad = ctx.createRadialGradient(
          isWaxing ? cx + mr * 0.4 : cx - mr * 0.4,
          cy - mr * 0.2,
          mr * 0.05,
          cx,
          cy,
          mr * 1.1
        );
        lightGrad.addColorStop(0, '#ffffff');
        lightGrad.addColorStop(0.3, '#edf3fa');
        lightGrad.addColorStop(0.7, '#c2cedd');
        lightGrad.addColorStop(1, '#97a6bb');
  
        ctx.fillStyle = lightGrad;
        ctx.fill();
  
        // Draw lunar maria and crater texture on bright side
        this.drawLunarFeatures(ctx, cx, cy, mr, true);
      }
  
      ctx.restore();
  
      // Subtle 3D limb shadow ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, mr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();
      ctx.restore();
    }
  
    drawLunarFeatures(ctx, cx, cy, mr, isBrightSide) {
      ctx.save();
      // Simplified major lunar maria (Oceanus Procellarum, Mare Imbrium, Mare Serenitatis, Mare Tranquillitatis)
      const features = [
        { x: -0.3 * mr, y: -0.2 * mr, r: 0.26 * mr }, // Imbrium
        { x: -0.45 * mr, y: 0.1 * mr, r: 0.35 * mr }, // Procellarum
        { x: 0.15 * mr, y: -0.15 * mr, r: 0.2 * mr }, // Serenitatis
        { x: 0.25 * mr, y: 0.05 * mr, r: 0.22 * mr }, // Tranquillitatis
        { x: 0.35 * mr, y: 0.25 * mr, r: 0.16 * mr }, // Fecunditatis
        { x: -0.15 * mr, y: 0.35 * mr, r: 0.18 * mr }  // Nubium
      ];
  
      ctx.fillStyle = isBrightSide ? 'rgba(120, 135, 155, 0.22)' : 'rgba(10, 14, 22, 0.35)';
  
      for (const f of features) {
        ctx.beginPath();
        ctx.arc(cx + f.x, cy + f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  
    drawComplicationBezel(ctx, cx, cy, r, dpr) {
      const opt = this.options;
  
      // Outer gold border
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = opt.primaryGold;
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();
  
      // Inner platinum accent
      ctx.beginPath();
      ctx.arc(cx, cy, r - 3 * dpr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(216, 226, 236, 0.3)';
      ctx.lineWidth = 0.8 * dpr;
      ctx.stroke();
  
      // Synodic Month 29.5-day tick divisions around the rim
      for (let day = 0; day < 30; day++) {
        const angle = (day / 29.53) * Math.PI * 2 - Math.PI / 2;
        const isMajor = day % 5 === 0;
        const tickLen = (isMajor ? 4 : 2) * dpr;
  
        const x1 = cx + Math.cos(angle) * (r - 4 * dpr);
        const y1 = cy + Math.sin(angle) * (r - 4 * dpr);
        const x2 = cx + Math.cos(angle) * (r - 4 * dpr - tickLen);
        const y2 = cy + Math.sin(angle) * (r - 4 * dpr - tickLen);
  
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = isMajor ? opt.primaryGold : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = (isMajor ? 1 : 0.6) * dpr;
        ctx.stroke();
      }
    }
  
    updateTelemetry(comp) {
      if (!this.container) return;
  
      const fullDays = Math.floor(comp.daysToNextFullMoon);
      const fullHours = Math.round((comp.daysToNextFullMoon - fullDays) * 24);
  
      const newDays = Math.floor(comp.daysToNextNewMoon);
      const newHours = Math.round((comp.daysToNextNewMoon - newDays) * 24);
  
      this.container.innerHTML = `
        <div class="lunar-telemetry-header">
          <span class="lunar-phase-badge">${comp.phaseName.toUpperCase()}</span>
          <span class="lunar-orbit-dir">${comp.isWaxing ? '▲ WAXING' : '▼ WANING'}</span>
        </div>
        <div class="lunar-stat-grid">
          <div class="lunar-stat">
            <span class="stat-label">ILLUMINATION</span>
            <span class="stat-value gold-glow">${comp.illuminationPercent}%</span>
          </div>
          <div class="lunar-stat">
            <span class="stat-label">LUNAR AGE</span>
            <span class="stat-value">${comp.lunarAgeDays.toFixed(1)} <small>d</small></span>
          </div>
          <div class="lunar-stat">
            <span class="stat-label">NEXT FULL MOON</span>
            <span class="stat-value">${fullDays}d ${fullHours}h</span>
          </div>
          <div class="lunar-stat">
            <span class="stat-label">NEXT NEW MOON</span>
            <span class="stat-value">${newDays}d ${newHours}h</span>
          </div>
        </div>
      `;
    }
  }
  

  // ==========================================
  // Module: src/ui/telemetry-display.js
  // ==========================================
  /**
   * Meridian Chronometer — Celestial Telemetry Display
   * Displays high-precision solar telemetry: solar noon, golden hour,
   * civil/nautical/astronomical dawn & dusk, and interactive Equation of Time analemma.
   */
  
  
  
  class TelemetryDisplay {
    constructor(containerElement, analemmaCanvasElement) {
      this.container = containerElement;
      this.analemmaCanvas = analemmaCanvasElement;
      this.analemmaCtx = analemmaCanvasElement ? analemmaCanvasElement.getContext('2d') : null;
      this.analemmaData = this.precomputeYearlyAnalemma();
      this.lastRenderSec = -1;
      this.lastObserverName = '';
      this.width = 0;
      this.height = 0;
      this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      this.resize();
    }
  
    resize() {
      if (!this.analemmaCanvas) return;
      const rect = this.analemmaCanvas.getBoundingClientRect();
      this.width = rect.width || 280;
      this.height = rect.height || 180;
      this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      this.analemmaCanvas.width = Math.round(this.width * this.dpr);
      this.analemmaCanvas.height = Math.round(this.height * this.dpr);
    }
  
    /**
     * Precomputes the 365-day Equation of Time & Solar Declination analemma curve.
     */
    precomputeYearlyAnalemma() {
      const points = [];
      // Use year 2024 as reference cycle
      for (let day = 0; day < 365; day += 2) {
        const d = new Date(Date.UTC(2024, 0, 1 + day, 12, 0, 0));
        const { declinationDeg, equationOfTimeMinutes } = getSolarPosition(d);
        points.push({ day, declinationDeg, equationOfTimeMinutes });
      }
      return points;
    }
  
    formatTime(date) {
      if (!date) return '--:--:--';
      const h = String(date.getUTCHours()).padStart(2, '0');
      const m = String(date.getUTCMinutes()).padStart(2, '0');
      const s = String(date.getUTCSeconds()).padStart(2, '0');
      return `${h}:${m}:${s} <small>UTC</small>`;
    }
  
    formatEoT(minutes) {
      const sign = minutes >= 0 ? '+' : '−';
      const absMin = Math.abs(minutes);
      const m = Math.floor(absMin);
      const s = Math.round((absMin - m) * 60);
      return `${sign}${m}m ${String(s).padStart(2, '0')}s`;
    }
  
    render(date, observer) {
      const solarPos = getSolarPosition(date);
      const currentSec = Math.floor(date.getTime() / 500); // 2Hz DOM update
      const observerChanged = this.lastObserverName !== observer.name;
  
      if (this.container && (currentSec !== this.lastRenderSec || observerChanged)) {
        this.lastRenderSec = currentSec;
        this.lastObserverName = observer.name;
        const telemetry = getCelestialTelemetry(date, observer.lat, observer.lon);
        const eotFormatted = this.formatEoT(telemetry.equationOfTimeMinutes);
        const eotAheadBehind = telemetry.equationOfTimeMinutes >= 0 ? 'FAST (Sun ahead)' : 'SLOW (Sun behind)';
  
        this.container.innerHTML = `
          <div class="telemetry-panel-grid">
            <!-- Solar Noon Card -->
            <div class="telemetry-card">
              <div class="telemetry-card-title">
                <span class="icon">☀️</span> SOLAR MERIDIAN TRANSIT
              </div>
              <div class="telemetry-card-main">
                <span class="telemetry-highlight gold-glow">${this.formatTime(telemetry.solarNoonUTC)}</span>
              </div>
              <div class="telemetry-subdata">
                <div>Transit Altitude: <strong>${telemetry.solarElevationAtNoonDeg.toFixed(1)}°</strong></div>
                <div>Declination: <strong>${solarPos.declinationDeg >= 0 ? '+' : ''}${solarPos.declinationDeg.toFixed(2)}°</strong></div>
              </div>
            </div>
  
            <!-- Daylight & Solar Cycle -->
            <div class="telemetry-card">
              <div class="telemetry-card-title">
                <span class="icon">🌅</span> SOLAR CYCLE (HORIZON)
              </div>
              <div class="telemetry-row">
                <span class="field-label">Sunrise</span>
                <span class="field-value">${this.formatTime(telemetry.sunriseUTC)}</span>
              </div>
              <div class="telemetry-row">
                <span class="field-label">Sunset</span>
                <span class="field-value">${this.formatTime(telemetry.sunsetUTC)}</span>
              </div>
              <div class="telemetry-row">
                <span class="field-label">Day Length</span>
                <span class="field-value platinum-glow">${telemetry.dayLengthHours.toFixed(2)} hrs</span>
              </div>
            </div>
  
            <!-- Twilight Phases -->
            <div class="telemetry-card">
              <div class="telemetry-card-title">
                <span class="icon">🌌</span> TWILIGHT GRADIENTS
              </div>
              <div class="telemetry-twilight-grid">
                <div class="twilight-phase">
                  <span class="twilight-tag">CIVIL (0° to −6°)</span>
                  <span class="twilight-val">${this.formatTime(telemetry.civilDawnUTC)} / ${this.formatTime(telemetry.civilDuskUTC)}</span>
                </div>
                <div class="twilight-phase">
                  <span class="twilight-tag">NAUTICAL (−6° to −12°)</span>
                  <span class="twilight-val">${this.formatTime(telemetry.nauticalDawnUTC)} / ${this.formatTime(telemetry.nauticalDuskUTC)}</span>
                </div>
                <div class="twilight-phase">
                  <span class="twilight-tag">ASTRONOMICAL (−12° to −18°)</span>
                  <span class="twilight-val">${this.formatTime(telemetry.astronomicalDawnUTC)} / ${this.formatTime(telemetry.astronomicalDuskUTC)}</span>
                </div>
              </div>
            </div>
  
            <!-- Equation of Time -->
            <div class="telemetry-card eot-card">
              <div class="telemetry-card-title">
                <span class="icon">⏱️</span> EQUATION OF TIME (EoT)
              </div>
              <div class="eot-main-row">
                <span class="eot-value gold-glow">${eotFormatted}</span>
                <span class="eot-status">${eotAheadBehind}</span>
              </div>
              <div class="eot-explanation">
                Difference between True Apparent Sundial Time and Uniform Mean Clock Time.
              </div>
            </div>
          </div>
        `;
      }
  
      if (this.analemmaCtx && this.analemmaCanvas) {
        this.drawAnalemma(date, solarPos);
      }
    }
  
    /**
     * Draws the celestial figure-8 Analemma curve and plots current day beacon.
     */
    drawAnalemma(date, currentSolarPos) {
      const canvas = this.analemmaCanvas;
      const ctx = this.analemmaCtx;
      const w = canvas.width;
      const h = canvas.height;
      const dpr = this.dpr;
  
      ctx.save();
      ctx.clearRect(0, 0, w, h);
  
      // Coordinate mapping:
      // X: Equation of Time from -16 to +18 minutes
      // Y: Solar Declination from +26° to -26°
      const mapX = (eot) => ((eot - (-16)) / (18 - (-16))) * (w - 24 * dpr) + 12 * dpr;
      const mapY = (dec) => ((26 - dec) / 52) * (h - 24 * dpr) + 12 * dpr;
  
      // Zero axes
      const zeroX = mapX(0);
      const zeroY = mapY(0);
  
      ctx.strokeStyle = 'rgba(216, 226, 236, 0.12)';
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(zeroX, 0);
      ctx.lineTo(zeroX, h);
      ctx.moveTo(0, zeroY);
      ctx.lineTo(w, zeroY);
      ctx.stroke();
  
      // Axis labels
      ctx.fillStyle = 'rgba(216, 226, 236, 0.4)';
      ctx.font = `${Math.round(7 * dpr)}px "Space Mono", monospace`;
      ctx.fillText('EoT 0m', zeroX + 3 * dpr, 10 * dpr);
      ctx.fillText('Equator 0°', 4 * dpr, zeroY - 3 * dpr);
  
      // 365-day Analemma path
      ctx.beginPath();
      for (let i = 0; i < this.analemmaData.length; i++) {
        const pt = this.analemmaData[i];
        const x = mapX(pt.equationOfTimeMinutes);
        const y = mapY(pt.declinationDeg);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(200, 170, 110, 0.45)';
      ctx.lineWidth = 1.4 * dpr;
      ctx.stroke();
  
      // Current date beacon on the analemma
      const curX = mapX(currentSolarPos.equationOfTimeMinutes);
      const curY = mapY(currentSolarPos.declinationDeg);
  
      // Glowing halo
      const halo = ctx.createRadialGradient(curX, curY, 1 * dpr, curX, curY, 8 * dpr);
      halo.addColorStop(0, '#ffffff');
      halo.addColorStop(0.4, '#c8aa6e');
      halo.addColorStop(1, 'rgba(200, 170, 110, 0)');
  
      ctx.beginPath();
      ctx.arc(curX, curY, 8 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();
  
      ctx.beginPath();
      ctx.arc(curX, curY, 2.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
  
      ctx.restore();
    }
  }
  

  // ==========================================
  // Module: src/ui/time-scrubber.js
  // ==========================================
  /**
   * Meridian Chronometer — Interactive Time Scrubber
   * Observatory temporal control deck with 24-hour diurnal timeline scrubbing,
   * speed multiplier switches, bi-directional playback, and astronomical presets.
   */
  
  
  
  class TimeScrubber {
    constructor(containerElement, timeController) {
      this.container = containerElement;
      this.controller = timeController;
      this.isScrubbing = false;
  
      this.render();
      this.attachEventListeners();
  
      // Subscribe to time updates so UI stays synchronized
      this.controller.subscribe(() => {
        if (!this.isScrubbing) {
          this.updateUI();
        }
      });
    }
  
    render() {
      this.container.innerHTML = `
        <div class="scrubber-deck">
          <!-- Control Strip Top: Status, Epoch Jump, and Realtime Latch -->
          <div class="scrubber-top-strip">
            <div class="temporal-status-badge">
              <span class="status-pip ${this.controller.isRealtime ? 'pip-realtime' : 'pip-simulated'}"></span>
              <span class="status-label">${this.controller.isRealtime ? 'SYSTEM REALTIME UTC' : 'SIMULATION MODE'}</span>
              <span class="speed-readout">${this.controller.speedMultiplier}x ${this.controller.direction < 0 ? 'REV' : 'FWD'}</span>
            </div>
  
            <!-- Astronomical Preset Dropdown -->
            <div class="preset-selector-wrap">
              <label for="epochPreset">CELESTIAL EPOCH:</label>
              <select id="epochPreset" class="meridian-select">
                ${PRESET_EPOCHS.map((p, idx) => `
                  <option value="${p.iso || 'realtime'}" ${idx === 0 ? 'selected' : ''}>${p.label}</option>
                `).join('')}
              </select>
            </div>
  
            <!-- Date-Time Input -->
            <div class="direct-date-input-wrap">
              <input type="datetime-local" id="directDateTime" class="meridian-date-input" step="1" />
            </div>
  
            <!-- Realtime Sync Button -->
            <button id="btnSyncRealtime" class="meridian-btn btn-latch ${this.controller.isRealtime ? 'active' : ''}">
              <span class="latch-led"></span> SYNC REALTIME
            </button>
          </div>
  
          <!-- 24-Hour Diurnal Timeline Slider -->
          <div class="scrubber-timeline-container">
            <div class="timeline-labels-row">
              <span>00:00 <small>MIDNIGHT</small></span>
              <span>06:00 <small>DAWN</small></span>
              <span>12:00 <small>SOLAR NOON</small></span>
              <span>18:00 <small>DUSK</small></span>
              <span>24:00 <small>MIDNIGHT</small></span>
            </div>
            <div class="scrubber-slider-wrap">
              <input type="range" id="timelineSlider" class="meridian-slider" min="0" max="86400" value="0" step="1" aria-label="24-Hour Diurnal Timeline Slider" />
            </div>
          </div>
  
          <!-- Control Strip Bottom: Playback buttons & Multipliers -->
          <div class="scrubber-bottom-strip">
            <div class="playback-btn-group">
              <button id="btnStepBackDay" class="meridian-btn" title="Step Back 1 Day">−1d</button>
              <button id="btnStepBackHour" class="meridian-btn" title="Step Back 1 Hour">−1h</button>
              <button id="btnReverse" class="meridian-btn ${this.controller.direction === -1 ? 'active' : ''}" title="Reverse Direction">◀◀</button>
              <button id="btnPlayPause" class="meridian-btn btn-primary" title="Play / Pause (Space)">
                ${this.controller.isPlaying ? '❚❚ PAUSE' : '▶ PLAY'}
              </button>
              <button id="btnForward" class="meridian-btn ${this.controller.direction === 1 ? 'active' : ''}" title="Forward Direction">▶▶</button>
              <button id="btnStepFwdHour" class="meridian-btn" title="Step Forward 1 Hour">+1h</button>
              <button id="btnStepFwdDay" class="meridian-btn" title="Step Forward 1 Day">+1d</button>
            </div>
  
            <!-- Speed Multipliers -->
            <div class="speed-multiplier-group">
              <span class="multiplier-label">TEMPORAL RATE:</span>
              <button class="speed-btn ${this.controller.speedMultiplier === 1 ? 'active' : ''}" data-speed="1">1x</button>
              <button class="speed-btn ${this.controller.speedMultiplier === 60 ? 'active' : ''}" data-speed="60">60x <small>(1m/s)</small></button>
              <button class="speed-btn ${this.controller.speedMultiplier === 3600 ? 'active' : ''}" data-speed="3600">3,600x <small>(1h/s)</small></button>
              <button class="speed-btn ${this.controller.speedMultiplier === 86400 ? 'active' : ''}" data-speed="86400">86,400x <small>(1d/s)</small></button>
            </div>
          </div>
        </div>
      `;
    }
  
    attachEventListeners() {
      const c = this.container;
  
      // Realtime Sync
      const btnSync = c.querySelector('#btnSyncRealtime');
      btnSync.addEventListener('click', () => {
        this.controller.syncRealtime();
        this.updateUI();
      });
  
      // Preset selector
      const selectPreset = c.querySelector('#epochPreset');
      selectPreset.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'realtime') {
          this.controller.syncRealtime();
        } else {
          this.controller.setTime(new Date(val));
        }
        this.updateUI();
      });
  
      // Direct Date Input
      const dateInput = c.querySelector('#directDateTime');
      dateInput.addEventListener('change', (e) => {
        if (e.target.value) {
          this.controller.setTime(new Date(e.target.value));
          this.updateUI();
        }
      });
  
      // 24-Hour Timeline Slider (never snaps back!)
      const slider = c.querySelector('#timelineSlider');
  
      const startScrub = () => {
        this.isScrubbing = true;
      };
  
      const doScrub = (e) => {
        const secOfDay = Number(e.target.value);
        const cur = this.controller.getTime();
        const midnightUtc = Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate());
        this.controller.setTime(new Date(midnightUtc + secOfDay * 1000));
      };
  
      const endScrub = () => {
        this.isScrubbing = false;
        this.updateUI();
      };
  
      slider.addEventListener('pointerdown', startScrub);
      slider.addEventListener('mousedown', startScrub);
      slider.addEventListener('touchstart', startScrub, { passive: true });
  
      slider.addEventListener('input', doScrub);
  
      slider.addEventListener('pointerup', endScrub);
      slider.addEventListener('mouseup', endScrub);
      slider.addEventListener('touchend', endScrub);
      slider.addEventListener('change', endScrub);
  
      // Play / Pause
      const btnPlayPause = c.querySelector('#btnPlayPause');
      btnPlayPause.addEventListener('click', () => {
        this.controller.togglePlay();
        this.updateUI();
      });
  
      // Reverse / Forward
      const btnReverse = c.querySelector('#btnReverse');
      btnReverse.addEventListener('click', () => {
        this.controller.setDirection(-1);
        this.updateUI();
      });
  
      const btnForward = c.querySelector('#btnForward');
      btnForward.addEventListener('click', () => {
        this.controller.setDirection(1);
        this.updateUI();
      });
  
      // Step Buttons
      c.querySelector('#btnStepBackHour').addEventListener('click', () => {
        this.controller.step(-3600);
        this.updateUI();
      });
      c.querySelector('#btnStepFwdHour').addEventListener('click', () => {
        this.controller.step(3600);
        this.updateUI();
      });
      c.querySelector('#btnStepBackDay').addEventListener('click', () => {
        this.controller.step(-86400);
        this.updateUI();
      });
      c.querySelector('#btnStepFwdDay').addEventListener('click', () => {
        this.controller.step(86400);
        this.updateUI();
      });
  
      // Speed buttons
      const speedButtons = c.querySelectorAll('.speed-btn');
      speedButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const speed = Number(btn.getAttribute('data-speed'));
          this.controller.setSpeed(speed);
          this.updateUI();
        });
      });
  
      // Global spacebar listener for play/pause
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
          e.preventDefault();
          this.controller.togglePlay();
          this.updateUI();
        }
      });
    }
  
    updateUI() {
      const c = this.container;
      const isRt = this.controller.isRealtime;
      const isPlaying = this.controller.isPlaying;
  
      // Status pip
      const pip = c.querySelector('.status-pip');
      const label = c.querySelector('.status-label');
      const speedText = c.querySelector('.speed-readout');
  
      if (pip && label && speedText) {
        pip.className = `status-pip ${isRt ? 'pip-realtime' : 'pip-simulated'}`;
        label.textContent = isRt ? 'SYSTEM REALTIME UTC' : 'SIMULATION MODE';
        speedText.textContent = `${this.controller.speedMultiplier}x ${this.controller.direction < 0 ? 'REV' : 'FWD'}`;
      }
  
      // Latch button
      const btnSync = c.querySelector('#btnSyncRealtime');
      if (btnSync) {
        btnSync.className = `meridian-btn btn-latch ${isRt ? 'active' : ''}`;
      }
  
      // Play/Pause button
      const btnPlayPause = c.querySelector('#btnPlayPause');
      if (btnPlayPause) {
        btnPlayPause.innerHTML = isPlaying ? '❚❚ PAUSE' : '▶ PLAY';
      }
  
      // Direction buttons
      const btnRev = c.querySelector('#btnReverse');
      const btnFwd = c.querySelector('#btnForward');
      if (btnRev && btnFwd) {
        btnRev.classList.toggle('active', this.controller.direction === -1);
        btnFwd.classList.toggle('active', this.controller.direction === 1);
      }
  
      // Speed buttons
      const speedButtons = c.querySelectorAll('.speed-btn');
      speedButtons.forEach((b) => {
        const sp = Number(b.getAttribute('data-speed'));
        b.classList.toggle('active', this.controller.speedMultiplier === sp);
      });
  
      // Update datetime picker display value
      const dateInput = c.querySelector('#directDateTime');
      if (dateInput && !this.isScrubbing) {
        const d = this.controller.getTime();
        const pad = (n) => String(n).padStart(2, '0');
        const isoLocal = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
        dateInput.value = isoLocal;
      }
  
      // Update timeline slider value to reflect current seconds of day
      const slider = c.querySelector('#timelineSlider');
      if (slider && !this.isScrubbing) {
        const d = this.controller.getTime();
        const secOfDay = d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
        slider.value = secOfDay;
      }
    }
  }
  

  // ==========================================
  // Module: src/index.js
  // ==========================================
  /**
   * Meridian Chronometer — Master Application Entry
   * Orchestrates 60fps astronomical engine loop, high-precision chronometer dial,
   * world solar observatory, lunar complication, celestial telemetry, and time scrubber.
   */
  
  
  
  
  
  
  
  
  
  
  
  class MeridianObservatoryApp {
    constructor() {
      this.timeController = new TimeController();
      this.audioEscapement = new EscapementAudio();
      this.lastFrameTime = performance.now();
      this.lastTickSecond = -1;
  
      this.initDOM();
      this.initInstruments();
      this.initAudio();
      this.bindEvents();
      this.startLoop();
    }
  
    initDOM() {
      this.dialCanvas = document.getElementById('dialCanvas');
      this.mapCanvas = document.getElementById('mapCanvas');
      this.lunarCanvas = document.getElementById('lunarCanvas');
      this.analemmaCanvas = document.getElementById('analemmaCanvas');
  
      this.utcReadout = document.getElementById('utcReadout');
      this.solarReadout = document.getElementById('solarReadout');
      this.siderealReadout = document.getElementById('siderealReadout');
  
      this.telemetryContainer = document.getElementById('telemetryContainer');
      this.lunarTelemetryContainer = document.getElementById('lunarTelemetryContainer');
      this.scrubberContainer = document.getElementById('scrubberContainer');
      this.observatorySelect = document.getElementById('observatorySelect');
      this.audioToggleBtn = document.getElementById('audioToggleBtn');
  
      // Populate preset observatories in header dropdown
      if (this.observatorySelect) {
        this.observatorySelect.innerHTML = PRESET_OBSERVATORIES.map((obs) => `
          <option value="${obs.id}">${obs.name} (${obs.country})</option>
        `).join('');
      }
    }
  
    initInstruments() {
      this.chronometerDial = new ChronometerDial(this.dialCanvas);
      this.worldObservatory = new WorldObservatory(this.mapCanvas);
      this.lunarComplication = new LunarComplication(this.lunarCanvas, this.lunarTelemetryContainer);
      this.telemetryDisplay = new TelemetryDisplay(this.telemetryContainer, this.analemmaCanvas);
      this.timeScrubber = new TimeScrubber(this.scrubberContainer, this.timeController);
  
      // Sync observer change from map click to select dropdown
      this.worldObservatory.onObserverChange = (obs) => {
        this.updateObserverDisplay(obs);
      };
    }
  
    initAudio() {
      if (this.audioToggleBtn) {
        this.audioToggleBtn.addEventListener('click', () => {
          const active = this.audioEscapement.toggle();
          this.audioToggleBtn.classList.toggle('active', active);
          this.audioToggleBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
      }
    }
  
    bindEvents() {
      // Window resize observer for all canvas instruments
      window.addEventListener('resize', () => {
        this.chronometerDial.resize();
        this.worldObservatory.resize();
        this.lunarComplication.resize();
        this.renderFrame();
      });
  
      // Observer selection change
      if (this.observatorySelect) {
        this.observatorySelect.addEventListener('change', (e) => {
          const obs = PRESET_OBSERVATORIES.find((o) => o.id === e.target.value);
          if (obs) {
            this.worldObservatory.setObserver(obs.lat, obs.lon, obs.name);
          }
        });
      }
    }
  
    updateObserverDisplay(obs) {
      const coordEl = document.getElementById('activeObserverCoords');
      if (coordEl) {
        const latFmt = `${Math.abs(obs.lat).toFixed(2)}° ${obs.lat >= 0 ? 'N' : 'S'}`;
        const lonFmt = `${Math.abs(obs.lon).toFixed(2)}° ${obs.lon >= 0 ? 'E' : 'W'}`;
        coordEl.textContent = `${obs.name} [${latFmt}, ${lonFmt}]`;
      }
    }
  
    startLoop() {
      const loop = (currentTimestamp) => {
        const deltaMs = Math.min(100, currentTimestamp - this.lastFrameTime);
        this.lastFrameTime = currentTimestamp;
  
        // Advance chronometer simulation
        this.timeController.tick(deltaMs);
  
        // Render astronomical frame
        this.renderFrame();
  
        requestAnimationFrame(loop);
      };
  
      requestAnimationFrame(loop);
    }
  
    formatHMS(decimalHours, includeFraction = false) {
      const totalSec = decimalHours * 3600;
      const h = Math.floor(totalSec / 3600) % 24;
      const m = Math.floor((totalSec % 3600) / 60);
      const s = Math.floor(totalSec % 60);
      const pad = (n) => String(n).padStart(2, '0');
  
      if (includeFraction) {
        const frac = Math.floor((totalSec % 1) * 10);
        return `${pad(h)}:${pad(m)}:${pad(s)}.${frac}`;
      }
      return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }
  
    renderFrame() {
      const date = this.timeController.getTime();
      const observer = this.worldObservatory.observer;
  
      // Astronomical computations
      const solarTime = getLocalSolarTime(date, observer.lon);
      const siderealHours = getLMST(date, observer.lon);
  
      // 1. Render Main Chronometer Dial
      this.chronometerDial.render({
        utcDate: date,
        solarApparentHours: solarTime.apparentHours,
        siderealHours
      });
  
      // 2. Render World Solar Observatory
      this.worldObservatory.render(date);
  
      // 3. Render Lunar Complication
      this.lunarComplication.render(date);
  
      // 4. Render Celestial Telemetry & Analemma
      this.telemetryDisplay.render(date, observer);
  
      // 5. Update Digital Readouts
      const utcDecimalHours =
        date.getUTCHours() +
        date.getUTCMinutes() / 60.0 +
        date.getUTCSeconds() / 3600.0 +
        date.getUTCMilliseconds() / 3600000.0;
  
      if (this.utcReadout) {
        this.utcReadout.innerHTML = `${this.formatHMS(utcDecimalHours, true)} <small>UTC</small>`;
      }
      if (this.solarReadout) {
        this.solarReadout.innerHTML = `${this.formatHMS(solarTime.apparentHours, false)} <small>SOLAR</small>`;
      }
      if (this.siderealReadout) {
        this.siderealReadout.innerHTML = `${this.formatHMS(siderealHours, false)} <small>LMST</small>`;
      }
  
      // 6. Mechanical escapement audio pulse on second boundary
      const curSec = date.getUTCSeconds();
      if (curSec !== this.lastTickSecond) {
        this.lastTickSecond = curSec;
        this.audioEscapement.tick(curSec % 2 === 0);
      }
    }
  }
  
  // Auto-boot observatory on DOM ready
  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      window.__MERIDIAN_APP__ = new MeridianObservatoryApp();
    });
  }
  

})();
