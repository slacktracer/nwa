// Browser-based AI controller — observes game state and produces one Action.
// Loads a trained model if available, falls back to random.

import type { Controller, Action } from "../controller.ts";
import entities from "../core/data/entities.ts";
import { loadModel } from "./model_loader.ts";

function observe(): number[] {
  const f: number[] = [];
  for (const s of entities.ships) {
    f.push(
      s.position[0] / 250, s.position[1] / 250,
      s.velocity[0], s.velocity[1],
      (s.radians % (Math.PI * 2)) / Math.PI,
      s.battery.level / s.battery.maximum,
      s.weaponsSystem.missiles.live / s.weaponsSystem.missiles.maximum,
      s.live ? 1 : 0,
    );
  }
  f.push((entities.star?.radius ?? 50) / 60);
  return f;
}

export class BrowserAIController implements Controller {
  private modelFn: ((obs: number[]) => Action[]) | null = null;
  private shipIndex: number;

  constructor(shipIndex: number, modelUrl?: string) {
    this.shipIndex = shipIndex;
    if (modelUrl) {
      loadModel(modelUrl).then((m) => { this.modelFn = m; }).catch(() => {});
    }
  }

  getAction(): Action {
    if (this.modelFn) {
      const actions = this.modelFn(observe());
      return actions[this.shipIndex] ?? {
        thrust: false, turnLeft: false, turnRight: false, fire: false, clear: false,
      };
    }
    // Fallback: simple random behavior
    return {
      thrust: Math.random() < 0.3,
      turnLeft: Math.random() < 0.1,
      turnRight: Math.random() < 0.1,
      fire: Math.random() < 0.02,
      clear: Math.random() < 0.005,
    };
  }
}
