/**
 * Celestial body catalogue.
 * Scientific values: NASA Planetary Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet),
 * NASA Science solar-system pages, JPL "Approximate Positions of the Planets" (mean longitudes).
 * Visual values (radius/orbit/spin) are artistic and only used for composition.
 */

export type BodyKind = 'star' | 'terrestrial' | 'gas' | 'ice' | 'dwarf' | 'moon';

export interface Gas {
  gas: string;
  pct?: number;
}

export interface Feature {
  name: string;
  text: string;
  lat?: number;
  lon?: number;
  /** marker on the ring plane, in planet radii */
  ring?: number;
}

export interface AtmoVisual {
  color: string;
  sunset: string;
  thickness: number; // shell thickness in radii
  strength: number;
  falloff: number;
  rim: number; // in-disk fresnel rim strength
}

export interface BodyVisual {
  radius: number; // visual-mode radius (scene units)
  orbit: number; // visual orbit radius (planets: around Sun, moons: around parent)
  angle0: number; // initial orbital angle (radians)
  spin: number; // rad/s (sign = direction)
  tilt: number; // axial tilt, degrees
  bake: string; // texture recipe
  bump: number;
  gas?: boolean;
  flow?: number;
  spec?: number;
  night?: number;
  clouds?: boolean;
  atmo?: AtmoVisual;
  rings?: 'saturn' | 'uranus';
  accent: string; // UI accent
  css: string; // CSS gradient used for fallbacks / placeholders
  moonStyle?: number;
  moonA?: string;
  moonB?: string;
}

export interface BodyData {
  diameterKm: number;
  distanceMkm?: number; // from Sun (or parent for moons) in million km
  distanceKm?: number; // for moons, km from parent
  au?: number;
  orbitalPeriodDays?: number;
  rotationHours?: number; // negative = retrograde
  meanTempC?: number;
  moons?: number;
  gravity?: number;
  axialTilt?: number;
  massE24?: number;
  escapeKms?: number;
  atmosphere: Gas[];
  atmosphereNote: string;
}

export interface BodyDef {
  id: string;
  name: string;
  kind: BodyKind;
  typeLabel: string;
  parent?: string;
  eyebrow: string;
  tagline: string;
  description: string;
  data: BodyData;
  facts: string[];
  features: Feature[];
  visual: BodyVisual;
  /** True relative size, in Earth radii */
  radiusEarth: number;
  /** Orbital elements for Orbital mode (circular approximation) */
  orbitEl?: { au: number; L0: number; Ldot: number };
  minor?: boolean;
}

const deg = Math.PI / 180;

