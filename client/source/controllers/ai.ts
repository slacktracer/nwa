// AI controller — wraps a model that maps observations to actions.
// The model is any function: (observation: number[], shipIndex: number) => Action.

import type { Controller, Action } from "../controller.ts";
import type { Obs } from "../headless/env.ts";

export type ModelFn = (obs: number[], shipIndex: number) => Action;

export class AIController implements Controller {
  private getObs: () => Obs;
  private model: ModelFn;
  private shipIndex: number;

  constructor(model: ModelFn, shipIndex: number, getObs: () => Obs) {
    this.model = model;
    this.shipIndex = shipIndex;
    this.getObs = getObs;
  }

  getAction(): Action {
    const obs = this.getObs();
    const flat: number[] = [];
    for (const s of obs.ships) {
      flat.push(s.x, s.y, s.vx, s.vy, s.angle, s.battery, s.missiles, s.alive);
    }
    flat.push(obs.starRadius);
    return this.model(flat, this.shipIndex);
  }
}

export function randomModel(_obs: number[], _shipIndex: number): Action {
  return {
    thrust: Math.random() < 0.3,
    turnLeft: Math.random() < 0.15,
    turnRight: Math.random() < 0.15,
    fire: Math.random() < 0.02,
    clear: Math.random() < 0.005,
  };
}
