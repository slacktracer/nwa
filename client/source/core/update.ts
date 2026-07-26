import entities from "./data/entities.ts";
import Missile from "./modules/Missile.ts";
import { detectCollisions } from "./modules/Physics.ts";
import { update as shipUpdate } from "./modules/Ship.ts";
import { update as starUpdate } from "./modules/Star.ts";
import { getFrame } from "./renderer.ts";
import { tinycolor } from "../utilities/adapter.ts";

const frame = getFrame();

export default function update(
  deltaTime: number,
  time: number,
): void {
  starUpdate(
    deltaTime,
    entities.star!,
    time,
    tinycolor,
  );

  detectCollisions(
    entities.missiles,
    entities.ships,
    entities.star!,
  );

  entities.missiles.forEach(function (missile) {
    Missile.update(
      deltaTime,
      frame,
      missile,
      entities.star!,
    );
  });

  entities.ships.forEach(function (ship) {
    shipUpdate(
      deltaTime,
      frame,
      ship,
      entities.star!,
    );
  });
}
