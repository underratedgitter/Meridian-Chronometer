# Meridian Chronometer

A high-precision luxury astronomical chronometer engine and observatory interface synthesizing classical Swiss horology with aerospace celestial mechanics.

## Language

### Temporal Coordinates

**Julian Date**:
A continuous count of days and fractional days elapsed since noon UTC on January 1, 4713 BCE (proleptic Julian calendar).
_Avoid_: Epoch timestamp, Unix timestamp (when referring to astronomical calculations)

**Julian Century**:
A unit of 36,525 Julian days (876,600 hours) measured from standard epoch J2000.0 (2000-01-01 12:00:00 TT/UTC).
_Avoid_: Solar century, calendar century

**Greenwich Mean Sidereal Time (GMST)**:
The hour angle of the mean vernal equinox relative to the Greenwich Prime Meridian, measuring Earth's rotation relative to distant fixed stars.
_Avoid_: Star time, sidereal clock (unless specifying the physical dial)

**Local Mean Sidereal Time (LMST)**:
The Greenwich Mean Sidereal Time adjusted for the observer's geographic longitude.
_Avoid_: Local star time

**Local Apparent Solar Time (LAST)**:
The time measured by the actual physical position of the true Sun in the local sky, where solar noon is the exact instant the Sun crosses the local meridian.
_Avoid_: Sundial time, sun clock

**Local Mean Solar Time (LMST_Solar)**:
The uniform time calculated by assuming a fictitious Sun moving at constant angular speed along the celestial equator.
_Avoid_: Clock time, civil time (which includes daylight saving and time zone grouping)

**Equation of Time (EoT)**:
The discrepancy in minutes between apparent solar time (sundial) and mean solar time (uniform clock), caused by Earth's orbital eccentricity and axial tilt.
_Avoid_: Solar error, time correction, clock offset

### Solar & Terrestrial Phenomena

**Subsolar Point**:
The single geographic point on Earth's surface where the Sun is positioned at the local zenith (directly overhead at 90° altitude).
_Avoid_: Sun point, zenith point

**Solar Terminator**:
The moving great-circle boundary on Earth's surface separating the hemisphere illuminated by sunlight from the hemisphere in darkness.
_Avoid_: Day-night line, twilight line, shadow edge

**Solar Declination**:
The angular distance of the Sun north or south of the celestial equator, oscillating between approximately +23.44° and -23.44°.
_Avoid_: Solar tilt, sun latitude

**Solar Zenith**:
The imaginary point directly overhead an observer; the solar zenith angle is the angle between the Sun and this overhead point.
_Avoid_: Overhead point

**Civil Twilight**:
The geometric interval when the center of the solar disc is between 0° and 6° below the horizon, where terrestrial objects are clearly visible without artificial illumination.
_Avoid_: Early dusk, morning dusk

**Nautical Twilight**:
The geometric interval when the solar disc center is between 6° and 12° below the horizon, where sea navigators can simultaneously discern horizon lines and bright stars.
_Avoid_: Deep dusk, sailing light

**Astronomical Twilight**:
The geometric interval when the solar disc center is between 12° and 18° below the horizon, beyond which the sky is completely dark for astronomical observation.
_Avoid_: Complete night, nightfall

**Golden Hour**:
The period shortly after sunrise or before sunset when the solar altitude is between 0° and +6° above the horizon, casting warm, diffuse, low-angle light.
_Avoid_: Magic hour

### Lunar Complications

**Synodic Month**:
The mean duration (approximately 29.530588853 days) required for the Moon to complete a cycle of phases from one New Moon to the next.
_Avoid_: Lunar month, moon cycle

**Lunar Age**:
The elapsed time in days and fractional days since the most recent New Moon.
_Avoid_: Moon day, phase age

**Phase Angle**:
The angle between the Sun and Earth as observed from the Moon, governing the visible fraction of illuminated lunar disc.
_Avoid_: Moon angle, sun-moon tilt

**Illuminated Fraction**:
The proportion of the Moon's visible disc illuminated by direct sunlight, ranging from 0.00 (New Moon) to 1.00 (Full Moon).
_Avoid_: Moon percentage, lunar brightness

### Horological Structure

**Chronometer Dial**:
The primary high-precision timekeeping face displaying synchronized UTC, Local Apparent Solar, and Sidereal hands.
_Avoid_: Clock face, watch face

**Complication**:
Any horological display or mechanism indicating astronomical telemetry beyond the standard hours, minutes, and seconds.
_Avoid_: Widget, add-on, feature card
