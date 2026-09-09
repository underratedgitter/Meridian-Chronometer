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
export function normalizeDegrees(deg) {
  const b = deg % 360.0;
  return b < 0 ? b + 360.0 : b;
}

/**
 * Normalizes an angle in hours to [0, 24).
 */
export function normalizeHours(hours) {
  const b = hours % 24.0;
  return b < 0 ? b + 24.0 : b;
}

/**
 * Converts a JS Date (UTC) to Julian Date (JD).
 * J2000.0 epoch (2000-01-01 12:00:00 UTC) = 2451545.0
 * Unix epoch (1970-01-01 00:00:00 UTC) = 2440587.5
 */
export function getJulianDate(date) {
  const time = date instanceof Date ? date.getTime() : Number(date);
  return time / 86400000.0 + 2440587.5;
}

/**
 * Converts Julian Date to Julian Centuries elapsed since J2000.0 (T).
 */
export function getJulianCenturies(jd) {
  return (jd - 2451545.0) / 36525.0;
}

/**
 * Computes Greenwich Mean Sidereal Time (GMST) in decimal hours [0, 24).
 * Standard IAU 1982 / Jean Meeus formula.
 */
export function getGMST(date) {
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
export function getLMST(date, longitudeDeg) {
  const gmst = getGMST(date);
  const offsetHours = longitudeDeg / 15.0;
  return normalizeHours(gmst + offsetHours);
}

/**
 * Computes detailed Solar Position, Declination, Right Ascension,
 * Equation of Time, and Subsolar Point coordinates.
 */
export function getSolarPosition(date) {
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
export function getLocalSolarTime(date, longitudeDeg) {
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
export function getCelestialTelemetry(date, latitudeDeg, longitudeDeg) {
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
export function getLunarComplication(date) {
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
export function getTerminatorPoints(date, numPoints = 360, altitudeDeg = 0) {
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
export function getNightShadowPolygon(date, numSteps = 360) {
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
