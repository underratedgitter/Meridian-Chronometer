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
  const d = Number(deg);
  if (!Number.isFinite(d)) return 0.0;
  const b = d % 360.0;
  return b < 0 ? b + 360.0 : b;
}

/**
 * Normalizes an angle in hours to [0, 24).
 */
export function normalizeHours(hours) {
  const h = Number(hours);
  if (!Number.isFinite(h)) return 0.0;
  const b = h % 24.0;
  return b < 0 ? b + 24.0 : b;
}

/**
 * Converts a JS Date (UTC) to Julian Date (JD).
 * J2000.0 epoch (2000-01-01 12:00:00 UTC) = 2451545.0
 * Unix epoch (1970-01-01 00:00:00 UTC) = 2440587.5
 */
export function getJulianDate(date) {
  let time;
  if (date instanceof Date) {
    time = date.getTime();
  } else if (typeof date === 'number') {
    time = date;
  } else if (date !== null && date !== undefined) {
    time = new Date(date).getTime();
  }
  if (!Number.isFinite(time)) {
    return 2451545.0; // J2000.0 epoch fallback
  }
  return time / 86400000.0 + 2440587.5;
}

/**
 * Converts Julian Date to Julian Centuries elapsed since J2000.0 (T).
 */
export function getJulianCenturies(jd) {
  const j = Number(jd);
  if (!Number.isFinite(j)) return 0.0;
  return (j - 2451545.0) / 36525.0;
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
  const d = (date instanceof Date && Number.isFinite(date.getTime()))
    ? date
    : (typeof date === 'number' && Number.isFinite(date) ? new Date(date) : new Date(Date.UTC(2000, 0, 1, 12, 0, 0)));
  const utcHours =
    d.getUTCHours() +
    d.getUTCMinutes() / 60.0 +
    d.getUTCSeconds() / 3600.0 +
    d.getUTCMilliseconds() / 3600000.0;

  // Longitude where apparent solar time is 12:00:
  // Apparent solar time at Greenwich = utcHours + equationOfTimeMinutes / 60
  // Solar noon at Greenwich occurs when utcHours = 12 - equationOfTimeMinutes / 60
  // Lon = -(utcHours - 12 + EoT/60) * 15
  let subsolarLon = (-(utcHours - 12.0 + equationOfTimeMinutes / 60.0) * 15.0) % 360.0;
  if (subsolarLon > 180.0) subsolarLon -= 360.0;
  if (subsolarLon < -180.0) subsolarLon += 360.0;

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
  const d = (date instanceof Date && Number.isFinite(date.getTime()))
    ? date
    : (typeof date === 'number' && Number.isFinite(date) ? new Date(date) : new Date());
  const latDeg = Math.max(-90.0, Math.min(90.0, Number.isFinite(Number(latitudeDeg)) ? Number(latitudeDeg) : 0));
  const lonDeg = Number.isFinite(Number(longitudeDeg)) ? Number(longitudeDeg) : 0;

  // Reference date at UTC midnight of the target day
  const midnightUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

  // Solar position near midday
  const middayDate = new Date(midnightUtc + 12 * 3600 * 1000);
  const { declinationDeg, equationOfTimeMinutes } = getSolarPosition(middayDate);

  // Solar noon in UTC hours
  const solarNoonHours = 12.0 - lonDeg / 15.0 - equationOfTimeMinutes / 60.0;
  const solarNoonTimeMs = midnightUtc + solarNoonHours * 3600 * 1000;
  const solarNoonUTC = new Date(solarNoonTimeMs);

  const phiRad = latDeg * DEG2RAD;
  const deltaRad = declinationDeg * DEG2RAD;

  /**
   * Computes event times for a given solar altitude h0 in degrees.
   * Returns { rise: Date | null, set: Date | null, status: 'normal'|'polar_day'|'polar_night' }
   */
  function calcTimesForAltitude(h0Deg) {
    const h0Rad = h0Deg * DEG2RAD;
    const denom = Math.cos(phiRad) * Math.cos(deltaRad);

    if (Math.abs(denom) < 1e-12) {
      const sinDiff = Math.sin(phiRad) * Math.sin(deltaRad) - Math.sin(h0Rad);
      if (sinDiff >= 0) {
        return { rise: null, set: null, status: 'polar_day' };
      } else {
        return { rise: null, set: null, status: 'polar_night' };
      }
    }

    let cosH = (Math.sin(h0Rad) - Math.sin(phiRad) * Math.sin(deltaRad)) / denom;

    if (Number.isNaN(cosH) || cosH > 1.0) {
      return { rise: null, set: null, status: 'polar_night' };
    }
    if (cosH < -1.0) {
      return { rise: null, set: null, status: 'polar_day' };
    }

    const hRad = Math.acos(Math.max(-1.0, Math.min(1.0, cosH)));
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

    let lonDeg = (lambdaSDeg + dLamDeg) % 360.0;
    if (lonDeg > 180.0) lonDeg -= 360.0;
    if (lonDeg < -180.0) lonDeg += 360.0;

    points.push({
      latitudeDeg: Number.isFinite(latDeg) ? latDeg : 0,
      longitudeDeg: Number.isFinite(lonDeg) ? lonDeg : 0
    });
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

/**
 * Converts Equatorial Coordinates (RA in hours, Dec in degrees) to
 * Horizontal Coordinates (Altitude and Azimuth in degrees).
 * Azimuth convention: 0° North, 90° East, 180° South, 270° West.
 */
export function raDecToAltAz(raHours, decDeg, lmstHours, latDeg) {
  const ra = Number.isFinite(Number(raHours)) ? Number(raHours) : 0;
  const dec = Math.max(-90.0, Math.min(90.0, Number.isFinite(Number(decDeg)) ? Number(decDeg) : 0));
  const lmst = Number.isFinite(Number(lmstHours)) ? Number(lmstHours) : 0;
  const lat = Math.max(-90.0, Math.min(90.0, Number.isFinite(Number(latDeg)) ? Number(latDeg) : 0));

  // Hour Angle in radians [-PI, PI]
  let hDeg = ((lmst - ra) * 15.0) % 360.0;
  if (hDeg > 180.0) hDeg -= 360.0;
  if (hDeg < -180.0) hDeg += 360.0;
  const hRad = hDeg * DEG2RAD;

  const phiRad = lat * DEG2RAD;
  const deltaRad = dec * DEG2RAD;

  // Altitude
  const sinAlt =
    Math.sin(phiRad) * Math.sin(deltaRad) +
    Math.cos(phiRad) * Math.cos(deltaRad) * Math.cos(hRad);
  const clampedSinAlt = Math.max(-1.0, Math.min(1.0, sinAlt));
  const altRad = Math.asin(clampedSinAlt);
  const altDeg = altRad * RAD2DEG;
  const cosAlt = Math.cos(altRad);

  // Azimuth
  let azDeg = 0;
  if (cosAlt > 1e-6) {
    const cosPhi = Math.cos(phiRad);
    if (Math.abs(cosPhi) < 1e-6) {
      // Singularity at North Pole (+90) or South Pole (-90)
      azDeg = lat > 0 ? normalizeDegrees(180.0 - hDeg) : normalizeDegrees(hDeg);
    } else {
      const sinAz = (-Math.cos(deltaRad) * Math.sin(hRad)) / cosAlt;
      const cosAz =
        (Math.sin(deltaRad) - Math.sin(phiRad) * clampedSinAlt) /
        (cosPhi * cosAlt);
      azDeg = Math.atan2(sinAz, cosAz) * RAD2DEG;
      azDeg = normalizeDegrees(azDeg);
    }
  }

  if (!Number.isFinite(azDeg)) azDeg = 0;
  const finalAlt = Number.isFinite(altDeg) ? altDeg : 0;

  return {
    altitudeDeg: finalAlt,
    azimuthDeg: azDeg,
    isVisible: finalAlt > 0
  };
}

/**
 * Projects a 3D spherical coordinate (lonDeg, latDeg) onto a 2D Orthographic Globe.
 * Returns { x, y, visible, cosC }.
 * x is right (+), y is down (+) to match canvas space.
 */
export function projectOrthographic(lonDeg, latDeg, centerLonDeg, centerLatDeg, radius) {
  const lon = Number.isFinite(Number(lonDeg)) ? Number(lonDeg) : 0;
  const lat = Math.max(-90, Math.min(90, Number.isFinite(Number(latDeg)) ? Number(latDeg) : 0));
  const cLon = Number.isFinite(Number(centerLonDeg)) ? Number(centerLonDeg) : 0;
  const cLat = Math.max(-90, Math.min(90, Number.isFinite(Number(centerLatDeg)) ? Number(centerLatDeg) : 0));
  const r = Number.isFinite(Number(radius)) && Number(radius) > 0 ? Number(radius) : 1;

  let dLonDeg = (lon - cLon) % 360.0;
  if (dLonDeg > 180.0) dLonDeg -= 360.0;
  if (dLonDeg < -180.0) dLonDeg += 360.0;

  const dLam = dLonDeg * DEG2RAD;
  const phi = lat * DEG2RAD;
  const phi0 = cLat * DEG2RAD;

  const cosC = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(dLam);
  const visible = cosC >= 0;

  // Screen coordinates relative to globe center:
  const x = r * Math.cos(phi) * Math.sin(dLam);
  const y = -r * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(dLam));

  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    visible: Boolean(visible),
    cosC: Number.isFinite(cosC) ? cosC : 0
  };
}

