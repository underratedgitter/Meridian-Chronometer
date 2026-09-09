/**
 * Meridian Chronometer — World Geometry
 * Simplified high-accuracy equirectangular landmass contours for Earth's continents.
 * Zero external dependencies. Designed for fast Canvas 2D / SVG projection.
 * Coordinates are [longitudeDeg, latitudeDeg].
 */

export const PRESET_OBSERVATORIES = [
  { id: 'greenwich', name: 'Royal Observatory Greenwich', lat: 51.4769, lon: 0.0005, country: 'United Kingdom' },
  { id: 'mauna_kea', name: 'Mauna Kea Observatories', lat: 19.8206, lon: -155.4681, country: 'Hawaii, USA' },
  { id: 'paranal', name: 'ESO Paranal Observatory', lat: -24.6272, lon: -70.4042, country: 'Chile (Atacama)' },
  { id: 'roque', name: 'Roque de los Muchachos', lat: 28.7606, lon: -17.8816, country: 'Canary Islands, Spain' },
  { id: 'tokyo', name: 'National Astronomical Observatory', lat: 35.6762, lon: 139.6503, country: 'Japan' },
  { id: 'siding_spring', name: 'Siding Spring Observatory', lat: -31.2756, lon: 149.0700, country: 'Australia' },
  { id: 'south_african', name: 'South African Astronomical Obs', lat: -32.3783, lon: 20.8108, country: 'South Africa' },
  { id: 'jpl', name: 'NASA Jet Propulsion Laboratory', lat: 34.2003, lon: -118.1712, country: 'California, USA' }
];

export const PRESET_EPOCHS = [
  { label: 'Live Realtime', timestamp: null },
  { label: 'Summer Solstice 2024', iso: '2024-06-20T20:51:00Z' },
  { label: 'Winter Solstice 2024', iso: '2024-12-21T09:21:00Z' },
  { label: 'Vernal Equinox 2024', iso: '2024-03-20T03:06:00Z' },
  { label: 'Autumnal Equinox 2024', iso: '2024-09-22T12:44:00Z' },
  { label: 'Great American Eclipse 2024', iso: '2024-04-08T18:18:00Z' },
  { label: 'Apollo 11 Lunar Landing 1969', iso: '1969-07-20T20:17:40Z' }
];

export const MAJOR_CITIES = [
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
export const WORLD_CONTINENTS = [
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
