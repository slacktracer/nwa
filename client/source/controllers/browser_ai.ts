// Browser-based AI controller — observes game state and produces actions.
// Uses the model loader if a trained model is available, otherwise random.

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

const DEFAULT_AI: Action[] = [
  { thrust: true, turnLeft: false, turnRight: false, fire: false, clear: false },
  { thrust: false, turnLeft: false, turnRight: true, fire: false, clear: false },
  { thrust: false, turnLeft: true, turnRight: false, fire: false, clear: false },
  { thrust: true, turnLeft: false, turnRight: true, fire: false, clear: false },
];

export class BrowserAIController implements Controller {
  private model: ((obs: number[]) => Action[]) | null = null;

  constructor(modelUrl?: string) {
    if (modelUrl) {
      loadModel(modelUrl).then((m) => { this.model = m; }).catch(() => {});
    }
  }

  getActions(): Action[] {
    if (this.model) {
      return this.model(observe());
    }
    // Random fallback while model loads or if no model
    const obs = observe();
    const alive = obs.filter((_, i) => i % 8 === 7); // alive flags
    return alive.map((a, i) => {
      if (!a) return DEFAULT_AI[i] ?? { thrust: false, turnLeft: false, turnRight: false, fire: false, clear: false };
      return {
        thrust: Math.random() < 0.3,
        turnLeft: Math.random() < 0.1,
        turnRight: Math.random() < 0.1,
        fire: Math.random() < 0.02,
        clear: Math.random() < 0.005,
      };
    });
  }
}
