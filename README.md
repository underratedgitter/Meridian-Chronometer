# Meridian Chronometer

> **A luxury astronomical chronometer & aerospace solar observatory.**  
> *Where A. Lange & Söhne horological craft meets NASA Jet Propulsion Laboratory celestial mechanics.*

---

## Overview

**Meridian Chronometer** is a high-precision, zero-runtime-dependency astronomical instrument and interactive world solar observatory. Built with modern ES modules, HTML5 Canvas 2D, and mathematical models derived from the International Astronomical Union (IAU), the U.S. Naval Observatory, and Jean Meeus' *Astronomical Algorithms*.

---

## Aesthetic & Design Philosophy

- **Haute Horlogerie × Aerospace Observatory**: Deep obsidian (`#090a0f`) and brushed titanium (`#12151c`) dials framed with hairline platinum borders and warm meridian gold accents (`#c8aa6e`).
- **Mathematical Typographic Rigor**: Tabular monospaced numerals with `font-feature-settings: "tnum"` eliminate jitter across sub-millisecond continuous hands and countdown timers.
- **60 FPS Fluid Mechanical Motion**: Micro-interpolated sweeping hands with counterweights, open Breguet balances, and central synthetic ruby jewel bearing caps.

---

## Core Features

### 1. Main Chronometer Dial
- **Triple Meridian Sweeping Hands**:
  - **UTC (Coordinated Universal Time)**: Faceted rhodium/platinum hand with open Breguet balance.
  - **Local Apparent Solar Time**: Flared warm meridian gold hand with radiating solar disc counterweight indicating true sundial time.
  - **Sidereal Time (LMST & GMST)**: Flame-blued steel azure needle tracking Earth's rotation against the vernal equinox and distant fixed stars.
  - **Continuous Sweeping Seconds**: Terracotta second hand gliding at 60fps.
- **Acoustic Escapement Synthesis**: Web Audio API physical simulation of a Swiss anchor escapement (pallet jewels striking the escape wheel teeth).

### 2. World Solar Observatory
- **Real-Time Equirectangular Map**: Global vector continental geometries with graticule grid (Equator, Prime Meridian, Tropics of Cancer & Capricorn, Arctic & Antarctic circles).
- **Multi-Band Twilight Bands**:
  - **Golden Hour** ($0^\circ$ to $+6^\circ$)
  - **Civil Twilight** ($0^\circ$ to $-6^\circ$)
  - **Nautical Twilight** ($-6^\circ$ to $-12^\circ$)
  - **Astronomical Twilight** ($-12^\circ$ to $-18^\circ$)
  - **Full Night Shadow** ($< -18^\circ$)
- **Subsolar Zenith Reticle**: Live computation of the exact point on Earth where the Sun is directly overhead at $90^\circ$ altitude, alongside the antipodal nadir point.
- **Interactive Observer Positioning**: Click or drag anywhere on Earth to relocate the observer crosshair and recalculate local ephemeris instantaneously, or select from world-class observatories (Greenwich, Mauna Kea, Paranal, La Palma, Tokyo, Siding Spring, South Africa, JPL).

### 3. Lunar Complication
- **Physically Accurate Spherical Terminator**: Computes the Moon's phase angle and elongation to project the 3D lunar terminator ellipse onto the disc.
- **Surface Maria Shading**: Vectorized representation of major lunar basins (*Mare Imbrium*, *Oceanus Procellarum*, *Mare Serenitatis*, *Mare Tranquillitatis*).
- **Precision Complication Readouts**: Exact illumination percentage (e.g. `98.4%`), lunar age in days (out of $29.5306$ days synodic month), phase classification, and live countdowns to next Full Moon and New Moon.

### 4. Celestial Telemetry Deck
- **Solar Meridian Transit**: Exact solar noon UTC time, maximum transit altitude angle, and current solar declination.
- **Horizon Solar Cycle**: Accurate sunrise, sunset, and daylight duration.
- **Equation of Time (EoT)**: Real-time difference in minutes and seconds between apparent sundial time and mean uniform clock time.
- **Dynamic 365-Day Analemma Visualizer**: Live figure-eight analemma curve showing the observer's position across the yearly cycle.

### 5. Interactive Time Scrubber
- **Master Temporal Console**:
  - Bi-directional scrubbing timeline slider with continuous 60fps rendering.
  - Playback acceleration multipliers: **1x (Realtime)**, **60x (1 min/sec)**, **3,600x (1 hr/sec)**, **86,400x (1 day/sec)**.
  - Forward (▶▶) and Reverse (◀◀) playback.
  - Step buttons ($\pm 1\text{h}$, $\pm 1\text{d}$).
  - Realtime Sync latch button with active status pulse indicator.
  - Epoch Presets: Summer & Winter Solstices, Vernal & Autumnal Equinoxes, Great American Eclipse 2024, Apollo 11 Lunar Landing 1969.
  - Direct ISO DateTime selector.

---

## Engineering & Architecture

- **Zero External Runtime Dependencies**: Vanilla ES modules (`type: module`), HTML5 Canvas 2D, and native SVG.
- **Native Test Runner**: Complete unit test suite using Node.js built-in test runner (`node:test` and `node:assert/strict`).

### Directory Layout

```
meridian-chronometer/
├── index.html                  # Master observatory interface
├── package.json                # Project manifest & scripts
├── server.js                   # Lightweight zero-dependency HTTP server
├── CONTEXT.md                  # Strict astronomical & horological domain model
├── AGENTS.md                   # Engineering rules & coordinate conventions
├── README.md                   # System documentation
├── src/
│   ├── index.js                # Master application orchestrator & 60fps loop
│   ├── engine/
│   │   ├── astronomy.js        # Core astronomical math engine (Julian date, GMST, solar/lunar ephemeris)
│   │   ├── time-controller.js  # Realtime & accelerated simulation state manager
│   │   └── world-geometry.js   # Continental vector outlines, observatories & epochs
│   ├── ui/
│   │   ├── chronometer-dial.js # Triple-ring 24h Swiss horology dial
│   │   ├── world-observatory.js# Interactive world solar map & twilight bands
│   │   ├── lunar-complication.js# Spherical 3D lunar complication
│   │   ├── telemetry-display.js# Ephemeris telemetry & analemma visualizer
│   │   ├── time-scrubber.js    # Tactile slider & speed multipliers
│   │   └── audio-escapement.js # Web Audio API mechanical escapement synthesis
│   └── styles/
│       └── chronometer.css     # Bespoke luxury horology & aerospace design system
└── test/
    ├── astronomy.test.js       # Unit tests verifying astronomical math against reference epochs
    ├── time-controller.test.js # Unit tests verifying time simulation & acceleration
    └── geometry.test.js        # Unit tests verifying world coordinates & continental polygons
```

---

## Getting Started

### 1. Run Test Suite
```bash
npm test
```
All 28 tests validate calculations across reference epochs (J2000.0, IAU GMST standards, equinoxes, solstices, known Full/New moons) in $< 150\text{ ms}$.

### 2. Launch Observatory
```bash
npm start
```
Open [http://localhost:8085](http://localhost:8085) in any modern web browser.
