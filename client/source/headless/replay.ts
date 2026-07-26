// Replay — records and plays back game frames.
// Captures observation + actions each tick so you can watch how a game evolved.

import type { Controller, Action } from "../controller.ts";
import type { Obs } from "../headless/env.ts";

export interface ReplayFrame {
  tick: number;
  obs: Obs;
  actions: Action[];
  rewards: number[];
}

export class ReplayRecorder {
  frames: ReplayFrame[] = [];

  record(tick: number, obs: Obs, actions: Action[], rewards: number[]): void {
    this.frames.push({ tick, obs, actions, rewards });
  }

  toJSON(): string { return JSON.stringify(this.frames); }
}

export class ReplayController implements Controller {
  private frames: ReplayFrame[];
  private index = 0;
  private shipIndex: number;

  constructor(frames: ReplayFrame[], shipIndex: number) {
    this.frames = frames;
    this.shipIndex = shipIndex;
  }

  getAction(): Action {
    if (this.index >= this.frames.length) {
      return { thrust: false, turnLeft: false, turnRight: false, fire: false, clear: false };
    }
    const actions = this.frames[this.index++].actions;
    return actions[this.shipIndex] ?? { thrust: false, turnLeft: false, turnRight: false, fire: false, clear: false };
  }

  get length(): number { return this.frames.length; }
}
