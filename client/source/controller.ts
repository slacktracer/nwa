// Controller interface — the abstraction for ship input.
// Keyboard, AI, joystick, replay — all implement this.

/** 5 independent booleans per ship — matches the keyboard input model. */
export interface Action {
  thrust: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  fire: boolean;
  clear: boolean;
}

export const EMPTY_ACTION: Action = {
  thrust: false,
  turnLeft: false,
  turnRight: false,
  fire: false,
  clear: false,
};

/** A controller produces one Action per active ship each tick. */
export interface Controller {
  /** Called once before the game loop starts. */
  init?(numPlayers: number): void;

  /** Called each tick. Returns actions for all ships. */
  getActions(): Action[];

  /** Called when the game loop stops. */
  destroy?(): void;
}
