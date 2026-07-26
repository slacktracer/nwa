import renderer from "./renderer.ts";
import { post } from "./output.ts";
import update from "./update.ts";
import { now, nextFrame } from "../utilities/adapter.ts";
import meter from "../utilities/meter.ts";

const millisecondsPerUpdate = 16;

let doLoop = false;
let lag = 0;
let previousTime = 0;

function loop(): void {
  meter.tickStart();

  const time = now();
  const elapsedTime = time - previousTime;

  previousTime = time;
  lag += elapsedTime;

  while (lag >= millisecondsPerUpdate) {
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
}

function start(): void {
  doLoop = true;
  lag = 0;
  previousTime = now();
  loop();
}

function toggle(): void {
  doLoop = !doLoop;
  if (doLoop) {
    start();
  }
}

export default Object.freeze({
  start,
  stop,
  toggle,
});
