import renderer from "./renderer.ts";
import { post } from "./output.ts";
import update from "./update.ts";
import { now, nextFrame } from "../utilities/adapter.ts";
import meter from "../utilities/meter.ts";
import type { Controller } from "../controller.ts";
import entities from "./data/entities.ts";

const millisecondsPerUpdate = 16;

let doLoop = false;
let lag = 0;
let previousTime = 0;
let controllers: Controller[] = [];

function loop(): void {
  meter.tickStart();

  const time = now();
  const elapsedTime = time - previousTime;

  previousTime = time;
  lag += elapsedTime;

  while (lag >= millisecondsPerUpdate) {
    // Collect actions from all controllers and apply to ship commands
    for (const ctrl of controllers) {
      const actions = ctrl.getActions();
      for (let i = 0; i < actions.length; i += 1) {
        const ship = entities.ships[i];
        if (!ship?.live) continue;
        const a = actions[i];
        ship.commands.anticlockwise = a.turnLeft;
        ship.commands.clockwise = a.turnRight;
        ship.commands.thrust = a.thrust;
        if (a.fire) ship.commands.fire = true;
        if (a.clear) ship.commands.clear = true;
      }
    }

    update(millisecondsPerUpdate, time);
    lag -= millisecondsPerUpdate;
  }

  renderer.render(lag / millisecondsPerUpdate);

  post();

  if (doLoop === true) {
    nextFrame(loop);
  }

  meter.tick();
}

function stop(): void {
  doLoop = false;
  for (const ctrl of controllers) ctrl.destroy?.();
  controllers = [];
}

function start(ctrls: Controller[]): void {
  controllers = ctrls;
  for (const ctrl of controllers) ctrl.init?.(controllers.length);
  doLoop = true;
  lag = 0;
  previousTime = now();
  loop();
}

function toggle(): void {
  doLoop = !doLoop;
  if (doLoop) {
    start(controllers);
  }
}

export default Object.freeze({
  start,
  stop,
  toggle,
});
