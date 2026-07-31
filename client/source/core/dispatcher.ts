import game from "./game.ts";
import entities from "./data/entities.ts";
import { on } from "../utilities/events.ts";

on("detonation", function (data: Record<string, unknown>) {
  const owner = data.owner as string;
  const target = data.target as string | undefined;
  const ship = entities.ships.byId[owner];
  ship.weaponsSystem.missiles.live -= 1;
  // Only award point if missile hit an enemy (not self)
  if (target && target !== owner) {
    game.point(owner);
  }
  if (ship.weaponsSystem.missiles.live < 0) {
    ship.weaponsSystem.missiles.live = 0;
  }
});

on("crash", function (data: Record<string, unknown>) {
  if (data.self) {
    game.death(data.id as string, "self");
    return;
  }
  if (data.hit) {
    game.death(data.id as string);
  } else {
    game.death(data.id as string, "star");
  }
});
