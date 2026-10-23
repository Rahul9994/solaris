import type { PlanetId } from '../../data/planets';
import type { SceneSrc } from './types';
import { MARS } from './scenes/mars';
import { EARTH } from './scenes/earth';
import { MERCURY } from './scenes/mercury';
import { VENUS } from './scenes/venus';
import { JUPITER } from './scenes/jupiter';
import { SATURN } from './scenes/saturn';
import { URANUS } from './scenes/uranus';
import { NEPTUNE } from './scenes/neptune';

export type { SceneSrc } from './types';

/** One procedural "photograph" per planet. */
export const SCENES: Record<PlanetId, SceneSrc> = {
  mercury: MERCURY,
  venus: VENUS,
  earth: EARTH,
  mars: MARS,
  jupiter: JUPITER,
  saturn: SATURN,
  uranus: URANUS,
  neptune: NEPTUNE,
};
