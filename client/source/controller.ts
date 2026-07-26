// Controller interface — the abstraction for ship input.
// Keyboard, AI, joystick, replay — all implement this.
// One controller per ship. Looper applies controller[i] → ship[i].

/** 5 independent booleans — matches the keyboard input model. */
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

/** A controller produces one Action per tick — for a single ship. */
export interface Controller {
  /** Called once before the game loop starts. */
  init?(): void;

  /** Called each tick. Returns the action for this controller's ship. */
  getAction(): Action;

  /** Called when the game loop stops. */
  destroy?(): void;
}