export const BODIES: BodyDef[] = [
  {
    id: 'sun',
    name: 'Sun',
    kind: 'star',
    typeLabel: 'G-type main-sequence star',
    eyebrow: 'The Star',
    tagline: 'The engine of every world.',
    description:
      'A 4.6-billion-year-old sphere of hot plasma whose gravity binds the Solar System together. Nuclear fusion in its core converts about 600 million tonnes of hydrogen into helium every second.',
    data: {
      diameterKm: 1392700,
      rotationHours: 609.1,
      meanTempC: 5500,
      gravity: 274,
      axialTilt: 7.25,
      massE24: 1989000,
      escapeKms: 617.7,
      atmosphere: [
        { gas: 'Hydrogen', pct: 73.5 },
        { gas: 'Helium', pct: 24.9 },
        { gas: 'Heavier elements', pct: 1.6 },
      ],
      atmosphereNote: 'Composition by mass of the photosphere.',
    },
    facts: [
      'The Sun holds about 99.8% of all the mass in the Solar System.',
      'Sunlight takes about 8 minutes and 20 seconds to reach Earth.',
      'Its core reaches roughly 15 million °C, while the visible surface is about 5,500 °C.',
      'The Sun orbits the centre of the Milky Way once every ~230 million years.',
    ],
    features: [],
    visual: {
      radius: 9,
      orbit: 0,
      angle0: 0,
      spin: 0.012,
      tilt: 7.25,
      bake: 'sun',
      bump: 0,
      accent: '#ffb347',
      css: 'radial-gradient(circle at 40% 38%, #fff6d8 0%, #ffd27a 22%, #ff9a2e 52%, #d2470f 78%, #5a1300 100%)',
    },
    radiusEarth: 109.1,
  },
  {
    id: 'mercury',
    name: 'Mercury',
    kind: 'terrestrial',
    typeLabel: 'Terrestrial planet',
    eyebrow: '01 · Inner System',
    tagline: 'A scorched world of iron and shadow.',
    description:
      'The smallest planet and the closest to the Sun. Mercury’s ancient, crater-scarred crust hides an enormous iron core that makes up about 85% of its radius.',
    data: {
      diameterKm: 4879,
      distanceMkm: 57.9,
      au: 0.387,
      orbitalPeriodDays: 88.0,
      rotationHours: 1407.6,
      meanTempC: 167,
      moons: 0,
      gravity: 3.7,
      axialTilt: 0.034,
      massE24: 0.33,
      escapeKms: 4.3,
      atmosphere: [{ gas: 'O₂' }, { gas: 'Na' }, { gas: 'H₂' }, { gas: 'He' }, { gas: 'K' }],
      atmosphereNote: 'A tenuous exosphere of atoms blasted from the surface — not a true atmosphere.',
    },
    facts: [
      'A year on Mercury (88 days) is shorter than one of its solar days (176 Earth days).',
      'Surface temperatures swing from about 430 °C by day to −180 °C at night.',
      'Despite being closest to the Sun, it is not the hottest planet — Venus is.',
      'The Caloris Basin, an ancient impact scar, is about 1,550 km across.',
    ],
    features: [
      { name: 'Caloris Basin', lat: 31.5, lon: 162.7, text: 'One of the largest impact basins in the Solar System, ~1,550 km wide.' },
      { name: 'Cratered highlands', lat: -35, lon: -40, text: 'Some of the oldest surfaces in the Solar System, saturated with impacts.' },
    ],
    visual: {
      radius: 0.55,
      orbit: 22,
      angle0: 0.25,
      spin: 0.012,
      tilt: 0.03,
      bake: 'mercury',
      bump: 0.018,
      accent: '#b9b2a8',
      css: 'radial-gradient(circle at 35% 35%, #d8d2c8 0%, #9a948c 40%, #57524c 75%, #1e1c1a 100%)',
    },
    radiusEarth: 0.383,
    orbitEl: { au: 0.387, L0: 252.2503235, Ldot: 149472.67411175 },
  },
  {
    id: 'venus',
    name: 'Venus',
    kind: 'terrestrial',
    typeLabel: 'Terrestrial planet',
    eyebrow: '02 · Inner System',
    tagline: 'Veiled in golden, crushing clouds.',
    description:
      'Earth’s near-twin in size, transformed by a runaway greenhouse effect. Beneath clouds of sulfuric acid lies a volcanic surface hot enough to melt lead.',
    data: {
      diameterKm: 12104,
      distanceMkm: 108.2,
      au: 0.723,
      orbitalPeriodDays: 224.7,
      rotationHours: -5832.5,
      meanTempC: 464,
      moons: 0,
      gravity: 8.9,
      axialTilt: 177.4,
      massE24: 4.87,
      escapeKms: 10.4,
      atmosphere: [
        { gas: 'Carbon dioxide', pct: 96.5 },
        { gas: 'Nitrogen', pct: 3.5 },
      ],
      atmosphereNote: 'Surface pressure is about 92 times that of Earth.',
    },
    facts: [
      'Venus spins backwards, and its day (243 Earth days) is longer than its year.',
      'Surface pressure is about 92 times Earth’s — like being 900 m under the ocean.',
      'It is the hottest planet, averaging 464 °C day and night.',
      'Its upper clouds race around the planet in about four Earth days.',
    ],
    features: [
      { name: 'Maxwell Montes', lat: 65.2, lon: 3.3, text: 'The highest mountains on Venus (~11 km), hidden beneath the cloud deck.' },
      { name: 'Super-rotating clouds', lat: -10, lon: 120, text: 'Upper winds of ~360 km/h circle the planet 60× faster than it rotates.' },
    ],
    visual: {
      radius: 0.95,
      orbit: 32,
      angle0: 0.67,
      spin: -0.006,
      tilt: 177.4,
      bake: 'venus',
      bump: 0.004,
      gas: true,
      flow: 1.2,
      atmo: { color: '#ffd38a', sunset: '#ff9a4a', thickness: 0.09, strength: 1.4, falloff: 3.0, rim: 1.0 },
      accent: '#f2c46d',
      css: 'radial-gradient(circle at 35% 35%, #fff1c9 0%, #f0cf86 35%, #c99449 70%, #5e3a12 100%)',
    },
    radiusEarth: 0.949,
    orbitEl: { au: 0.723, L0: 181.9790995, Ldot: 58517.81538729 },
  },
  {
    id: 'earth',
    name: 'Earth',
    kind: 'terrestrial',
    typeLabel: 'Terrestrial planet',
    eyebrow: '03 · Home',
    tagline: 'The pale blue dot. Our only home.',
    description:
      'The only world known to harbour life. Liquid oceans, a protective magnetic field and a nitrogen-oxygen atmosphere make Earth unique among the planets.',
    data: {
      diameterKm: 12756,
      distanceMkm: 149.6,
      au: 1,
      orbitalPeriodDays: 365.2,
      rotationHours: 23.9,
      meanTempC: 15,
      moons: 1,
      gravity: 9.8,
      axialTilt: 23.4,
      massE24: 5.97,
      escapeKms: 11.2,
      atmosphere: [
        { gas: 'Nitrogen', pct: 78.1 },
        { gas: 'Oxygen', pct: 20.9 },
        { gas: 'Argon', pct: 0.93 },
        { gas: 'Carbon dioxide', pct: 0.04 },
      ],
      atmosphereNote: 'Dry air by volume; water vapour varies from 0–4%.',
    },
    facts: [
      'Earth is the only known world with stable liquid water on its surface.',
      'About 71% of the surface is covered by oceans.',
      'Earth is the densest planet in the Solar System.',
      'Its magnetic field deflects the solar wind, creating the auroras.',
    ],
    features: [
      { name: 'Himalayas', lat: 28.5, lon: 85, text: 'Home of Mount Everest, 8,849 m — the highest point above sea level.' },
      { name: 'Sahara Desert', lat: 23, lon: 13, text: 'The largest hot desert, roughly the size of the United States.' },
      { name: 'Amazon Rainforest', lat: -4, lon: -62, text: 'The largest tropical rainforest, spanning ~5.5 million km².' },
    ],
    visual: {
      radius: 1,
      orbit: 44,
      angle0: 1.09,
      spin: 0.05,
      tilt: 23.4,
      bake: 'earth',
      bump: 0.012,
      spec: 1,
      night: 1,
      clouds: true,
      atmo: { color: '#4f9dff', sunset: '#ff8a4a', thickness: 0.06, strength: 1.6, falloff: 3.4, rim: 1.4 },
      accent: '#5fb4ff',
      css: 'radial-gradient(circle at 35% 35%, #d8f0ff 0%, #4f9de0 25%, #1f5f9e 55%, #0b2346 85%, #030a17 100%)',
    },
    radiusEarth: 1,
    orbitEl: { au: 1.0, L0: 100.46457166, Ldot: 35999.37244981 },
  },
  {
    id: 'moon',
    name: 'The Moon',
    kind: 'moon',
    typeLabel: 'Natural satellite of Earth',
    parent: 'earth',
    eyebrow: 'Earth I · Companion',
    tagline: 'Our silent, cratered companion.',
    description:
      'Earth’s only natural satellite stabilises our planet’s tilt and drives the tides. Its dark maria are vast plains of ancient lava; its bright highlands are scarred by billions of years of impacts.',
    data: {
      diameterKm: 3475,
      distanceKm: 384400,
      orbitalPeriodDays: 27.3,
      rotationHours: 655.7,
      meanTempC: -20,
      gravity: 1.6,
      axialTilt: 6.7,
      massE24: 0.073,
      escapeKms: 2.4,
      atmosphere: [{ gas: 'He' }, { gas: 'Ar' }, { gas: 'Ne' }],
      atmosphereNote: 'An exosphere so thin that it is effectively a vacuum.',
    },
    facts: [
      'The Moon drifts about 3.8 cm farther from Earth every year.',
      'It is tidally locked: the same face always points toward Earth.',
      'Twelve astronauts walked on its surface between 1969 and 1972.',
      'It likely formed from debris after a Mars-sized body struck the young Earth.',
    ],
    features: [
      { name: 'Mare Tranquillitatis', lat: 8.5, lon: 31.4, text: 'The Sea of Tranquility — Apollo 11 landed near its edge in 1969.' },
      { name: 'Tycho', lat: -43.3, lon: -11.2, text: 'A young 85 km crater whose bright rays stretch across the near side.' },
      { name: 'Oceanus Procellarum', lat: 18.4, lon: -57.4, text: 'The Ocean of Storms, the largest of the lunar maria.' },
    ],
    visual: {
      radius: 0.27,
      orbit: 3.2,
      angle0: 2.2,
      spin: 0,
      tilt: 6.7,
      bake: 'moon',
      bump: 0.02,
      accent: '#d4d0c8',
      css: 'radial-gradient(circle at 35% 35%, #f2f0ea 0%, #b9b5ad 40%, #6d6a64 75%, #22211f 100%)',
    },
    radiusEarth: 0.273,
  },
  {
    id: 'mars',
    name: 'Mars',
    kind: 'terrestrial',
    typeLabel: 'Terrestrial planet',
    eyebrow: '04 · Inner System',
    tagline: 'A rust-red desert of giants.',
    description:
      'A cold desert world with the tallest volcano and deepest canyon system in the Solar System. Ancient riverbeds suggest Mars was once warmer and wetter.',
    data: {
      diameterKm: 6792,
      distanceMkm: 228.0,
      au: 1.524,
      orbitalPeriodDays: 687.0,
      rotationHours: 24.6,
      meanTempC: -65,
      moons: 2,
      gravity: 3.7,
      axialTilt: 25.2,
      massE24: 0.642,
      escapeKms: 5.0,
      atmosphere: [
        { gas: 'Carbon dioxide', pct: 95 },
        { gas: 'Nitrogen', pct: 2.8 },
        { gas: 'Argon', pct: 2 },
      ],
      atmosphereNote: 'Surface pressure is less than 1% of Earth’s.',
    },
    facts: [
      'Olympus Mons is roughly 22 km tall — about two and a half times Mount Everest.',
      'Valles Marineris stretches about 4,000 km, as long as the continental United States.',
      'Its red colour comes from iron oxide — rust — in its dust.',
      'With a 25° tilt, Mars has seasons much like Earth’s, but twice as long.',
    ],
    features: [
      { name: 'Olympus Mons', lat: 18.65, lon: -133.8, text: 'The largest known volcano in the Solar System, ~600 km wide.' },
      { name: 'Valles Marineris', lat: -14, lon: -65, text: 'A canyon system up to 7 km deep and ~4,000 km long.' },
      { name: 'Hellas Planitia', lat: -42.4, lon: 70.5, text: 'A 2,300 km impact basin, the lowest point on Mars.' },
      { name: 'North polar cap', lat: 84, lon: 0, text: 'Layers of water ice capped by seasonal carbon-dioxide frost.' },
    ],
    visual: {
      radius: 0.7,
      orbit: 56,
      angle0: 1.51,
      spin: 0.048,
      tilt: 25.2,
      bake: 'mars',
      bump: 0.02,
      atmo: { color: '#ff9f6b', sunset: '#7fb2ff', thickness: 0.035, strength: 0.7, falloff: 3.5, rim: 0.6 },
      accent: '#ff7a45',
      css: 'radial-gradient(circle at 35% 35%, #ffc7a0 0%, #d8693a 35%, #8f2f15 70%, #2a0a03 100%)',
    },
    radiusEarth: 0.532,
    orbitEl: { au: 1.524, L0: -4.55343205, Ldot: 19140.30268499 },
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    kind: 'gas',
    typeLabel: 'Gas giant',
    eyebrow: '05 · Outer System',
    tagline: 'King of storms. Titan of the planets.',
    description:
      'More than twice as massive as all the other planets combined. Jupiter’s banded clouds of ammonia and water ride jet streams, and its Great Red Spot is a storm wider than Earth.',
    data: {
      diameterKm: 142984,
      distanceMkm: 778.5,
      au: 5.203,
      orbitalPeriodDays: 4331,
      rotationHours: 9.9,
      meanTempC: -110,
      moons: 95,
      gravity: 23.1,
      axialTilt: 3.1,
      massE24: 1898,
      escapeKms: 59.5,
      atmosphere: [
        { gas: 'Hydrogen', pct: 89.8 },
        { gas: 'Helium', pct: 10.2 },
      ],
      atmosphereNote: 'Trace methane, ammonia, water vapour and hydrogen deuteride.',
    },
    facts: [
      'Jupiter is more than twice as massive as all other planets combined.',
      'The Great Red Spot is a storm larger than Earth, observed for at least 190 years.',
      'It has the shortest day of any planet: under 10 hours.',
      'Its moon Ganymede is the largest moon in the Solar System — bigger than Mercury.',
    ],
    features: [
      { name: 'Great Red Spot', lat: -22, lon: 0, text: 'An anticyclonic storm ~1.3 Earth diameters wide, with winds over 400 km/h.' },
      { name: 'Oval BA', lat: -33, lon: 70, text: '“Red Spot Junior”, formed from merging white ovals in 2000.' },
      { name: 'Equatorial Zone', lat: 2, lon: -110, text: 'A bright band of rising ammonia clouds.' },
    ],
    visual: {
      radius: 4.2,
      orbit: 80,
      angle0: 1.93,
      spin: 0.11,
      tilt: 3.1,
      bake: 'jupiter',
      bump: 0.003,
      gas: true,
      flow: 1,
      atmo: { color: '#f3dcb8', sunset: '#d8a070', thickness: 0.03, strength: 0.55, falloff: 3.0, rim: 0.5 },
      accent: '#e8b98a',
      css: 'repeating-linear-gradient(178deg, #e8d7bd 0 6%, #c68e5e 6% 10%, #ead9c0 10% 15%, #9d6a45 15% 19%, #e2cfb3 19% 26%), radial-gradient(circle, #e0c9a6, #6a4428)',
    },
    radiusEarth: 11.21,
    orbitEl: { au: 5.203, L0: 34.39644051, Ldot: 3034.74612775 },
  },
  {
    id: 'saturn',
    name: 'Saturn',
    kind: 'gas',
    typeLabel: 'Gas giant',
    eyebrow: '06 · Outer System',
    tagline: 'The jewel of the Solar System.',
    description:
      'A golden gas giant crowned by the most spectacular ring system known. The rings are made of countless pieces of water ice, from dust grains to house-sized boulders.',
    data: {
      diameterKm: 120536,
      distanceMkm: 1432.0,
      au: 9.537,
      orbitalPeriodDays: 10747,
      rotationHours: 10.7,
      meanTempC: -140,
      moons: 274,
      gravity: 9.0,
      axialTilt: 26.7,
      massE24: 568,
      escapeKms: 35.5,
      atmosphere: [
        { gas: 'Hydrogen', pct: 96.3 },
        { gas: 'Helium', pct: 3.25 },
      ],
      atmosphereNote: 'Trace methane, ammonia and hydrogen deuteride.',
    },
    facts: [
      'The main rings extend up to 282,000 km from the planet, yet are typically only about 10 m thick.',
      'Saturn’s average density is lower than that of water.',
      'A persistent six-sided jet stream circles its north pole.',
      'The rings are more than 99% water ice.',
    ],
    features: [
      { name: 'North polar hexagon', lat: 78, lon: 30, text: 'A six-sided jet stream about 29,000 km across.' },
      { name: 'Cassini Division', ring: 1.99, text: 'A 4,800 km gap between the A and B rings, cleared by resonance with the moon Mimas.' },
      { name: 'B Ring', ring: 1.75, text: 'The brightest, most massive ring — up to several metres thick.' },
    ],
    visual: {
      radius: 3.6,
      orbit: 112,
      angle0: 2.35,
      spin: 0.1,
      tilt: 26.7,
      bake: 'saturn',
      bump: 0.002,
      gas: true,
      flow: 0.7,
      rings: 'saturn',
      atmo: { color: '#f5e1b0', sunset: '#e0b070', thickness: 0.03, strength: 0.5, falloff: 3.0, rim: 0.45 },
      accent: '#f0d08a',
      css: 'repeating-linear-gradient(178deg, #efdcae 0 7%, #d4b47a 7% 11%, #e9d4a2 11% 18%, #c6a165 18% 22%), radial-gradient(circle, #e8d09a, #6b5126)',
    },
    radiusEarth: 9.45,
    orbitEl: { au: 9.537, L0: 49.95424423, Ldot: 1222.49362201 },
  },
  {
    id: 'uranus',
    name: 'Uranus',
    kind: 'ice',
    typeLabel: 'Ice giant',
    eyebrow: '07 · Outer System',
    tagline: 'The sideways world.',
    description:
      'An ice giant that rolls around the Sun on its side. Methane in its upper atmosphere absorbs red light, giving Uranus its serene, pale-cyan glow.',
    data: {
      diameterKm: 51118,
      distanceMkm: 2867.0,
      au: 19.19,
      orbitalPeriodDays: 30589,
      rotationHours: -17.2,
      meanTempC: -195,
      moons: 29,
      gravity: 8.7,
      axialTilt: 97.8,
      massE24: 86.8,
      escapeKms: 21.3,
      atmosphere: [
        { gas: 'Hydrogen', pct: 82.5 },
        { gas: 'Helium', pct: 15.2 },
        { gas: 'Methane', pct: 2.3 },
      ],
      atmosphereNote: 'Above a deep mantle of water, ammonia and methane ices.',
    },
    facts: [
      'Uranus is tilted about 98°, so it essentially orbits on its side.',
      'Each pole gets around 42 years of continuous sunlight, then 42 years of darkness.',
      'It has the coldest planetary atmosphere, reaching −224 °C.',
      'It was the first planet discovered with a telescope — by William Herschel in 1781.',
    ],
    features: [
      { name: 'Ring system', ring: 2.0, text: '13 known narrow, dark rings — the ε ring is the brightest.' },
      { name: 'Polar haze', lat: 72, lon: 0, text: 'A brightened polar cap of methane haze that changes with the seasons.' },
    ],
    visual: {
      radius: 2.0,
      orbit: 140,
      angle0: 2.77,
      spin: -0.07,
      tilt: 97.8,
      bake: 'uranus',
      bump: 0.001,
      gas: true,
      flow: 0.4,
      rings: 'uranus',
      atmo: { color: '#9ff3ff', sunset: '#d0ffff', thickness: 0.05, strength: 1.0, falloff: 2.6, rim: 0.9 },
      accent: '#8de6ef',
      css: 'radial-gradient(circle at 35% 35%, #e9feff 0%, #a9e6ec 35%, #5fb2bf 70%, #13434c 100%)',
    },
    radiusEarth: 4.01,
    orbitEl: { au: 19.19, L0: 313.23810451, Ldot: 428.48202785 },
  },
  {
    id: 'neptune',
    name: 'Neptune',
    kind: 'ice',
    typeLabel: 'Ice giant',
    eyebrow: '08 · Outer System',
    tagline: 'Dark, cold and whipped by supersonic winds.',
    description:
      'The most distant planet, a deep-blue ice giant with the fastest winds in the Solar System. It was found by mathematics before it was ever seen through a telescope.',
    data: {
      diameterKm: 49528,
      distanceMkm: 4515.0,
      au: 30.07,
      orbitalPeriodDays: 59800,
      rotationHours: 16.1,
      meanTempC: -200,
      moons: 16,
      gravity: 11.0,
      axialTilt: 28.3,
      massE24: 102,
      escapeKms: 23.5,
      atmosphere: [
        { gas: 'Hydrogen', pct: 80 },
        { gas: 'Helium', pct: 19 },
        { gas: 'Methane', pct: 1.5 },
      ],
      atmosphereNote: 'Methane and an unknown absorber give Neptune its deeper blue.',
    },
    facts: [
      'Neptune’s winds exceed 2,000 km/h — the fastest in the Solar System.',
      'Its position was predicted mathematically before it was observed in 1846.',
      'It completed its first full orbit since discovery in 2011.',
      'Its largest moon, Triton, orbits backwards and may be a captured Kuiper Belt object.',
    ],
    features: [
      { name: 'Great Dark Spot', lat: -20, lon: 0, text: 'An Earth-sized storm imaged by Voyager 2 in 1989; it had vanished by 1994.' },
      { name: '“Scooter”', lat: -42, lon: 70, text: 'A fast-moving bright cloud feature seen circling the planet by Voyager 2.' },
    ],
    visual: {
      radius: 1.95,
      orbit: 164,
      angle0: 3.19,
      spin: 0.075,
      tilt: 28.3,
      bake: 'neptune',
      bump: 0.001,
      gas: true,
      flow: 0.8,
      atmo: { color: '#5b8cff', sunset: '#9fc0ff', thickness: 0.05, strength: 1.1, falloff: 2.6, rim: 1.0 },
      accent: '#5b8cff',
      css: 'radial-gradient(circle at 35% 35%, #c9dcff 0%, #4f7ff0 35%, #1f3c9c 70%, #060f33 100%)',
    },
    radiusEarth: 3.88,
    orbitEl: { au: 30.07, L0: -55.12002969, Ldot: 218.45945325 },
  },
  {
    id: 'pluto',
    name: 'Pluto',
    kind: 'dwarf',
    typeLabel: 'Dwarf planet · Kuiper Belt',
    eyebrow: '09 · Beyond',
    tagline: 'A frozen heart at the edge of the light.',
    description:
      'A dwarf planet in the Kuiper Belt, revealed by NASA’s New Horizons in 2015 as a surprisingly active world of nitrogen glaciers, water-ice mountains and blue hazes.',
    data: {
      diameterKm: 2376,
      distanceMkm: 5906.4,
      au: 39.48,
      orbitalPeriodDays: 90560,
      rotationHours: -153.3,
      meanTempC: -225,
      moons: 5,
      gravity: 0.7,
      axialTilt: 122.5,
      massE24: 0.013,
      escapeKms: 1.3,
      atmosphere: [{ gas: 'Nitrogen' }, { gas: 'Methane' }, { gas: 'Carbon monoxide' }],
      atmosphereNote: 'A thin atmosphere that partly freezes onto the surface as Pluto moves away from the Sun.',
    },
    facts: [
      'Pluto was reclassified as a dwarf planet by the IAU in 2006.',
      'Its heart-shaped Tombaugh Regio was revealed by New Horizons in 2015.',
      'Hazes in its atmosphere scatter sunlight blue.',
      'Charon is so large that Pluto and Charon orbit a point in space between them.',
    ],
    features: [
      { name: 'Tombaugh Regio', lat: 25, lon: 175, text: 'The bright “heart”, partly a basin of frozen nitrogen ice called Sputnik Planitia.' },
      { name: 'Cthulhu Macula', lat: -10, lon: 95, text: 'A dark, reddish region coloured by complex organic molecules (tholins).' },
    ],
    visual: {
      radius: 0.3,
      orbit: 186,
      angle0: 3.61,
      spin: -0.06,
      tilt: 122.5,
      bake: 'pluto',
      bump: 0.012,
      atmo: { color: '#8fb6ff', sunset: '#b8d0ff', thickness: 0.05, strength: 0.35, falloff: 3.0, rim: 0.3 },
      accent: '#d9b38c',
      css: 'radial-gradient(circle at 35% 35%, #f7e9d6 0%, #cfa57c 40%, #7a4a2c 75%, #1f0f07 100%)',
    },
    radiusEarth: 0.186,
    orbitEl: { au: 39.48, L0: 238.92903833, Ldot: 145.20780515 },
  },
];