/**
 * Inverse raycasting: maps a 2D screen coordinate (x, y) relative to globe center
 * back to 3D geographic coordinates (lon, lat).
 * Returns { hit: boolean, lon: number, lat: number }.
 */
export function unprojectOrthographic(x, y, centerLonDeg, centerLatDeg, radius) {
  if (!radius || radius <= 0 || !Number.isFinite(radius) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return { hit: false, lon: 0, lat: 0 };
  }
  const rho = Math.sqrt(x * x + y * y);
  if (rho > radius) {
    return { hit: false, lon: 0, lat: 0 };
  }
  if (rho < 1e-6) {
    const safeCLon = Number.isFinite(Number(centerLonDeg)) ? Number(centerLonDeg) : 0;
    const safeCLat = Math.max(-90, Math.min(90, Number.isFinite(Number(centerLatDeg)) ? Number(centerLatDeg) : 0));
    return { hit: true, lon: safeCLon, lat: safeCLat };
  }

  const clampedRatio = Math.max(0.0, Math.min(1.0, rho / radius));
  const c = Math.asin(clampedRatio);
  const sinC = Math.sin(c);
  const cosC = Math.cos(c);
  const cLat = Math.max(-90, Math.min(90, Number.isFinite(Number(centerLatDeg)) ? Number(centerLatDeg) : 0));
  const phi0 = cLat * DEG2RAD;
  const sinPhi0 = Math.sin(phi0);
  const cosPhi0 = Math.cos(phi0);

  // In screen space y is down (+), so Cartesian Y on sphere is -y
  const py = -y;

  const sinPhi = cosC * sinPhi0 + (py * sinC * cosPhi0) / rho;
  const clampedSinPhi = Math.max(-1.0, Math.min(1.0, sinPhi));
  const lat = Math.asin(clampedSinPhi) * RAD2DEG;

  const numArcY = x * sinC;
  const denArcX = rho * cosPhi0 * cosC - py * sinPhi0 * sinC;
  const dLam = Math.atan2(numArcY, denArcX) * RAD2DEG;

  const cLon = Number.isFinite(Number(centerLonDeg)) ? Number(centerLonDeg) : 0;
  let lon = (cLon + dLam) % 360.0;
  if (lon > 180.0) lon -= 360.0;
  if (lon < -180.0) lon += 360.0;

  return {
    hit: true,
    lon: Number.isFinite(lon) ? lon : 0,
    lat: Number.isFinite(lat) ? lat : 0
  };
}

