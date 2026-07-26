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

  /** Serialize to JSON — can be saved to disk and replayed later. */
  toJSON(): string {
    return JSON.stringify(this.frames);
  }
}

/** Plays back a recorded game as a Controller (feeds pre-recorded actions). */
export class ReplayController implements Controller {
  private frames: ReplayFrame[];
  private index = 0;

  constructor(frames: ReplayFrame[]) {
    this.frames = frames;
  }

  getActions(): Action[] {
    if (this.index >= this.frames.length) {
      return [];
    }
    return this.frames[this.index++].actions;
  }

  /** Total frames in the replay. */
  get length(): number {
    return this.frames.length;
  }
}