/* ---------- Notable moons (compact data) ---------- */

interface MinorSpec {
  id: string;
  name: string;
  parent: string;
  diameterKm: number;
  distanceKm: number;
  periodDays: number;
  fact: string;
  tagline: string;
  radius: number;
  orbit: number;
  style: number;
  a: string;
  b: string;
  atmo?: AtmoVisual;
}

const MINOR: MinorSpec[] = [
  { id: 'phobos', name: 'Phobos', parent: 'mars', diameterKm: 22.5, distanceKm: 9376, periodDays: 0.319, radius: 0.07, orbit: 1.5, style: 0, a: '#7d7266', b: '#4a443d', tagline: 'A doomed, potato-shaped moon.', fact: 'Phobos is spiralling inward by about 1.8 m per century and will eventually break apart.' },
  { id: 'deimos', name: 'Deimos', parent: 'mars', diameterKm: 12.4, distanceKm: 23463, periodDays: 1.263, radius: 0.05, orbit: 2.3, style: 0, a: '#8f8476', b: '#5b544b', tagline: 'Mars’ smaller, smoother moon.', fact: 'From Mars, Deimos would look like a bright star rather than a disc.' },
  { id: 'io', name: 'Io', parent: 'jupiter', diameterKm: 3643, distanceKm: 421700, periodDays: 1.769, radius: 0.24, orbit: 6.6, style: 1, a: '#e8d36a', b: '#b86a22', tagline: 'The most volcanic world known.', fact: 'Io has hundreds of active volcanoes, some erupting lava fountains tens of kilometres high.' },
  { id: 'europa', name: 'Europa', parent: 'jupiter', diameterKm: 3122, distanceKm: 671100, periodDays: 3.551, radius: 0.21, orbit: 8.2, style: 2, a: '#e9e0cf', b: '#8e5a3a', tagline: 'An ocean hidden beneath the ice.', fact: 'Europa likely hides a global saltwater ocean with twice the water of Earth’s oceans.' },
  { id: 'ganymede', name: 'Ganymede', parent: 'jupiter', diameterKm: 5268, distanceKm: 1070400, periodDays: 7.155, radius: 0.34, orbit: 10.2, style: 0, a: '#a59a8c', b: '#5d554b', tagline: 'The largest moon in the Solar System.', fact: 'Ganymede is the only moon known to generate its own magnetic field.' },
  { id: 'callisto', name: 'Callisto', parent: 'jupiter', diameterKm: 4821, distanceKm: 1882700, periodDays: 16.689, radius: 0.31, orbit: 12.6, style: 0, a: '#6f6252', b: '#3a3129', tagline: 'An ancient, battered surface.', fact: 'Callisto’s surface is one of the most heavily cratered in the Solar System.' },
  { id: 'titan', name: 'Titan', parent: 'saturn', diameterKm: 5150, distanceKm: 1221870, periodDays: 15.945, radius: 0.33, orbit: 13.5, style: 3, a: '#d9a04e', b: '#a0652a', tagline: 'A hazy world of methane seas.', fact: 'Titan is the only moon with a thick atmosphere and stable surface liquids — lakes of methane and ethane.', atmo: { color: '#f0a94e', sunset: '#ffcc80', thickness: 0.12, strength: 1.3, falloff: 2.2, rim: 1.2 } },
  { id: 'enceladus', name: 'Enceladus', parent: 'saturn', diameterKm: 504, distanceKm: 238000, periodDays: 1.37, radius: 0.1, orbit: 9.6, style: 4, a: '#f4f7fa', b: '#b8c6d2', tagline: 'Geysers of ice from a hidden sea.', fact: 'Plumes of water ice erupt from Enceladus’ south pole, feeding Saturn’s E ring.' },
  { id: 'titania', name: 'Titania', parent: 'uranus', diameterKm: 1577, distanceKm: 435900, periodDays: 8.706, radius: 0.13, orbit: 4.6, style: 0, a: '#a8a39c', b: '#615c56', tagline: 'Largest moon of Uranus.', fact: 'Titania is scarred by enormous fault canyons up to 1,500 km long.' },
  { id: 'triton', name: 'Triton', parent: 'neptune', diameterKm: 2707, distanceKm: 354800, periodDays: 5.877, radius: 0.19, orbit: 4.6, style: 5, a: '#d9c7bb', b: '#9a8277', tagline: 'A captured world orbiting backwards.', fact: 'Triton orbits Neptune backwards and erupts geysers of nitrogen gas.' },
  { id: 'charon', name: 'Charon', parent: 'pluto', diameterKm: 1212, distanceKm: 19600, periodDays: 6.387, radius: 0.15, orbit: 1.15, style: 0, a: '#a7a49f', b: '#6b5047', tagline: 'Pluto’s giant partner.', fact: 'Charon and Pluto are mutually tidally locked, always showing each other the same face.' },
];

