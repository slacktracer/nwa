// Keyboard controller — tracks held keys and exposes them as Actions.
import type { Controller, Action } from "../controller.ts";
import { on } from "../utilities/events.ts";

/** Key mappings per player index, matching the original input.ts layout. */
const PLAYER_KEYS: Array<{
  fire: number;
  turnLeft: number;
  turnRight: number;
  thrust: number;
  clear: number;
}> = [
  { fire: 40, turnLeft: 37, turnRight: 39, thrust: 38, clear: 16 },  // arrows + shift
  { fire: 88, turnLeft: 90, turnRight: 67, thrust: 83, clear: 65 },  // X Z C S A
  { fire: 70, turnLeft: 68, turnRight: 71, thrust: 82, clear: 69 },  // F D G R E
  { fire: 75, turnLeft: 74, turnRight: 76, thrust: 73, clear: 85 },  // K J L I U
];

export class KeyboardController implements Controller {
  private keys = new Set<number>();

  init(_numPlayers: number): void {
    on("keydown", (e: Event) => {
      this.keys.add((e as KeyboardEvent).keyCode);
    });

    on("keyup", (e: Event) => {
      this.keys.delete((e as KeyboardEvent).keyCode);
    });
  }

  getActions(): Action[] {
    return PLAYER_KEYS.map((map) => {
      const down = this.keys;
      return {
        thrust: down.has(map.thrust),
        turnLeft: down.has(map.turnLeft),
        turnRight: down.has(map.turnRight),
        fire: down.has(map.fire),
        clear: down.has(map.clear),
      };
    });
  }

  destroy(): void {
    this.keys.clear();
  }
}
