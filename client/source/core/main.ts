import "./dispatcher.ts";
import input from "./input.ts";
import looper from "./looper.ts";
import output from "./output.ts";
import renderer from "./renderer.ts";
import entities from "./data/entities.ts";
import type { Ship as ShipEntity } from "./data/entities.ts";
import ships from "./data/ships/all.ts";
import Context from "./modules/Context.ts";
import Grid from "./modules/Grid.ts";
import Ship from "./modules/Ship.ts";
import Star from "./modules/Star.ts";
import { createCanvas } from "../utilities/adapter.ts";

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
  width: number;
  screen: { height: number; width: number };
}

function boot(configuration: GameConfiguration): void {
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
  input.listen();

  renderer.setup(configuration);

  looper.start();
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
  entities.ships.forEach(function (ship) {
    Ship.revive(ship);
  });
}

export default Object.freeze({
  boot,
  restart,
});
