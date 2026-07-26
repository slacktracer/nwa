// AI controller — wraps a model that maps observations to actions.
// The model is any function: (observation: number[]) => Action[].
// This stays framework-agnostic — plug in TF.js, ONNX, or hand-coded logic.

import type { Controller, Action } from "../controller.ts";
import type { Obs } from "../headless/env.ts";

export type ModelFn = (obs: number[], shipCount: number) => Action[];

export class AIController implements Controller {
  private getObs: () => Obs;
  private model: ModelFn;

  constructor(model: ModelFn, getObs: () => Obs) {
    this.model = model;
    this.getObs = getObs;
  }

  getActions(): Action[] {
    const obs = this.getObs();
    const flat: number[] = [];
    for (const s of obs.ships) {
      flat.push(s.x, s.y, s.vx, s.vy, s.angle, s.battery, s.missiles, s.alive);
    }
    flat.push(obs.starRadius);
    return this.model(flat, obs.ships.length);
  }
}

/** A random-action model — useful for baselines and testing. */
export function randomModel(_obs: number[], shipCount: number): Action[] {
  return Array.from({ length: shipCount }, () => ({
    thrust: Math.random() < 0.3,
    turnLeft: Math.random() < 0.15,
    turnRight: Math.random() < 0.15,
    fire: Math.random() < 0.02,
    clear: Math.random() < 0.005,
  }));
}
