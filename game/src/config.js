// Kestrel Valley Air Rally — the numbers everything else shares: world layout, flight
// tuning and the palette. One place to tune the game; no logic lives here.

/** Fixed simulation step, seconds. The world advances in these and nothing else. */
export const STEP = 1 / 60;

/** The valley the game is set in: metres across (x east, z south), and its floor. */
export const WORLD = {
  halfSize: 3200,
  waterLevel: 5,
  fieldLevel: 10,
};

/** The home strip: a grass-and-asphalt runway on the centreline x = 0, pointing north. */
export const RUNWAY = {
  x: 0,
  zNear: 450, // south threshold — a northbound landing touches down from here
  zFar: -450, // north end
  width: 30,
  length: 900,
};

/** Flight-model tuning for the Kestrel K-1 bush plane. Speeds in m/s. */
export const PLANE = {
  maxThrustAccel: 13.5,
  idleDrag: 0.55,
  stallSpeed: 25,
  stallSpeedFlaps: 19.5,
  rotateSpeed: 27,
  cruiseSpeed: 55,
  maxSpeed: 92,
  pitchRate: 0.95, // rad/s of elevator authority at cruise
  rollRate: 1.9, // rad/s of aileron authority
  rudderRate: 0.35,
  gearHeight: 1.15, // fuselage origin height above ground when sitting on the gear
  fuelCapacity: 100,
  fuelBurn: 0.145, // per second at full throttle, scaled by throttle
};

/** Sortie scoring. */
export const SCORE = {
  ring: 150,
  ringTimeBonusMax: 250,
  dropMax: 300,
  landingPerfect: 400,
  landingGood: 250,
  landingFirm: 100,
  damagePerPoint: 2,
};

/** The house palette: one warm late-afternoon style for sky, land and paint. */
export const COLORS = {
  skyTop: [86, 138, 196],
  skyHorizon: [196, 220, 238],
  fog: [198, 219, 236],
  sun: [255, 240, 205],
  water: [52, 106, 148],
  sand: [196, 178, 132],
  grassLight: [116, 168, 84],
  grassDark: [74, 128, 62],
  fieldTan: [188, 168, 102],
  fieldPlough: [140, 108, 74],
  rock: [128, 122, 116],
  snow: [238, 242, 246],
  tree: [52, 104, 52],
  treeTrunk: [96, 74, 52],
  asphalt: [62, 64, 68],
  marking: [232, 232, 226],
  planeCream: [238, 230, 214],
  planeRed: [178, 44, 38],
  planeDark: [38, 44, 52],
  canopy: [38, 74, 108],
  ring: [255, 176, 32],
  ringDone: [96, 200, 110],
  dropZone: [255, 92, 72],
};

export const BEST_KEY = 'kestrel-valley-best';