for (const m of MINOR) {
  const parent = BODIES.find((b) => b.id === m.parent)!;
  BODIES.push({
    id: m.id,
    name: m.name,
    kind: 'moon',
    typeLabel: `Moon of ${parent.name}`,
    parent: m.parent,
    eyebrow: `${parent.name} system`,
    tagline: m.tagline,
    description: m.fact,
    data: {
      diameterKm: m.diameterKm,
      distanceKm: m.distanceKm,
      orbitalPeriodDays: m.periodDays,
      atmosphere: m.id === 'titan' ? [{ gas: 'Nitrogen', pct: 95 }, { gas: 'Methane', pct: 5 }] : [],
      atmosphereNote: m.id === 'titan' ? 'Surface pressure about 1.5 times Earth’s.' : 'No significant atmosphere.',
    },
    facts: [m.fact],
    features: [],
    visual: {
      radius: m.radius,
      orbit: m.orbit,
      angle0: (m.orbit * 2.39) % (Math.PI * 2),
      spin: 0,
      tilt: 0,
      bake: 'moonlet',
      bump: 0.02,
      moonStyle: m.style,
      moonA: m.a,
      moonB: m.b,
      atmo: m.atmo,
      accent: m.a,
      css: `radial-gradient(circle at 35% 35%, ${m.a} 0%, ${m.b} 70%, #0d0c0b 100%)`,
    },
    radiusEarth: m.diameterKm / 12756,
    minor: true,
  });
}

export const BODY_MAP: Record<string, BodyDef> = Object.fromEntries(BODIES.map((b) => [b.id, b]));

/** Major bodies in heliocentric order (used for menus, map and comparisons) */
export const MAJOR_IDS = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
export const PLANET_IDS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

export const moonsOf = (id: string) => BODIES.filter((b) => b.parent === id);

export const toRad = deg;

/** Simplified lat/lon (degrees) → unit vector, matching three.js SphereGeometry UVs */
export function latLonToVec(lat: number, lon: number): [number, number, number] {
  const u = (lon + 180) / 360;
  const v = (lat + 90) / 180;
  const phi = u * Math.PI * 2;
  const theta = (1 - v) * Math.PI;
  return [-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)];
}
