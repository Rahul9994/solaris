import type { SceneParts } from './glsl';

export interface SceneSrc extends SceneParts {
  seed: number;
  /** half-angle (rad) of the height-map wedge and its distance range */
  hmap: { half: number; r0: number; r1: number };
}