/**
 * Keplerian planetary ephemeris (Venus, Mars, Jupiter).
 * Computes instantaneous geocentric Right Ascension and Declination.
 */
export function getPlanetaryPositions(date) {
  const jd = getJulianDate(date);
  const T = getJulianCenturies(jd);

  // Mean obliquity of ecliptic
  const eps = (23.439291 - 0.0130042 * T) * DEG2RAD;

  // Heliocentric coordinates helper
  function getHeliocentric(a, e0, edot, I0, Idot, L0, Ldot, varpi0, varpidot, Omega0, Omegadot) {
    const e = e0 + edot * T;
    const I = (I0 + Idot * T) * DEG2RAD;
    const L = normalizeDegrees(L0 + Ldot * T);
    const varpi = normalizeDegrees(varpi0 + varpidot * T);
    const Omega = normalizeDegrees(Omega0 + Omegadot * T) * DEG2RAD;

    // Mean anomaly
    const M = normalizeDegrees(L - varpi) * DEG2RAD;

    // Equation of center (2-term approximation)
    const nu = M + (2 * e - 0.25 * e ** 3) * Math.sin(M) + 1.25 * e ** 2 * Math.sin(2 * M);
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));

    const u = nu + (varpi * DEG2RAD - Omega);
    const xNode = r * Math.cos(u);
    const yNode = r * Math.sin(u);

    // Heliocentric coordinates
    const X = xNode * Math.cos(Omega) - yNode * Math.sin(Omega) * Math.cos(I);
    const Y = xNode * Math.sin(Omega) + yNode * Math.cos(Omega) * Math.cos(I);
    const Z = yNode * Math.sin(I);

    return { X, Y, Z };
  }

  // Earth
  const earth = getHeliocentric(
    1.00000261, 0.01671123, -0.00004392,
    0.00005, -0.013, 100.464571, 36000.769828,
    102.937681, 0.317952, 0.0, 0.0
  );

  // Venus
  const venus = getHeliocentric(
    0.72333566, 0.00677672, -0.00004107,
    3.394676, -0.000789, 181.979099, 58517.815387,
    131.602467, 0.002683, 76.679843, -0.277694
  );

  // Mars
  const mars = getHeliocentric(
    1.52371034, 0.09339410, 0.00007882,
    1.849691, -0.008131, -4.553432, 19140.302685,
    -23.943629, 0.444411, 49.559538, -0.292573
  );

  // Jupiter
  const jupiter = getHeliocentric(
    5.202887, 0.04838624, -0.00013253,
    1.304396, -0.001837, 34.396441, 3034.746128,
    14.728479, 0.212527, 100.473909, 0.204691
  );

  function toEquatorial(planet, name, color, symbol, mag) {
    // Geocentric coordinates
    const Xg = planet.X - earth.X;
    const Yg = planet.Y - earth.Y;
    const Zg = planet.Z - earth.Z;

    // Rotate by ecliptic obliquity to equatorial coordinates
    const Xeq = Xg;
    const Yeq = Yg * Math.cos(eps) - Zg * Math.sin(eps);
    const Zeq = Yg * Math.sin(eps) + Zg * Math.cos(eps);

    let raDeg = Math.atan2(Yeq, Xeq) * RAD2DEG;
    raDeg = normalizeDegrees(raDeg);
    const dist = Math.sqrt(Xeq * Xeq + Yeq * Yeq + Zeq * Zeq);
    const decDeg = Math.asin(Math.max(-1, Math.min(1, Zeq / dist))) * RAD2DEG;

    return {
      name,
      symbol,
      color,
      magnitude: mag,
      raHours: raDeg / 15.0,
      decDeg,
      distAU: dist
    };
  }

  return {
    venus: toEquatorial(venus, 'Venus', '#ffd480', '♀', -4.2),
    mars: toEquatorial(mars, 'Mars', '#ff6b4a', '♂', -1.5),
    jupiter: toEquatorial(jupiter, 'Jupiter', '#e0cda9', '♃', -2.4)
  };
}

