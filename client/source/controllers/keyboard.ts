// Keyboard controller — tracks held keys and exposes them as an Action.
// One instance controls one ship. The shipIndex (0-3) selects which key mapping to use.

import type { Controller, Action } from "../controller.ts";
import { on } from "../utilities/events.ts";

const PLAYER_KEYS: Array<{
  fire: number; turnLeft: number; turnRight: number; thrust: number; clear: number;
}> = [
  { fire: 40, turnLeft: 37, turnRight: 39, thrust: 38, clear: 16 },
  { fire: 88, turnLeft: 90, turnRight: 67, thrust: 83, clear: 65 },
  { fire: 70, turnLeft: 68, turnRight: 71, thrust: 82, clear: 69 },
  { fire: 75, turnLeft: 74, turnRight: 76, thrust: 73, clear: 85 },
];

export class KeyboardController implements Controller {
  private keys = new Set<number>();
  private edgeKeys = new Set<number>();  // one-shot: consumed on read
  private map: typeof PLAYER_KEYS[0];

  constructor(shipIndex: number) {
    this.map = PLAYER_KEYS[shipIndex] ?? PLAYER_KEYS[0];
  }

  init(): void {
    on("keydown", (e: Event) => {
      const k = (e as KeyboardEvent).keyCode;
      // Only treat as edge if this is a fresh press (not a key repeat)
      const isRepeat = this.keys.has(k);
      this.keys.add(k);
      if (!isRepeat) this.edgeKeys.add(k);
    });
    on("keyup", (e: Event) => {
      const k = (e as KeyboardEvent).keyCode;
      this.keys.delete(k);
      this.edgeKeys.delete(k);
    });
  }

  getAction(): Action {
    const d = this.keys;
    const firePressed = this.edgeKeys.has(this.map.fire);
    const clearPressed = this.edgeKeys.has(this.map.clear);
    // Consume edge triggers so they only fire once per press
    if (firePressed) this.edgeKeys.delete(this.map.fire);
    if (clearPressed) this.edgeKeys.delete(this.map.clear);

    return {
      thrust: d.has(this.map.thrust),
      turnLeft: d.has(this.map.turnLeft),
      turnRight: d.has(this.map.turnRight),
      fire: firePressed,
      clear: clearPressed,
    };
  }

  destroy(): void { this.keys.clear(); this.edgeKeys.clear(); }
}
