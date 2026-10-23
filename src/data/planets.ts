import { BODY_MAP, BodyDef } from './bodies';

/**
 * The eight planets as the cinematic experience presents them.
 * Order is by distance from the Sun; "next" walks inward (Mars → Earth → Venus …) and wraps.
 * Figures: NASA Planetary Fact Sheet / NASA Science. Copy is written for this site.
 */
export type PlanetId = 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';

export interface PlanetStat {
  label: string;
  value: string;
}

export interface Planet {
  id: PlanetId;
  n: number; // 1..8
  num: string; // '04'
  name: string;
  def: BodyDef;
  stats: PlanetStat[];
  /** short caption used in the menu and the planets index */
  line: string;
  accent: string;
  /** dive overlay: haze colour + how thick the cloud deck is (0 = bare rock, 1 = fully overcast) */
  haze: [number, number, number];
  hazeAmount: number;
}

const mk = (
  id: PlanetId,
  n: number,
  stats: [string, string, string, string],
  line: string,
  accent: string,
  haze: [number, number, number],
  hazeAmount: number,
): Planet => ({
  id,
  n,
  num: String(n).padStart(2, '0'),
  name: BODY_MAP[id].name,
  def: BODY_MAP[id],
  stats: [
    { label: 'Distance:', value: stats[0] },
    { label: 'Year:', value: stats[1] },
    { label: 'Temperature:', value: stats[2] },
    { label: 'Atmosphere:', value: stats[3] },
  ],
  line,
  accent,
  haze,
  hazeAmount,
});

export const PLANETS: Planet[] = [
  mk(
    'mercury',
    1,
    [
      '57.9 million km from the Sun.',
      '88 Earth days.',
      'From 430 °C by day to −180 °C at night.',
      'A wisp of atoms blasted off the surface — close to a vacuum.',
    ],
    'Scorched by day, frozen by night.',
    '#c9bfae',
    [0.62, 0.58, 0.54],
    0.25,
  ),
  mk(
    'venus',
    2,
    [
      '108.2 million km from the Sun.',
      '224.7 Earth days.',
      'About 464 °C — hot enough to melt lead.',
      'Crushing carbon dioxide under clouds of sulfuric acid.',
    ],
    'A golden furnace under acid clouds.',
    '#f0a54a',
    [0.96, 0.68, 0.3],
    1,
  ),
  mk(
    'earth',
    3,
    [
      '149.6 million km from the Sun.',
      '365.25 Earth days.',
      'Average surface temperature around 15 °C.',
      'Mostly nitrogen and oxygen, supporting life and liquid water.',
    ],
    'The only world we know that is alive.',
    '#6fb4ff',
    [0.96, 0.97, 1.0],
    1,
  ),
  mk(
    'mars',
    4,
    [
      '227.9 million km from the Sun.',
      '687 Earth days.',
      'Average near −63 °C, with summer afternoons that touch 20 °C.',
      'Thin carbon dioxide — about 1% as dense as Earth’s air.',
    ],
    'A rust-red desert that remembers water.',
    '#e0733f',
    [0.88, 0.5, 0.34],
    0.75,
  ),
  mk(
    'jupiter',
    5,
    [
      '778.5 million km from the Sun.',
      '11.86 Earth years.',
      'Cloud tops near −110 °C.',
      'Hydrogen and helium, with ammonia clouds and storms wider than Earth.',
    ],
    'A storm world with no ground at all.',
    '#d9a066',
    [0.95, 0.84, 0.7],
    1,
  ),
  mk(
    'saturn',
    6,
    [
      '1.43 billion km from the Sun.',
      '29.4 Earth years.',
      'Cloud tops near −140 °C.',
      'Hydrogen and helium, with a golden haze and a hexagonal polar jet.',
    ],
    'Lit from above by a bridge of ice.',
    '#e6c98a',
    [0.93, 0.85, 0.66],
    1,
  ),
  mk(
    'uranus',
    7,
    [
      '2.87 billion km from the Sun.',
      '84 Earth years.',
      'Down to −224 °C, the coldest atmosphere of any planet.',
      'Hydrogen, helium and methane, which tints the whole planet pale cyan.',
    ],
    'An ice giant lying on its side.',
    '#8fe0e6',
    [0.7, 0.9, 0.92],
    1,
  ),
  mk(
    'neptune',
    8,
    [
      '4.5 billion km from the Sun.',
      '164.8 Earth years.',
      'Around −201 °C at the cloud tops.',
      'Hydrogen, helium and methane, driven by the fastest winds known.',
    ],
    'The deep-blue edge of the planets.',
    '#4f7dff',
    [0.4, 0.55, 0.95],
    1,
  ),
];

export const PLANET_BY_ID: Record<string, Planet> = Object.fromEntries(PLANETS.map((p) => [p.id, p]));
const devStart = typeof location !== 'undefined' && import.meta.env.DEV ? new URLSearchParams(location.search).get('start') : null;
/** Mars, like the reference. In dev, ?start=<planet> boots straight onto another world. */
export const START_PLANET: PlanetId = (devStart && PLANETS.some((p) => p.id === devStart) ? devStart : 'mars') as PlanetId;

/** The planet shown on the portal card: one step inward, wrapping from Mercury back to Neptune. */
export function nextOf(id: PlanetId): Planet {
  const n = PLANET_BY_ID[id].n;
  return PLANETS[(n - 2 + PLANETS.length) % PLANETS.length];
}

export function prevOf(id: PlanetId): Planet {
  const n = PLANET_BY_ID[id].n;
  return PLANETS[n % PLANETS.length];
}