/**
 * Standard Catalog of Bright Primary Navigation & Alignment Stars (J2000.0)
 */
export const BRIGHT_STARS = [
  { name: 'Polaris', bayer: 'α UMi', const: 'Ursa Minor', raHours: 2.530, decDeg: 89.264, mag: 1.98, color: '#fbfcfd' },
  { name: 'Sirius', bayer: 'α CMa', const: 'Canis Major', raHours: 6.752, decDeg: -16.716, mag: -1.46, color: '#a6c8ff' },
  { name: 'Vega', bayer: 'α Lyr', const: 'Lyra', raHours: 18.616, decDeg: 38.784, mag: 0.03, color: '#cadcff' },
  { name: 'Betelgeuse', bayer: 'α Ori', const: 'Orion', raHours: 5.919, decDeg: 7.407, mag: 0.50, color: '#ff9468' },
  { name: 'Rigel', bayer: 'β Ori', const: 'Orion', raHours: 5.242, decDeg: -8.201, mag: 0.18, color: '#bad2ff' },
  { name: 'Arcturus', bayer: 'α Boo', const: 'Boötes', raHours: 14.261, decDeg: 19.182, mag: -0.05, color: '#ffcd85' },
  { name: 'Capella', bayer: 'α Aur', const: 'Auriga', raHours: 5.278, decDeg: 45.998, mag: 0.08, color: '#fff29e' },
  { name: 'Aldebaran', bayer: 'α Tau', const: 'Taurus', raHours: 4.599, decDeg: 16.509, mag: 0.85, color: '#ffaa66' },
  { name: 'Antares', bayer: 'α Sco', const: 'Scorpius', raHours: 16.490, decDeg: -26.432, mag: 1.06, color: '#ff7755' },
  { name: 'Spica', bayer: 'α Vir', const: 'Virgo', raHours: 13.420, decDeg: -11.161, mag: 0.98, color: '#b5d0ff' }
];
