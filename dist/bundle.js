/**
 * Meridian Chronometer — Standalone Production Bundle
 * Zero external dependencies. Works on both http:// and file:// protocols.
 */
(() => {
  "use strict";

  // ==========================================
  // Module: src/engine/sanitizer.js
  // ==========================================
  /**
   * Meridian Chronometer — Security Sanitization & Safe Object Utilities
   * Provides XSS prevention and prototype pollution immunity.
   * Zero external dependencies.
   */
  
  /**
   * Escapes HTML characters in a string or value to prevent Cross-Site Scripting (XSS).
   * Handles null, undefined, numbers, and strings safely.
   * @param {unknown} val
   * @returns {string}
   */
  function escapeHTML(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  
  /**
   * Safely merges user options into default options, protecting against prototype pollution.
   * Creates an object with a clean fallback, explicitly rejecting __proto__, constructor,
   * and prototype properties.
   * @param {Record<string, any>} defaults
   * @param {Record<string, any>} options
   * @returns {Record<string, any>}
   */
  function safeMerge(defaults = {}, options = {}) {
    const clean = Object.create(null);
    if (defaults && typeof defaults === 'object') {
      Object.assign(clean, defaults);
    }
    if (options && typeof options === 'object') {
      for (const key of Object.keys(options)) {
        if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
          clean[key] = options[key];
        }
      }
    }
    return { ...clean };
  }
  

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
    const d = Number(deg);
    if (!Number.isFinite(d)) return 0.0;
    const b = d % 360.0;
    return b < 0 ? b + 360.0 : b;
  }
  
  /**
   * Normalizes an angle in hours to [0, 24).
   */
  function normalizeHours(hours) {
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
  function getJulianDate(date) {
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
  function getJulianCenturies(jd) {
    const j = Number(jd);
    if (!Number.isFinite(j)) return 0.0;
    return (j - 2451545.0) / 36525.0;
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
  
  /**
   * Converts Equatorial Coordinates (RA in hours, Dec in degrees) to
   * Horizontal Coordinates (Altitude and Azimuth in degrees).
   * Azimuth convention: 0° North, 90° East, 180° South, 270° West.
   */
  function raDecToAltAz(raHours, decDeg, lmstHours, latDeg) {
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
  function projectOrthographic(lonDeg, latDeg, centerLonDeg, centerLatDeg, radius) {
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
  function unprojectOrthographic(x, y, centerLonDeg, centerLatDeg, radius) {
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
  function getPlanetaryPositions(date) {
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
  const BRIGHT_STARS = [
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
  
  const MAJOR_CITIES = [
    { name: 'Tokyo', lat: 35.68, lon: 139.76, weight: 1.0 },
    { name: 'Seoul', lat: 37.56, lon: 126.97, weight: 0.9 },
    { name: 'Shanghai', lat: 31.23, lon: 121.47, weight: 1.0 },
    { name: 'Beijing', lat: 39.90, lon: 116.40, weight: 0.9 },
    { name: 'Guangzhou', lat: 23.13, lon: 113.26, weight: 0.8 },
    { name: 'Hong Kong', lat: 22.31, lon: 114.16, weight: 0.8 },
    { name: 'Singapore', lat: 1.35, lon: 103.82, weight: 0.7 },
    { name: 'Bangkok', lat: 13.75, lon: 100.50, weight: 0.7 },
    { name: 'Jakarta', lat: -6.20, lon: 106.84, weight: 0.7 },
    { name: 'Delhi', lat: 28.61, lon: 77.20, weight: 0.9 },
    { name: 'Mumbai', lat: 19.07, lon: 72.87, weight: 0.9 },
    { name: 'Bangalore', lat: 12.97, lon: 77.59, weight: 0.7 },
    { name: 'Dubai', lat: 25.20, lon: 55.27, weight: 0.8 },
    { name: 'Cairo', lat: 30.04, lon: 31.23, weight: 0.8 },
    { name: 'Johannesburg', lat: -26.20, lon: 28.04, weight: 0.7 },
    { name: 'London', lat: 51.50, lon: -0.12, weight: 1.0 },
    { name: 'Paris', lat: 48.85, lon: 2.35, weight: 0.9 },
    { name: 'Berlin', lat: 52.52, lon: 13.40, weight: 0.8 },
    { name: 'Madrid', lat: 40.41, lon: -3.70, weight: 0.8 },
    { name: 'Rome', lat: 41.90, lon: 12.49, weight: 0.7 },
    { name: 'Moscow', lat: 55.75, lon: 37.61, weight: 0.8 },
    { name: 'Istanbul', lat: 41.00, lon: 28.97, weight: 0.8 },
    { name: 'New York', lat: 40.71, lon: -74.00, weight: 1.0 },
    { name: 'Chicago', lat: 41.88, lon: -87.63, weight: 0.8 },
    { name: 'Los Angeles', lat: 34.05, lon: -118.24, weight: 0.9 },
    { name: 'San Francisco', lat: 37.77, lon: -122.42, weight: 0.8 },
    { name: 'Toronto', lat: 43.65, lon: -79.38, weight: 0.7 },
    { name: 'Mexico City', lat: 19.43, lon: -99.13, weight: 0.8 },
    { name: 'São Paulo', lat: -23.55, lon: -46.63, weight: 0.9 },
    { name: 'Buenos Aires', lat: -34.60, lon: -58.38, weight: 0.8 },
    { name: 'Sydney', lat: -33.86, lon: 151.20, weight: 0.8 },
    { name: 'Melbourne', lat: -37.81, lon: 144.96, weight: 0.7 }
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
      let initialMs = Date.now();
      if (initialDate) {
        const parsed = initialDate instanceof Date ? initialDate.getTime() : new Date(initialDate).getTime();
        if (Number.isFinite(parsed)) initialMs = parsed;
      }
      this.simulatedTimeMs = initialMs;
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
      const ms = dateOrMs instanceof Date ? dateOrMs.getTime() : Number(dateOrMs);
      if (!Number.isFinite(ms)) {
        return;
      }
      this.isRealtime = false;
      this.simulatedTimeMs = Math.max(-8.64e15, Math.min(8.64e15, ms));
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
      let speed = Number(multiplier);
      if (!Number.isFinite(speed) || speed < 0.1) {
        speed = 1;
      }
      this.speedMultiplier = Math.max(0.1, speed);
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
      const d = Number(direction);
      this.direction = Number.isFinite(d) && d < 0 ? -1 : 1;
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
      const delta = Number(deltaSeconds);
      if (Number.isFinite(delta)) {
        this.simulatedTimeMs = Math.max(-8.64e15, Math.min(8.64e15, this.simulatedTimeMs + delta * 1000));
      }
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
        const elapsed = Number(realElapsedMs);
        if (Number.isFinite(elapsed)) {
          const deltaSimMs = elapsed * this.speedMultiplier * this.direction;
          if (Number.isFinite(deltaSimMs)) {
            this.simulatedTimeMs = Math.max(-8.64e15, Math.min(8.64e15, this.simulatedTimeMs + deltaSimMs));
          }
        }
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
      this.activeNodes = new Set();
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
      if (!this.isEnabled) {
        this.stop();
      }
      return this.isEnabled;
    }
  
    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
    }
  
    /**
     * Immediately stops, disconnects, and clears all currently playing or scheduled audio nodes.
     * Prevents dangling node accumulation in Web Audio graph memory.
     */
    stop() {
      for (const item of this.activeNodes) {
        try {
          if (item.osc) {
            item.osc.onended = null;
            try { item.osc.stop(); } catch {}
            item.osc.disconnect();
          }
          if (item.gain) {
            item.gain.disconnect();
          }
        } catch {
          // Node already stopped or disconnected
        }
      }
      this.activeNodes.clear();
    }
  
    /**
     * Cleans up all resources and terminates AudioContext if active.
     */
    destroy() {
      this.stop();
      this.isEnabled = false;
      if (this.ctx) {
        try {
          if (this.ctx.state !== 'closed' && typeof this.ctx.close === 'function') {
            this.ctx.close();
          }
        } catch {}
        this.ctx = null;
      }
    }
  
    /**
     * Triggers a subtle mechanical tick-tock impulse.
     * alternates pitch slightly for realistic anchor pallet jewel striking escape wheel tooth.
     */
    tick(isTock = false) {
      if (!this.isEnabled || !this.ctx || this.volume <= 0) return;
      if (this.ctx.state === 'closed') return;
  
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const nodeItem = { osc, gain };
  
        this.activeNodes.add(nodeItem);
  
        // Clean disconnection once impulse completes
        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {}
          this.activeNodes.delete(nodeItem);
        };
  
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
      this.options = safeMerge({
        primaryGold: '#c8aa6e',
        goldLight: '#e8ca8e',
        goldDark: '#8f7645',
        platinum: '#d8e2ec',
        platinumMuted: 'rgba(216, 226, 236, 0.35)',
        siderealBlue: '#4fa4e8',
        obsidian: '#090a0f',
        dialPlate: '#0e1118'
      }, options);
  
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
   * Multi-projection Earth observatory supporting both:
   * 1. 2D Equirectangular Projection
   * 2. 3D Orthographic Spherical Globe with atmospheric limb glow,
   *    interactive 3D rotation, and nighttime city lights.
   */
  
  
  
  
  
  
  class WorldObservatory {
    constructor(canvasElement, options = {}) {
      this.canvas = canvasElement;
      this.ctx = canvasElement.getContext('2d');
      this.options = safeMerge({
        primaryGold: '#c8aa6e',
        goldLight: '#e8ca8e',
        platinum: '#d8e2ec',
        obsidianDark: '#080a0f',
        landFill: '#171c26',
        landBorder: 'rgba(216, 226, 236, 0.22)',
        oceanFill: '#0b0e14',
        gridColor: 'rgba(216, 226, 236, 0.08)',
        equatorColor: 'rgba(200, 170, 110, 0.25)',
        tropicColor: 'rgba(200, 170, 110, 0.15)'
      }, options);
  
      this.observer = {
        lat: 51.4769,
        lon: 0.0005,
        name: 'Royal Observatory Greenwich'
      };
  
      // Projection Mode: 'equirectangular' or 'orthographic'
      this.projectionMode = 'equirectangular';
  
      // 3D Globe camera orientation (center lon/lat)
      this.globeCenter = { lon: 0.0, lat: 20.0 };
  
      this.hoverCoord = null;
      this.onObserverChange = null;
      this.onOpenSkyDome = null;
      this.isDragging = false;
      this.dragStartPos = null;
      this.dragStartGlobe = null;
      this.totalDragDist = 0;
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
  
      // Invalidate cached shadow map so it recreates if needed
      this.shadowCanvas = null;
      this.shadowImageData = null;
    }
  
    setProjectionMode(mode) {
      this.projectionMode = mode === 'orthographic' ? 'orthographic' : 'equirectangular';
      if (this.projectionMode === 'orthographic') {
        // Center globe on current observer initially
        this.globeCenter.lon = this.observer.lon;
        this.globeCenter.lat = Math.max(-60, Math.min(60, this.observer.lat));
      }
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
      const getCanvasPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        return {
          clientX: e.clientX - rect.left,
          clientY: e.clientY - rect.top,
          rectW: rect.width,
          rectH: rect.height
        };
      };
  
      this.canvas.addEventListener('mousedown', (e) => {
        const p = getCanvasPos(e);
        this.isDragging = true;
        this.dragStartPos = { x: p.clientX, y: p.clientY };
        this.dragStartGlobe = { lon: this.globeCenter.lon, lat: this.globeCenter.lat };
        this.totalDragDist = 0;
      });
  
      this.canvas.addEventListener('mousemove', (e) => {
        const p = getCanvasPos(e);
  
        if (this.projectionMode === 'orthographic') {
          const cx = p.rectW / 2;
          const cy = p.rectH / 2;
          const radius = Math.min(p.rectW, p.rectH) * 0.42;
          const relX = p.clientX - cx;
          const relY = p.clientY - cy;
  
          if (this.isDragging && this.dragStartPos) {
            const dx = p.clientX - this.dragStartPos.x;
            const dy = p.clientY - this.dragStartPos.y;
            this.totalDragDist += Math.abs(dx) + Math.abs(dy);
  
            // Rotate 3D globe smoothly with drag
            const sens = 0.5;
            let newLon = this.dragStartGlobe.lon - dx * sens;
            let newLat = this.dragStartGlobe.lat + dy * sens;
  
            while (newLon > 180) newLon -= 360;
            while (newLon < -180) newLon += 360;
            newLat = Math.max(-85, Math.min(85, newLat));
  
            this.globeCenter.lon = newLon;
            this.globeCenter.lat = newLat;
          } else {
            // Hover raycasting
            const hit = unprojectOrthographic(relX, relY, this.globeCenter.lon, this.globeCenter.lat, radius);
            this.hoverCoord = hit.hit ? { lat: hit.lat, lon: hit.lon } : null;
          }
        } else {
          // 2D Equirectangular
          const lon = (p.clientX / p.rectW) * 360 - 180;
          const lat = 90 - (p.clientY / p.rectH) * 180;
          this.hoverCoord = {
            lat: Math.max(-90, Math.min(90, lat)),
            lon: Math.max(-180, Math.min(180, lon))
          };
  
          if (this.isDragging) {
            if (this.dragStartPos) {
              const dx = p.clientX - this.dragStartPos.x;
              const dy = p.clientY - this.dragStartPos.y;
              this.totalDragDist += Math.abs(dx) + Math.abs(dy);
            }
            this.setObserver(this.hoverCoord.lat, this.hoverCoord.lon, 'Selected Position');
          }
        }
      });
  
      window.addEventListener('mouseup', (e) => {
        if (!this.isDragging) return;
        const p = getCanvasPos(e);
        const isClick = this.totalDragDist < 6;
  
        if (this.projectionMode === 'orthographic') {
          if (isClick) {
            const cx = p.rectW / 2;
            const cy = p.rectH / 2;
            const radius = Math.min(p.rectW, p.rectH) * 0.41;
            const relX = p.clientX - cx;
            const relY = p.clientY - cy;
  
            const hit = unprojectOrthographic(relX, relY, this.globeCenter.lon, this.globeCenter.lat, radius);
            if (hit.hit) {
              // Check if clicking close to any preset observatory
              let targetObs = null;
              let minDist = 16;
              for (const obs of PRESET_OBSERVATORIES) {
                const proj = projectOrthographic(obs.lon, obs.lat, this.globeCenter.lon, this.globeCenter.lat, radius);
                if (proj.visible) {
                  const dist = Math.hypot(proj.x - relX, proj.y - relY);
                  if (dist < minDist) {
                    minDist = dist;
                    targetObs = obs;
                  }
                }
              }
  
              if (targetObs) {
                this.setObserver(targetObs.lat, targetObs.lon, targetObs.name);
              } else {
                this.setObserver(hit.lat, hit.lon, 'Selected Position');
              }
  
              if (this.onOpenSkyDome) {
                this.onOpenSkyDome(this.observer);
              }
            }
          }
        } else {
          // 2D Equirectangular
          if (isClick) {
            const lon = (p.clientX / p.rectW) * 360 - 180;
            const lat = 90 - (p.clientY / p.rectH) * 180;
            let targetObs = null;
            let minDist = 16;
            for (const obs of PRESET_OBSERVATORIES) {
              const [ox, oy] = [((obs.lon + 180) / 360) * p.rectW, ((90 - obs.lat) / 180) * p.rectH];
              const dist = Math.hypot(ox - p.clientX, oy - p.clientY);
              if (dist < minDist) {
                minDist = dist;
                targetObs = obs;
              }
            }
  
            if (targetObs) {
              this.setObserver(targetObs.lat, targetObs.lon, targetObs.name);
            } else {
              this.setObserver(lat, lon, 'Selected Position');
            }
  
            if (this.onOpenSkyDome) {
              this.onOpenSkyDome(this.observer);
            }
          }
        }
  
        this.isDragging = false;
        this.dragStartPos = null;
      });
  
      this.canvas.addEventListener('mouseleave', () => {
        this.hoverCoord = null;
        this.isDragging = false;
      });
    }
  
    /**
     * Project geographic coordinates [lon, lat] to Canvas coordinates [x, y] in 2D mode.
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
  
      if (this.projectionMode === 'orthographic') {
        this.renderOrthographicGlobe(ctx, date, w, h, dpr);
      } else {
        this.renderEquirectangular(ctx, date, w, h, dpr);
      }
  
      ctx.restore();
    }
  
    /* ==========================================================================
       2D EQUIRECTANGULAR PROJECTION
       ========================================================================== */
    renderEquirectangular(ctx, date, w, h, dpr) {
      const opt = this.options;
  
      // 1. Ocean Background
      ctx.fillStyle = opt.oceanFill;
      ctx.fillRect(0, 0, w, h);
  
      // 2. Graticule Lines
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
      this.drawObservatoryFrame(ctx, w, h, dpr, 'EQUIRECTANGULAR');
    }
  
    /* ==========================================================================
       3D ORTHOGRAPHIC SPHERICAL GLOBE PROJECTION
       ========================================================================== */
    renderOrthographicGlobe(ctx, date, w, h, dpr) {
      const opt = this.options;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.41;
      const centerLon = this.globeCenter.lon;
      const centerLat = this.globeCenter.lat;
  
      const { subsolarPoint } = getSolarPosition(date);
      const sunPhiRad = subsolarPoint.latitudeDeg * (Math.PI / 180);
      const sunLamRad = subsolarPoint.longitudeDeg * (Math.PI / 180);
  
      // 1. Deep space backdrop with subtle stars
      ctx.fillStyle = '#06080d';
      ctx.fillRect(0, 0, w, h);
  
      // 2. Atmospheric Outer Limb Glow (Aerospace cyan luminescence)
      const limbGrad = ctx.createRadialGradient(cx, cy, radius * 0.95, cx, cy, radius * 1.07);
      limbGrad.addColorStop(0, 'rgba(79, 164, 232, 0.45)');
      limbGrad.addColorStop(0.5, 'rgba(79, 164, 232, 0.18)');
      limbGrad.addColorStop(1, 'rgba(79, 164, 232, 0)');
  
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.07, 0, Math.PI * 2);
      ctx.fillStyle = limbGrad;
      ctx.fill();
  
      // 3. Spherical Ocean Base (Clip to Globe)
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
  
      // Deep oceanic gradient
      const oceanGrad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
      oceanGrad.addColorStop(0, '#101726');
      oceanGrad.addColorStop(0.7, '#0a0f1c');
      oceanGrad.addColorStop(1, '#060912');
      ctx.fillStyle = oceanGrad;
      ctx.fill();
  
      // 4. 3D Projected Graticule
      this.drawOrthographicGraticule(ctx, cx, cy, radius, centerLon, centerLat, dpr);
  
      // 5. 3D Projected Continents
      this.drawOrthographicContinents(ctx, cx, cy, radius, centerLon, centerLat, dpr);
  
      // 6. 3D Spherical Day/Night Shadow Terminator
      this.drawOrthographicDayNight(ctx, cx, cy, radius, centerLon, centerLat, sunPhiRad, sunLamRad);
  
      // 7. City Lights Glowing on Night Side of Earth
      this.drawOrthographicCityLights(ctx, cx, cy, radius, centerLon, centerLat, sunPhiRad, sunLamRad, dpr);
  
      // 8. Preset Observatories on 3D Globe
      for (const obs of PRESET_OBSERVATORIES) {
        if (Math.abs(obs.lat - this.observer.lat) < 0.1 && Math.abs(obs.lon - this.observer.lon) < 0.1) {
          continue;
        }
        const proj = projectOrthographic(obs.lon, obs.lat, centerLon, centerLat, radius);
        if (proj.visible) {
          ctx.beginPath();
          ctx.arc(cx + proj.x, cy + proj.y, 2.0 * dpr, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(216, 226, 236, 0.55)';
          ctx.fill();
        }
      }
  
      // 9. 3D Subsolar Zenith Reticle on Globe
      const projSun = projectOrthographic(subsolarPoint.longitudeDeg, subsolarPoint.latitudeDeg, centerLon, centerLat, radius);
      if (projSun.visible) {
        this.drawGlobeSunMarker(ctx, cx + projSun.x, cy + projSun.y, dpr);
      }
  
      // 10. 3D Observer Crosshairs on Globe
      const projObs = projectOrthographic(this.observer.lon, this.observer.lat, centerLon, centerLat, radius);
      if (projObs.visible) {
        this.drawGlobeObserverMarker(ctx, cx + projObs.x, cy + projObs.y, dpr);
      }
  
      ctx.restore(); // End globe clip
  
      // 10. Outer Titanium & Platinum Horological Bezel Ring
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = opt.primaryGold;
      ctx.lineWidth = 1.8 * dpr;
      ctx.stroke();
  
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 3 * dpr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(216, 226, 236, 0.25)';
      ctx.lineWidth = 0.8 * dpr;
      ctx.stroke();
  
      this.drawObservatoryFrame(ctx, w, h, dpr, '3D ORTHOGRAPHIC GLOBE');
    }
  
    drawOrthographicGraticule(ctx, cx, cy, radius, centerLon, centerLat, dpr) {
      const opt = this.options;
      ctx.lineWidth = 0.6 * dpr;
  
      // Projected Parallels every 30°
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let hasStarted = false;
        for (let lon = -180; lon <= 180; lon += 4) {
          const p = projectOrthographic(lon, lat, centerLon, centerLat, radius);
          if (p.visible) {
            if (!hasStarted) {
              ctx.moveTo(cx + p.x, cy + p.y);
              hasStarted = true;
            } else {
              ctx.lineTo(cx + p.x, cy + p.y);
            }
          } else {
            hasStarted = false;
          }
        }
        ctx.strokeStyle = lat === 0 ? opt.equatorColor : opt.gridColor;
        ctx.stroke();
      }
  
      // Projected Meridians every 30°
      for (let lon = -180; lon < 180; lon += 30) {
        ctx.beginPath();
        let hasStarted = false;
        for (let lat = -88; lat <= 88; lat += 3) {
          const p = projectOrthographic(lon, lat, centerLon, centerLat, radius);
          if (p.visible) {
            if (!hasStarted) {
              ctx.moveTo(cx + p.x, cy + p.y);
              hasStarted = true;
            } else {
              ctx.lineTo(cx + p.x, cy + p.y);
            }
          } else {
            hasStarted = false;
          }
        }
        ctx.strokeStyle = lon === 0 ? 'rgba(200, 170, 110, 0.35)' : opt.gridColor;
        ctx.stroke();
      }
    }
  
    drawOrthographicContinents(ctx, cx, cy, radius, centerLon, centerLat, dpr) {
      const opt = this.options;
      ctx.fillStyle = opt.landFill;
      ctx.strokeStyle = opt.landBorder;
      ctx.lineWidth = 0.9 * dpr;
  
      for (const poly of WORLD_CONTINENTS) {
        ctx.beginPath();
        let started = false;
  
        for (let i = 0; i < poly.length; i++) {
          const [lon, lat] = poly[i];
          const p = projectOrthographic(lon, lat, centerLon, centerLat, radius);
  
          if (p.visible) {
            if (!started) {
              ctx.moveTo(cx + p.x, cy + p.y);
              started = true;
            } else {
              ctx.lineTo(cx + p.x, cy + p.y);
            }
          } else {
            started = false;
          }
        }
        ctx.fill();
        ctx.stroke();
      }
    }
  
    drawOrthographicDayNight(ctx, cx, cy, radius, centerLon, centerLat, sunPhiRad, sunLamRad) {
      // Render spherical day/night shadow using an offscreen grid buffer
      if (!this.orthoShadowCanvas) {
        this.orthoShadowW = 160;
        this.orthoShadowH = 160;
        this.orthoShadowCanvas = document.createElement('canvas');
        this.orthoShadowCanvas.width = this.orthoShadowW;
        this.orthoShadowCanvas.height = this.orthoShadowH;
        this.orthoShadowCtx = this.orthoShadowCanvas.getContext('2d');
        this.orthoShadowData = this.orthoShadowCtx.createImageData(this.orthoShadowW, this.orthoShadowH);
      }
  
      const sw = this.orthoShadowW;
      const sh = this.orthoShadowH;
      const sRadius = sw / 2;
      const buf = this.orthoShadowData.data;
  
      const sinPhiS = Math.sin(sunPhiRad);
      const cosPhiS = Math.cos(sunPhiRad);
  
      for (let py = 0; py < sh; py++) {
        const relY = py - sRadius;
        const rowOffset = py * sw * 4;
  
        for (let px = 0; px < sw; px++) {
          const relX = px - sRadius;
          const idx = rowOffset + px * 4;
  
          // Check if inside globe sphere
          const rho = Math.sqrt(relX * relX + relY * relY);
          if (rho > sRadius) {
            buf[idx + 3] = 0;
            continue;
          }
  
          // Raycast back to (lon, lat)
          const hit = unprojectOrthographic(relX, relY, centerLon, centerLat, sRadius);
          if (!hit.hit) {
            buf[idx + 3] = 0;
            continue;
          }
  
          const phi = hit.lat * (Math.PI / 180);
          const lam = hit.lon * (Math.PI / 180);
          const sinAlt = Math.sin(phi) * sinPhiS + Math.cos(phi) * cosPhiS * Math.cos(lam - sunLamRad);
  
          if (sinAlt >= 0.08) {
            // Daylight
            buf[idx + 3] = 0;
          } else if (sinAlt > 0) {
            // Golden hour
            buf[idx] = 200;
            buf[idx + 1] = 170;
            buf[idx + 2] = 110;
            buf[idx + 3] = Math.round((1 - sinAlt / 0.08) * 35);
          } else if (sinAlt >= -0.1045) {
            // Civil twilight
            buf[idx] = 8;
            buf[idx + 1] = 12;
            buf[idx + 2] = 28;
            buf[idx + 3] = Math.round(50 + (-sinAlt / 0.1045) * 60);
          } else if (sinAlt >= -0.2079) {
            // Nautical twilight
            buf[idx] = 6;
            buf[idx + 1] = 9;
            buf[idx + 2] = 20;
            buf[idx + 3] = Math.round(110 + ((-sinAlt - 0.1045) / 0.1034) * 55);
          } else {
            // Full nocturnal night
            buf[idx] = 4;
            buf[idx + 1] = 5;
            buf[idx + 2] = 12;
            buf[idx + 3] = 215;
          }
        }
      }
  
      this.orthoShadowCtx.putImageData(this.orthoShadowData, 0, 0);
  
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.orthoShadowCanvas, cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.restore();
    }
  
    drawOrthographicCityLights(ctx, cx, cy, radius, centerLon, centerLat, sunPhiRad, sunLamRad, dpr) {
      const sinPhiS = Math.sin(sunPhiRad);
      const cosPhiS = Math.cos(sunPhiRad);
  
      ctx.save();
      for (const city of MAJOR_CITIES) {
        const p = projectOrthographic(city.lon, city.lat, centerLon, centerLat, radius);
        if (!p.visible) continue;
  
        // Check if city is on the night hemisphere
        const phi = city.lat * (Math.PI / 180);
        const lam = city.lon * (Math.PI / 180);
        const sinAlt = Math.sin(phi) * sinPhiS + Math.cos(phi) * cosPhiS * Math.cos(lam - sunLamRad);
  
        if (sinAlt < -0.05) {
          // Darkness intensity factor
          const darkness = Math.min(1.0, (-sinAlt - 0.05) / 0.15);
          const cityR = (1.5 * city.weight) * dpr;
  
          // Warm golden incandescent city light
          ctx.beginPath();
          ctx.arc(cx + p.x, cy + p.y, cityR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 224, 130, ${0.75 * darkness})`;
          ctx.shadowColor = '#ffca28';
          ctx.shadowBlur = 6 * dpr;
          ctx.fill();
        }
      }
      ctx.restore();
    }
  
    drawGlobeSunMarker(ctx, sx, sy, dpr) {
      ctx.save();
      const sunGrad = ctx.createRadialGradient(sx, sy, 1 * dpr, sx, sy, 10 * dpr);
      sunGrad.addColorStop(0, '#ffffff');
      sunGrad.addColorStop(0.4, '#c8aa6e');
      sunGrad.addColorStop(1, 'rgba(200, 170, 110, 0)');
  
      ctx.beginPath();
      ctx.arc(sx, sy, 10 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = sunGrad;
      ctx.fill();
  
      ctx.beginPath();
      ctx.arc(sx, sy, 3 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }
  
    drawGlobeObserverMarker(ctx, ox, oy, dpr) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(ox, oy, 7 * dpr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200, 170, 110, 0.85)';
      ctx.lineWidth = 1.4 * dpr;
      ctx.stroke();
  
      ctx.beginPath();
      ctx.arc(ox, oy, 2.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
  
      // Crosshairs
      ctx.strokeStyle = '#e8ca8e';
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(ox - 10 * dpr, oy);
      ctx.lineTo(ox - 6 * dpr, oy);
      ctx.moveTo(ox + 6 * dpr, oy);
      ctx.lineTo(ox + 10 * dpr, oy);
      ctx.moveTo(ox, oy - 10 * dpr);
      ctx.lineTo(ox, oy - 6 * dpr);
      ctx.moveTo(ox, oy + 6 * dpr);
      ctx.lineTo(ox, oy + 10 * dpr);
      ctx.stroke();
  
      ctx.fillStyle = '#e8ca8e';
      ctx.font = `600 ${Math.round(8 * dpr)}px "Space Mono", monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(`⌖ ${this.observer.name}`, ox + 9 * dpr, oy - 7 * dpr);
      ctx.restore();
    }
  
    /* ==========================================================================
       SHARED HELPERS (Graticule, Frame, Telemetry)
       ========================================================================== */
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
  
            if (sinAlt >= 0.1045) {
              buf[idx + 3] = 0;
            } else if (sinAlt > 0) {
              buf[idx] = 200;
              buf[idx + 1] = 170;
              buf[idx + 2] = 110;
              buf[idx + 3] = Math.round((1 - sinAlt / 0.1045) * 30);
            } else if (sinAlt >= -0.1045) {
              buf[idx] = 10;
              buf[idx + 1] = 16;
              buf[idx + 2] = 32;
              buf[idx + 3] = Math.round(50 + (-sinAlt / 0.1045) * 60);
            } else if (sinAlt >= -0.2079) {
              buf[idx] = 7;
              buf[idx + 1] = 10;
              buf[idx + 2] = 22;
              buf[idx + 3] = Math.round(110 + ((-sinAlt - 0.1045) / 0.1034) * 55);
            } else if (sinAlt >= -0.3090) {
              buf[idx] = 5;
              buf[idx + 1] = 7;
              buf[idx + 2] = 16;
              buf[idx + 3] = Math.round(165 + ((-sinAlt - 0.2079) / 0.1011) * 35);
            } else {
              buf[idx] = 4;
              buf[idx + 1] = 5;
              buf[idx + 2] = 11;
              buf[idx + 3] = 215;
            }
          }
        }
  
        this.shadowCtx.putImageData(this.shadowImageData, 0, 0);
  
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this.shadowCanvas, 0, 0, w, h);
        ctx.restore();
      }
  
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
  
    drawGraticule(ctx, w, h) {
      const opt = this.options;
      const dpr = this.dpr;
      ctx.lineWidth = 0.5 * dpr;
  
      for (let lon = -180; lon <= 180; lon += 15) {
        const [x] = this.project(lon, 0);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.strokeStyle = lon === 0 ? 'rgba(200, 170, 110, 0.4)' : opt.gridColor;
        ctx.stroke();
      }
  
      for (let lat = -75; lat <= 75; lat += 15) {
        const [, y] = this.project(0, lat);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.strokeStyle = opt.gridColor;
        ctx.stroke();
      }
  
      const [, eqY] = this.project(0, 0);
      ctx.beginPath();
      ctx.moveTo(0, eqY);
      ctx.lineTo(w, eqY);
      ctx.strokeStyle = opt.equatorColor;
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();
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
  
    drawPresetObservatories(ctx, dpr) {
      for (const obs of PRESET_OBSERVATORIES) {
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
  
      ctx.save();
      ctx.translate(sunX, sunY);
  
      const sunGrad = ctx.createRadialGradient(0, 0, 1 * dpr, 0, 0, 8 * dpr);
      sunGrad.addColorStop(0, '#fff4d0');
      sunGrad.addColorStop(0.4, '#c8aa6e');
      sunGrad.addColorStop(1, 'rgba(200, 170, 110, 0)');
  
      ctx.beginPath();
      ctx.arc(0, 0, 8 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = sunGrad;
      ctx.fill();
  
      ctx.beginPath();
      ctx.arc(0, 0, 2.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
  
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
    }
  
    drawObserver(ctx, dpr) {
      const [x, y] = this.project(this.observer.lon, this.observer.lat);
  
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, 7 * dpr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200, 170, 110, 0.7)';
      ctx.lineWidth = 1.2 * dpr;
      ctx.stroke();
  
      ctx.beginPath();
      ctx.arc(x, y, 2.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
  
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
  
      ctx.fillStyle = '#e8ca8e';
      ctx.font = `600 ${Math.round(8 * dpr)}px "Space Mono", monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`⌖ ${this.observer.name}`, x + 9 * dpr, y - 8 * dpr);
  
      ctx.restore();
    }
  
    drawObservatoryFrame(ctx, w, h, dpr, projectionLabel) {
      const opt = this.options;
  
      ctx.strokeStyle = 'rgba(216, 226, 236, 0.16)';
      ctx.lineWidth = 1 * dpr;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  
      const bracketSize = 10 * dpr;
      ctx.strokeStyle = opt.primaryGold;
      ctx.lineWidth = 1.5 * dpr;
  
      ctx.beginPath();
      ctx.moveTo(0.5, bracketSize);
      ctx.lineTo(0.5, 0.5);
      ctx.lineTo(bracketSize, 0.5);
      ctx.stroke();
  
      ctx.beginPath();
      ctx.moveTo(w - bracketSize, 0.5);
      ctx.lineTo(w - 0.5, 0.5);
      ctx.lineTo(w - 0.5, bracketSize);
      ctx.stroke();
  
      ctx.beginPath();
      ctx.moveTo(0.5, h - bracketSize);
      ctx.lineTo(0.5, h - 0.5);
      ctx.lineTo(bracketSize, h - 0.5);
      ctx.stroke();
  
      ctx.beginPath();
      ctx.moveTo(w - bracketSize, h - 0.5);
      ctx.lineTo(w - 0.5, h - 0.5);
      ctx.lineTo(w - 0.5, h - bracketSize);
      ctx.stroke();
  
      ctx.fillStyle = 'rgba(200, 170, 110, 0.8)';
      ctx.font = `600 ${Math.round(7 * dpr)}px "Space Mono", monospace`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`SOLAR TERMINATOR OBSERVATORY // ${projectionLabel}`, w - 14 * dpr, 6 * dpr);
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
      this.options = safeMerge({
        primaryGold: '#c8aa6e',
        goldLight: '#e8ca8e',
        platinum: '#d8e2ec',
        deepSky: '#05070e',
        moonBright: '#eaf0f8',
        moonDark: '#121620',
        craterColor: 'rgba(90, 105, 125, 0.28)'
      }, options);
  
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
          <span class="lunar-phase-badge">${escapeHTML(comp.phaseName.toUpperCase())}</span>
          <span class="lunar-orbit-dir">${comp.isWaxing ? '▲ WAXING' : '▼ WANING'}</span>
        </div>
        <div class="lunar-stat-grid">
          <div class="lunar-stat">
            <span class="stat-label">ILLUMINATION</span>
            <span class="stat-value gold-glow">${escapeHTML(comp.illuminationPercent)}%</span>
          </div>
          <div class="lunar-stat">
            <span class="stat-label">LUNAR AGE</span>
            <span class="stat-value">${escapeHTML(comp.lunarAgeDays.toFixed(1))} <small>d</small></span>
          </div>
          <div class="lunar-stat">
            <span class="stat-label">NEXT FULL MOON</span>
            <span class="stat-value">${escapeHTML(fullDays)}d ${escapeHTML(fullHours)}h</span>
          </div>
          <div class="lunar-stat">
            <span class="stat-label">NEXT NEW MOON</span>
            <span class="stat-value">${escapeHTML(newDays)}d ${escapeHTML(newHours)}h</span>
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
                <span class="telemetry-highlight gold-glow">${escapeHTML(this.formatTime(telemetry.solarNoonUTC))}</span>
              </div>
              <div class="telemetry-subdata">
                <div>Transit Altitude: <strong>${escapeHTML(telemetry.solarElevationAtNoonDeg.toFixed(1))}°</strong></div>
                <div>Declination: <strong>${solarPos.declinationDeg >= 0 ? '+' : ''}${escapeHTML(solarPos.declinationDeg.toFixed(2))}°</strong></div>
              </div>
            </div>
  
            <!-- Daylight & Solar Cycle -->
            <div class="telemetry-card">
              <div class="telemetry-card-title">
                <span class="icon">🌅</span> SOLAR CYCLE (HORIZON)
              </div>
              <div class="telemetry-row">
                <span class="field-label">Sunrise</span>
                <span class="field-value">${escapeHTML(this.formatTime(telemetry.sunriseUTC))}</span>
              </div>
              <div class="telemetry-row">
                <span class="field-label">Sunset</span>
                <span class="field-value">${escapeHTML(this.formatTime(telemetry.sunsetUTC))}</span>
              </div>
              <div class="telemetry-row">
                <span class="field-label">Day Length</span>
                <span class="field-value platinum-glow">${escapeHTML(telemetry.dayLengthHours.toFixed(2))} hrs</span>
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
                  <span class="twilight-val">${escapeHTML(this.formatTime(telemetry.civilDawnUTC))} / ${escapeHTML(this.formatTime(telemetry.civilDuskUTC))}</span>
                </div>
                <div class="twilight-phase">
                  <span class="twilight-tag">NAUTICAL (−6° to −12°)</span>
                  <span class="twilight-val">${escapeHTML(this.formatTime(telemetry.nauticalDawnUTC))} / ${escapeHTML(this.formatTime(telemetry.nauticalDuskUTC))}</span>
                </div>
                <div class="twilight-phase">
                  <span class="twilight-tag">ASTRONOMICAL (−12° to −18°)</span>
                  <span class="twilight-val">${escapeHTML(this.formatTime(telemetry.astronomicalDawnUTC))} / ${escapeHTML(this.formatTime(telemetry.astronomicalDuskUTC))}</span>
                </div>
              </div>
            </div>
  
            <!-- Equation of Time -->
            <div class="telemetry-card eot-card">
              <div class="telemetry-card-title">
                <span class="icon">⏱️</span> EQUATION OF TIME (EoT)
              </div>
              <div class="eot-main-row">
                <span class="eot-value gold-glow">${escapeHTML(eotFormatted)}</span>
                <span class="eot-status">${escapeHTML(eotAheadBehind)}</span>
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
                  <option value="${escapeHTML(p.iso || 'realtime')}" ${idx === 0 ? 'selected' : ''}>${escapeHTML(p.label)}</option>
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
        btnPlayPause.textContent = isPlaying ? '❚❚ PAUSE' : '▶ PLAY';
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
  // Module: src/ui/sky-dome.js
  // ==========================================
  /**
   * Meridian Chronometer — Observatory Zenith Sky Dome (Planisphere)
   * High-precision local horizontal stereographic sky dome.
   * Projects real-time visible stars, planets, horizon, zenith, and celestial meridian.
   */
  
  
  
  
  class SkyDomeModal {
    constructor(modalElement, canvasElement, options = {}) {
      this.modal = modalElement;
      this.canvas = canvasElement;
      this.ctx = canvasElement.getContext('2d');
      this.options = safeMerge({
        primaryGold: '#c8aa6e',
        goldBright: '#e8ca8e',
        platinum: '#d8e2ec',
        platinumMuted: 'rgba(216, 226, 236, 0.35)',
        deepSpace: '#05070d',
        gridColor: 'rgba(216, 226, 236, 0.10)',
        meridianColor: 'rgba(200, 170, 110, 0.35)',
        horizonColor: 'rgba(200, 170, 110, 0.8)'
      }, options);
  
      this.isOpen = false;
      this.hoveredObject = null;
      this.currentDate = new Date();
      this.currentObserver = { lat: 51.4769, lon: 0.0005, name: 'Royal Observatory Greenwich' };
      this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  
      this.initEvents();
      this.resize();
    }
  
    resize() {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const size = Math.min(rect.width || 460, rect.height || 460);
      this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      this.canvas.width = Math.round(size * this.dpr);
      this.canvas.height = Math.round(size * this.dpr);
      this.radius = (size / 2) * 0.88;
    }
  
    initEvents() {
      if (!this.canvas) return;
  
      // Hover tooltip tracking
      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * this.dpr;
        const y = (e.clientY - rect.top) * this.dpr;
        this.checkHover(x, y);
      });
  
      this.canvas.addEventListener('mouseleave', () => {
        this.hoveredObject = null;
      });
  
      // Close button in modal
      const btnClose = this.modal.querySelector('.modal-close-btn');
      if (btnClose) {
        btnClose.addEventListener('click', () => this.close());
      }
  
      // Close on overlay backdrop click
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.close();
        }
      });
  
      // Close on ESC key
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });
    }
  
    open(observer, date) {
      this.currentObserver = observer;
      this.currentDate = date;
      this.isOpen = true;
      this.modal.classList.add('active');
      this.modal.setAttribute('aria-hidden', 'false');
      this.resize();
      this.render();
    }
  
    close() {
      this.isOpen = false;
      this.modal.classList.remove('active');
      this.modal.setAttribute('aria-hidden', 'true');
      this.hoveredObject = null;
    }
  
    /**
     * Projects Horizontal coordinates (altDeg, azDeg) to 2D Planisphere Canvas.
     * Center (cx, cy) is Zenith (alt = 90°).
     * Perimeter is Horizon (alt = 0°).
     * North is at Top (az = 0°), East at Left or Right (standard planisphere holds map up to sky).
     */
    projectAltAz(altDeg, azDeg, cx, cy, r) {
      // Polar projection: distance from center proportional to zenith angle (90 - alt)
      const zAngle = 90.0 - altDeg;
      const dist = (zAngle / 90.0) * r;
  
      // Azimuth measured from North (0° / top), clockwise through East (90° / right)
      const azRad = (azDeg - 90.0) * (Math.PI / 180.0);
      const x = cx + dist * Math.cos(azRad);
      const y = cy + dist * Math.sin(azRad);
  
      return { x, y, dist };
    }
  
    checkHover(canvasX, canvasY) {
      if (!this.cachedCelestialObjects) return;
      let closest = null;
      let minDist = 14 * this.dpr;
  
      for (const obj of this.cachedCelestialObjects) {
        if (!obj.isVisible) continue;
        const dx = obj.projX - canvasX;
        const dy = obj.projY - canvasY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          closest = obj;
        }
      }
  
      this.hoveredObject = closest;
    }
  
    render(date = null, observer = null) {
      if (date) this.currentDate = date;
      if (observer) this.currentObserver = observer;
      if (!this.isOpen || !this.ctx) return;
  
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const dpr = this.dpr;
      const r = this.radius * dpr;
  
      ctx.save();
      ctx.clearRect(0, 0, w, h);
  
      const lmstHours = getLMST(this.currentDate, this.currentObserver.lon);
      const solarPos = getSolarPosition(this.currentDate);
  
      // 1. Sky Background & Atmospheric Tint
      this.drawSkyDomeBackground(ctx, cx, cy, r, solarPos);
  
      // 2. Dome Grid (Zenith, Horizon, Altitude circles, Meridian)
      this.drawDomeGrid(ctx, cx, cy, r, dpr);
  
      // 3. Compute and Render Celestial Objects (Stars, Planets, Moon, Sun)
      this.renderCelestialBodies(ctx, cx, cy, r, dpr, lmstHours);
  
      // 4. Horizon Frame & Cardinal Compass Labels (N, E, S, W)
      this.drawHorizonFrame(ctx, cx, cy, r, dpr);
  
      // 5. Hover Object Inspector Card
      if (this.hoveredObject) {
        this.drawObjectTooltip(ctx, cx, cy, dpr, this.hoveredObject);
      }
  
      ctx.restore();
  
      // Update Modal Header Telemetry
      this.updateModalInfo(lmstHours);
    }
  
    drawSkyDomeBackground(ctx, cx, cy, r, solarPos) {
      // Determine sun altitude to color sky (day vs twilight vs starry night)
      const sunAltAz = raDecToAltAz(
        solarPos.rightAscensionHours,
        solarPos.declinationDeg,
        getLMST(this.currentDate, this.currentObserver.lon),
        this.currentObserver.lat
      );
  
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      if (sunAltAz.altitudeDeg > 0) {
        // Daytime solar azure glow
        grad.addColorStop(0, '#10223d');
        grad.addColorStop(0.7, '#0a1628');
        grad.addColorStop(1, '#050c18');
      } else if (sunAltAz.altitudeDeg > -12) {
        // Twilight violet
        grad.addColorStop(0, '#0d1024');
        grad.addColorStop(0.7, '#070a16');
        grad.addColorStop(1, '#03050a');
      } else {
        // Deep nocturnal observatory space
        grad.addColorStop(0, '#060912');
        grad.addColorStop(0.7, '#04060c');
        grad.addColorStop(1, '#020306');
      }
  
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
  
      // Faint Milky Way dusting
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      const mwGrad = ctx.createLinearGradient(cx - r, cy - r * 0.5, cx + r, cy + r * 0.5);
      mwGrad.addColorStop(0, 'rgba(120, 160, 220, 0)');
      mwGrad.addColorStop(0.5, 'rgba(140, 180, 255, 0.05)');
      mwGrad.addColorStop(1, 'rgba(120, 160, 220, 0)');
      ctx.fillStyle = mwGrad;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
    }
  
    drawDomeGrid(ctx, cx, cy, r, dpr) {
      const opt = this.options;
  
      // Altitude Circles (30° and 60°)
      for (const alt of [30, 60]) {
        const zAngle = 90 - alt;
        const circleR = (zAngle / 90.0) * r;
        ctx.beginPath();
        ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
        ctx.strokeStyle = opt.gridColor;
        ctx.lineWidth = 0.8 * dpr;
        ctx.setLineDash([2 * dpr, 4 * dpr]);
        ctx.stroke();
        ctx.setLineDash([]);
  
        // Altitude label
        ctx.fillStyle = 'rgba(216, 226, 236, 0.25)';
        ctx.font = `${Math.round(7 * dpr)}px "Space Mono", monospace`;
        ctx.fillText(`${alt}°`, cx + 4 * dpr, cy - circleR + 9 * dpr);
      }
  
      // Celestial Meridian (North-Zenith-South axis)
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx, cy + r);
      ctx.strokeStyle = opt.meridianColor;
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();
  
      // Prime Vertical (East-Zenith-West axis)
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.lineTo(cx + r, cy);
      ctx.strokeStyle = opt.gridColor;
      ctx.lineWidth = 0.8 * dpr;
      ctx.stroke();
  
      // Zenith Reticle
      ctx.beginPath();
      ctx.arc(cx, cy, 3 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = opt.primaryGold;
      ctx.fill();
      ctx.fillStyle = opt.goldBright;
      ctx.font = `600 ${Math.round(7 * dpr)}px "Cinzel", serif`;
      ctx.textAlign = 'left';
      ctx.fillText('ZENITH (90°)', cx + 6 * dpr, cy - 4 * dpr);
    }
  
    renderCelestialBodies(ctx, cx, cy, r, dpr, lmstHours) {
      const objects = [];
      const lat = this.currentObserver.lat;
  
      // 1. Navigation Stars
      for (const star of BRIGHT_STARS) {
        const altAz = raDecToAltAz(star.raHours, star.decDeg, lmstHours, lat);
        const isVis = altAz.altitudeDeg >= 0;
        const { x, y } = this.projectAltAz(altAz.altitudeDeg, altAz.azimuthDeg, cx, cy, r);
  
        objects.push({
          type: 'star',
          name: star.name,
          subtitle: `${star.bayer} in ${star.const}`,
          mag: star.mag,
          color: star.color,
          alt: altAz.altitudeDeg,
          az: altAz.azimuthDeg,
          isVisible: isVis,
          projX: x,
          projY: y
        });
      }
  
      // 2. Planets (Venus, Mars, Jupiter)
      const planets = getPlanetaryPositions(this.currentDate);
      for (const [key, planet] of Object.entries(planets)) {
        const altAz = raDecToAltAz(planet.raHours, planet.decDeg, lmstHours, lat);
        const isVis = altAz.altitudeDeg >= 0;
        const { x, y } = this.projectAltAz(altAz.altitudeDeg, altAz.azimuthDeg, cx, cy, r);
  
        objects.push({
          type: 'planet',
          name: planet.name,
          subtitle: `${planet.symbol} Classical Planet`,
          mag: planet.magnitude,
          color: planet.color,
          symbol: planet.symbol,
          alt: altAz.altitudeDeg,
          az: altAz.azimuthDeg,
          isVisible: isVis,
          projX: x,
          projY: y
        });
      }
  
      // 3. True Sun
      const solarPos = getSolarPosition(this.currentDate);
      const sunAltAz = raDecToAltAz(solarPos.rightAscensionHours, solarPos.declinationDeg, lmstHours, lat);
      const sunProj = this.projectAltAz(sunAltAz.altitudeDeg, sunAltAz.azimuthDeg, cx, cy, r);
      objects.push({
        type: 'sun',
        name: 'The Sun',
        subtitle: 'Solar Meridian Center',
        mag: -26.7,
        color: '#fff0a8',
        symbol: '☀️',
        alt: sunAltAz.altitudeDeg,
        az: sunAltAz.azimuthDeg,
        isVisible: sunAltAz.altitudeDeg >= -18,
        projX: sunProj.x,
        projY: sunProj.y
      });
  
      this.cachedCelestialObjects = objects;
  
      // Draw visible celestial bodies
      for (const obj of objects) {
        if (!obj.isVisible) continue;
  
        ctx.save();
        if (obj.type === 'star') {
          // Star size based on astronomical magnitude
          const starR = Math.max(1.5 * dpr, (4.2 - obj.mag * 0.8) * dpr);
          ctx.beginPath();
          ctx.arc(obj.projX, obj.projY, starR, 0, Math.PI * 2);
          ctx.fillStyle = obj.color;
          ctx.shadowColor = obj.color;
          ctx.shadowBlur = 6 * dpr;
          ctx.fill();
  
          // Label for bright stars (mag < 1.5)
          if (obj.mag < 1.5) {
            ctx.fillStyle = 'rgba(216, 226, 236, 0.7)';
            ctx.font = `${Math.round(6.5 * dpr)}px "Space Mono", monospace`;
            ctx.fillText(obj.name, obj.projX + starR + 3 * dpr, obj.projY + 2 * dpr);
          }
        } else if (obj.type === 'planet') {
          // Glowing planetary disc
          const pR = 3.5 * dpr;
          ctx.beginPath();
          ctx.arc(obj.projX, obj.projY, pR, 0, Math.PI * 2);
          ctx.fillStyle = obj.color;
          ctx.shadowColor = obj.color;
          ctx.shadowBlur = 8 * dpr;
          ctx.fill();
  
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.round(7 * dpr)}px "Space Mono", monospace`;
          ctx.fillText(obj.name, obj.projX + pR + 4 * dpr, obj.projY + 3 * dpr);
        } else if (obj.type === 'sun') {
          // Solar Disc & Radiant Flare
          const sR = 5 * dpr;
          const sunGrad = ctx.createRadialGradient(obj.projX, obj.projY, 1, obj.projX, obj.projY, 12 * dpr);
          sunGrad.addColorStop(0, '#ffffff');
          sunGrad.addColorStop(0.4, '#c8aa6e');
          sunGrad.addColorStop(1, 'rgba(200, 170, 110, 0)');
          ctx.beginPath();
          ctx.arc(obj.projX, obj.projY, 12 * dpr, 0, Math.PI * 2);
          ctx.fillStyle = sunGrad;
          ctx.fill();
  
          ctx.beginPath();
          ctx.arc(obj.projX, obj.projY, sR, 0, Math.PI * 2);
          ctx.fillStyle = '#fffdf0';
          ctx.fill();
        }
        ctx.restore();
      }
    }
  
    drawHorizonFrame(ctx, cx, cy, r, dpr) {
      const opt = this.options;
  
      // Horizon border (alt = 0°)
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = opt.primaryGold;
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();
  
      // Concentric outer bezel ring
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4 * dpr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(216, 226, 236, 0.2)';
      ctx.lineWidth = 0.8 * dpr;
      ctx.stroke();
  
      // 360-degree Azimuth ticks around the horizon
      for (let az = 0; az < 360; az += 10) {
        const angle = (az - 90.0) * (Math.PI / 180.0);
        const isMajor = az % 30 === 0;
        const tickLen = (isMajor ? 6 : 3) * dpr;
  
        const x1 = cx + Math.cos(angle) * r;
        const y1 = cy + Math.sin(angle) * r;
        const x2 = cx + Math.cos(angle) * (r - tickLen);
        const y2 = cy + Math.sin(angle) * (r - tickLen);
  
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = isMajor ? opt.primaryGold : 'rgba(216, 226, 236, 0.3)';
        ctx.lineWidth = (isMajor ? 1.2 : 0.6) * dpr;
        ctx.stroke();
      }
  
      // Compass Cardinal Labels (N at top, E at right, S at bottom, W at left)
      const cardinals = [
        { label: 'N', az: 0 },
        { label: 'E', az: 90 },
        { label: 'S', az: 180 },
        { label: 'W', az: 270 }
      ];
  
      ctx.font = `600 ${Math.round(9 * dpr)}px "Cinzel", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
  
      for (const card of cardinals) {
        const angle = (card.az - 90.0) * (Math.PI / 180.0);
        const lx = cx + Math.cos(angle) * (r + 14 * dpr);
        const ly = cy + Math.sin(angle) * (r + 14 * dpr);
  
        ctx.fillStyle = card.label === 'N' ? '#ff6b6b' : opt.primaryGold;
        ctx.fillText(card.label, lx, ly);
      }
    }
  
    drawObjectTooltip(ctx, cx, cy, dpr, obj) {
      const cardW = 160 * dpr;
      const cardH = 55 * dpr;
      let cardX = obj.projX + 12 * dpr;
      let cardY = obj.projY - 25 * dpr;
  
      // Boundary containment
      if (cardX + cardW > this.canvas.width - 10 * dpr) {
        cardX = obj.projX - cardW - 12 * dpr;
      }
      if (cardY < 10 * dpr) {
        cardY = 10 * dpr;
      }
  
      ctx.save();
      ctx.fillStyle = 'rgba(9, 11, 18, 0.95)';
      ctx.strokeStyle = this.options.primaryGold;
      ctx.lineWidth = 1 * dpr;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 10 * dpr;
  
      ctx.strokeRect(cardX, cardY, cardW, cardH);
      ctx.fillRect(cardX, cardY, cardW, cardH);
  
      ctx.fillStyle = this.options.goldBright;
      ctx.font = `600 ${Math.round(8 * dpr)}px "Space Mono", monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(obj.name.toUpperCase(), cardX + 8 * dpr, cardY + 7 * dpr);
  
      ctx.fillStyle = 'rgba(216, 226, 236, 0.6)';
      ctx.font = `${Math.round(6.5 * dpr)}px "Space Mono", monospace`;
      ctx.fillText(obj.subtitle, cardX + 8 * dpr, cardY + 19 * dpr);
  
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.round(7 * dpr)}px "Space Mono", monospace`;
      ctx.fillText(`Alt: ${obj.alt.toFixed(1)}°  Az: ${obj.az.toFixed(1)}°`, cardX + 8 * dpr, cardY + 34 * dpr);
  
      ctx.restore();
    }
  
    updateModalInfo(lmstHours) {
      const infoEl = this.modal.querySelector('#skyDomeInfo');
      if (infoEl) {
        const obs = this.currentObserver;
        const latFmt = `${Math.abs(obs.lat).toFixed(2)}° ${obs.lat >= 0 ? 'N' : 'S'}`;
        const lonFmt = `${Math.abs(obs.lon).toFixed(2)}° ${obs.lon >= 0 ? 'E' : 'W'}`;
        const lmstH = Math.floor(lmstHours);
        const lmstM = Math.floor((lmstHours % 1) * 60);
        const pad = (n) => String(n).padStart(2, '0');
  
        infoEl.innerHTML = `
          <strong>${escapeHTML(obs.name)}</strong> [${escapeHTML(latFmt)}, ${escapeHTML(lonFmt)}] &bull;
          LMST: <span class="gold-glow">${escapeHTML(pad(lmstH))}:${escapeHTML(pad(lmstM))}</span>
        `;
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
  
      // 3D globe projection toggle & sky dome buttons
      this.btnProj2D = document.getElementById('btnProj2D');
      this.btnProj3D = document.getElementById('btnProj3D');
      this.btnOpenSkyDome = document.getElementById('btnOpenSkyDome');
      this.skyDomeModalEl = document.getElementById('skyDomeModal');
      this.skyDomeCanvas = document.getElementById('skyDomeCanvas');
  
      // Populate preset observatories in header dropdown
      if (this.observatorySelect) {
        this.observatorySelect.innerHTML = PRESET_OBSERVATORIES.map((obs) => `
          <option value="${escapeHTML(obs.id)}">${escapeHTML(obs.name)} (${escapeHTML(obs.country)})</option>
        `).join('');
      }
    }
  
    initInstruments() {
      this.chronometerDial = new ChronometerDial(this.dialCanvas);
      this.worldObservatory = new WorldObservatory(this.mapCanvas);
      this.lunarComplication = new LunarComplication(this.lunarCanvas, this.lunarTelemetryContainer);
      this.telemetryDisplay = new TelemetryDisplay(this.telemetryContainer, this.analemmaCanvas);
      this.timeScrubber = new TimeScrubber(this.scrubberContainer, this.timeController);
  
      // Initialize Local Zenith Sky Dome Modal (Planisphere)
      if (this.skyDomeModalEl && this.skyDomeCanvas) {
        this.skyDomeModal = new SkyDomeModal(this.skyDomeModalEl, this.skyDomeCanvas);
      }
  
      // Sync observer change from map click to select dropdown & open sky dome
      this.worldObservatory.onObserverChange = (obs) => {
        this.updateObserverDisplay(obs);
        if (this.skyDomeModal && this.skyDomeModal.isOpen) {
          this.skyDomeModal.render(this.timeController.getTime(), obs);
        }
      };
  
      // Open Sky Dome modal when clicking an observatory or location
      this.worldObservatory.onOpenSkyDome = (obs) => {
        if (this.skyDomeModal) {
          this.skyDomeModal.open(obs, this.timeController.getTime());
        }
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
      // Projection mode toggle (2D Flat vs 3D Orthographic Globe)
      if (this.btnProj2D && this.btnProj3D) {
        this.btnProj2D.addEventListener('click', () => {
          this.worldObservatory.setProjectionMode('equirectangular');
          this.btnProj2D.classList.add('active');
          this.btnProj3D.classList.remove('active');
        });
  
        this.btnProj3D.addEventListener('click', () => {
          this.worldObservatory.setProjectionMode('orthographic');
          this.btnProj3D.classList.add('active');
          this.btnProj2D.classList.remove('active');
        });
      }
  
      // Sky Dome planisphere open button
      if (this.btnOpenSkyDome) {
        this.btnOpenSkyDome.addEventListener('click', () => {
          if (this.skyDomeModal) {
            this.skyDomeModal.open(this.worldObservatory.observer, this.timeController.getTime());
          }
        });
      }
  
      // Window resize observer for all canvas instruments
      window.addEventListener('resize', () => {
        this.chronometerDial.resize();
        this.worldObservatory.resize();
        this.lunarComplication.resize();
        if (this.skyDomeModal) {
          this.skyDomeModal.resize();
        }
        this.renderFrame();
      });
  
      // Observer selection change
      if (this.observatorySelect) {
        this.observatorySelect.addEventListener('change', (e) => {
          const obs = PRESET_OBSERVATORIES.find((o) => o.id === e.target.value);
          if (obs) {
            this.worldObservatory.setObserver(obs.lat, obs.lon, obs.name);
            this.worldObservatory.globeCenter.lon = obs.lon;
            this.worldObservatory.globeCenter.lat = Math.max(-60, Math.min(60, obs.lat));
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
      if (this.observatorySelect) {
        const match = PRESET_OBSERVATORIES.find(
          (o) => Math.abs(o.lat - obs.lat) < 0.1 && Math.abs(o.lon - obs.lon) < 0.1
        );
        if (match) {
          this.observatorySelect.value = match.id;
        }
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
  
      // 5. Render Local Sky Dome if open
      if (this.skyDomeModal && this.skyDomeModal.isOpen) {
        this.skyDomeModal.render(date, observer);
      }
  
      // 6. Update Digital Readouts
      const utcDecimalHours =
        date.getUTCHours() +
        date.getUTCMinutes() / 60.0 +
        date.getUTCSeconds() / 3600.0 +
        date.getUTCMilliseconds() / 3600000.0;
  
      if (this.utcReadout) {
        this.utcReadout.innerHTML = `${escapeHTML(this.formatHMS(utcDecimalHours, true))} <small>UTC</small>`;
      }
      if (this.solarReadout) {
        this.solarReadout.innerHTML = `${escapeHTML(this.formatHMS(solarTime.apparentHours, false))} <small>SOLAR</small>`;
      }
      if (this.siderealReadout) {
        this.siderealReadout.innerHTML = `${escapeHTML(this.formatHMS(siderealHours, false))} <small>LMST</small>`;
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
