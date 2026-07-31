import "./dispatcher.ts";
import looper from "./looper.ts";
import output from "./output.ts";
import renderer from "./renderer.ts";
import entities from "./data/entities.ts";
import type { Ship as ShipEntity } from "./data/entities.ts";
import ships from "./data/ships/all.ts";
import Context from "./modules/Context.ts";
import Grid from "./modules/Grid.ts";
import Missile from "./modules/Missile.ts";
import Ship from "./modules/Ship.ts";
import Star from "./modules/Star.ts";
import { createCanvas } from "../utilities/adapter.ts";
import { on } from "../utilities/events.ts";
import { KeyboardController } from "../controllers/keyboard.ts";
import { BrowserAIController } from "../controllers/browser_ai.ts";
import type { Controller } from "../controller.ts";
import config from "./config.ts";
import meter from "../utilities/meter.ts";

export interface GameConfiguration {
  aspect: string;
  contexts: {
    background: CanvasRenderingContext2D;
    middleground: CanvasRenderingContext2D;
    foreground: CanvasRenderingContext2D;
  };
  element: HTMLElement;
  height: number;
  players: number;
  aiPlayers: number;   // 0 = all human, 1-3 = AI opponents
  clearMissiles: boolean;
  width: number;
  screen: { height: number; width: number };
}

let clearMissilesOnRestart = true;

function boot(configuration: GameConfiguration): void {
  clearMissilesOnRestart = configuration.clearMissiles !== false;
  Grid.build();

  for (let i = 0; i < configuration.players; i += 1) {
    Ship.build(
      ships[i] as Partial<ShipEntity>,
      createCanvas(),
      createCanvas(),
    );
  }

  Star.build();

  output.prepare();

  renderer.setup(configuration);

  // Meta keys (not per-ship controls): restart, debug toggles
  on("keyup", (e: Event) => {
    const k = (e as KeyboardEvent).keyCode;
    switch (k) {
      case 81: looper.toggle(); break;
      case 13: restart(); break;
      case 49: config.clear = !config.clear; break;
      case 50: config.render = !config.render; break;
      case 51: config.fps = !config.fps;
        config.fps ? meter.show() : meter.hide();
        break;
    }
  });

  // Build controller list — one per ship.
  // AI fills from the end: so humans get low indices, AI gets high indices.
  const controllers: Controller[] = [];
  const total = configuration.players;
  const aiCount = Math.min(configuration.aiPlayers, total);
  const humanCount = total - aiCount;

  for (let i = 0; i < total; i++) {
    if (i < humanCount) {
      controllers.push(new KeyboardController(i));
    } else {
      controllers.push(new BrowserAIController(i, "/ppo_model_final.json"));
    }
  }
  looper.setOnRoundEnd(restart);
  looper.start(controllers);
}

function restart(): void {
  Context.resetContext(
    renderer.getContext("middleground"),
    renderer.getFrame(),
  );
  Context.resetContext(
    renderer.getContext("foreground"),
    renderer.getFrame(),
  );
  if (clearMissilesOnRestart) {
    entities.missiles.forEach(function (m) {
      Missile.deactivate(m);
    });
  }
  entities.ships.forEach(function (ship) {
    Ship.revive(ship);
  });
}

export default Object.freeze({
  boot,
  restart,
});
