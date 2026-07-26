import config from "./config.ts";
import looper from "./looper.ts";
import main from "./main.ts";
import renderer from "./renderer.ts";
import entities from "./data/entities.ts";
import { resetContext } from "./modules/Context.ts";
import { on } from "../utilities/events.ts";
import meter from "../utilities/meter.ts";

export default { listen };

export function listen(): void {
  on("resize", function onResize() {
    resetContext(renderer.getContext("background"), renderer.getFrame());
    resetContext(renderer.getContext("middleground"), renderer.getFrame());
    resetContext(renderer.getContext("foreground"), renderer.getFrame());
  });

  on("keydown", function onKeydown(event: Event) {
    const keyEvent = event as KeyboardEvent;
    switch (keyEvent.keyCode) {
      case 40: break; // down (P1 fire — handled on keyup)
      case 37: entities.ships[0].commands.anticlockwise = true; break;
      case 39: entities.ships[0].commands.clockwise = true; break;
      case 38: entities.ships[0].commands.thrust = true; break;
      case 16: entities.ships[0].commands.clear = true; break;
      case 88: break; // x (P2 fire — handled on keyup)
      case 90: entities.ships[1].commands.anticlockwise = true; break;
      case 67: entities.ships[1].commands.clockwise = true; break;
      case 83: entities.ships[1].commands.thrust = true; break;
      case 65: entities.ships[1].commands.clear = true; break;
      case 70: break; // f (P3 fire — handled on keyup)
      case 68: entities.ships[2].commands.anticlockwise = true; break;
      case 71: entities.ships[2].commands.clockwise = true; break;
      case 82: entities.ships[2].commands.thrust = true; break;
      case 69: entities.ships[2].commands.clear = true; break;
      case 75: break; // k (P4 fire — handled on keyup)
      case 74: entities.ships[3].commands.anticlockwise = true; break;
      case 76: entities.ships[3].commands.clockwise = true; break;
      case 73: entities.ships[3].commands.thrust = true; break;
      case 85: entities.ships[3].commands.clear = true; break;
    }
  });

  on("keyup", function onKeyup(event: Event) {
    const keyEvent = event as KeyboardEvent;
    switch (keyEvent.keyCode) {
      case 40: entities.ships[0].commands.fire = true; break;
      case 37: entities.ships[0].commands.anticlockwise = false; break;
      case 39: entities.ships[0].commands.clockwise = false; break;
      case 38: entities.ships[0].commands.thrust = false; break;
      case 88: entities.ships[1].commands.fire = true; break;
      case 90: entities.ships[1].commands.anticlockwise = false; break;
      case 67: entities.ships[1].commands.clockwise = false; break;
      case 83: entities.ships[1].commands.thrust = false; break;
      case 70: entities.ships[2].commands.fire = true; break;
      case 68: entities.ships[2].commands.anticlockwise = false; break;
      case 71: entities.ships[2].commands.clockwise = false; break;
      case 82: entities.ships[2].commands.thrust = false; break;
      case 75: entities.ships[3].commands.fire = true; break;
      case 74: entities.ships[3].commands.anticlockwise = false; break;
      case 76: entities.ships[3].commands.clockwise = false; break;
      case 73: entities.ships[3].commands.thrust = false; break;

      case 81: looper.toggle(); break;
      case 13: main.restart(); break;

      case 49: config.clear = !config.clear; console.log(`using clear = ${config.clear}`); break;
      case 50: config.render = !config.render; console.log(`rendering = ${config.render}`); break;
      case 51: config.fps = !config.fps; (config.fps) ? meter.show() : meter.hide(); console.log(`showing fps = ${config.fps}`); break;
    }
  });
}
