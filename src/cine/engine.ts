import { Stage } from './stage';
import { Director } from './director';
import { useStore } from '../state/store';

/** The one live stage + director for the page (created by <App/>, used by the UI). */
let stage: Stage | null = null;
let director: Director | null = null;

export function createEngine(canvas: HTMLCanvasElement) {
  stage = new Stage(canvas, useStore.getState().quality);
  director = new Director(stage);
  return { stage, director };
}

export const getStage = () => stage;
export const getDirector = () => director;

export function destroyEngine() {
  stage?.dispose();
  stage = null;
  director = null;
}
