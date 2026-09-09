# Meridian Chronometer — Agent Directives

Engineering rules and architecture guidelines for agents working on `meridian-chronometer`.

## Core Philosophy & Constraints
- **Zero Runtime Dependencies**: The chronometer is built with vanilla modern ES modules (`type: module`), HTML5 Canvas 2D, and inline SVG. Never introduce external runtime packages.
- **Zero Test Dependencies**: The test suite runs natively on Node.js using `node:test` and `node:assert/strict` via `npm test`.
- **Astronomical Precision**: Mathematical algorithms must reflect established astronomical algorithms (Jean Meeus, USNO, JPL standard approximations).
- **Coordinate Conventions**:
  - Geographic Longitudes: Degrees East positive $[-180^\circ, +180^\circ]$ (or $[0^\circ, 360^\circ]$ where specified).
  - Geographic Latitudes: Degrees North positive $[-90^\circ, +90^\circ]$.
  - Sidereal and Solar times: Expressed in decimal hours $[0, 24)$ or converted to HMS.
  - Angles in internal math: Clearly convert degrees to radians via `rad = deg * Math.PI / 180` and back via `deg = rad * 180 / Math.PI`.

## Architecture & Seams
- `src/engine/astronomy.js`: Pure mathematical core. Deterministic, side-effect free, fully covered by unit tests.
  - `getJulianDate(date)` & `getJulianCenturies(jd)`
  - `getGMST(date)` & `getLMST(date, lon)`
  - `getSolarPosition(date)` (declination, RA, EoT, subsolar point)
  - `getLocalSolarTime(date, lon)` (apparent and mean solar time)
  - `getCelestialTelemetry(date, lat, lon)` (transit, sunrise, sunset, golden hour, twilight phases)
  - `getLunarComplication(date)` (illumination fraction, lunar age, phase name, next full/new moon)
  - `getTerminatorPoints(date, numPoints)` (analytical coordinates for day/night curve)
- `src/engine/time-controller.js`: State manager for realtime clock tick, simulation scrubbing, play/pause, and acceleration multipliers (`1x`, `60x`, `3600x`, `86400x`).
- `src/ui/chronometer-dial.js`: Master 24h Swiss horology dial with mechanical sweeping hands for UTC, Solar, and Sidereal time.
- `src/ui/world-observatory.js`: Interactive canvas world map rendering the real-time solar terminator, twilight bands, subsolar zenith, and observer crosshairs.
- `src/ui/lunar-complication.js`: Mechanical lunar dial with realistic spherical illumination, phase readout, and moon age telemetry.
- `src/ui/telemetry-display.js`: Observatory telemetry dashboard for solar transit, twilight bands, and equation of time analemma.
- `src/ui/time-scrubber.js`: Tactile slider and time controls for scrubbing across centuries or accelerating time.

## Verification
- Always execute `npm test` before concluding any change to the astronomical engine.
- Verify that tests run clean and fast with zero warnings.
