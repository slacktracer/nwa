import { Score } from "./game.ts";
import entities from "./data/entities.ts";
import { element } from "../utilities/adapter.ts";

export function post(): void {
  entities.ships.forEach(function (ship) {
    if (ship.live === true) {
      element("#" + ship.id + " .battery").style.width = ship.battery.level + "px";
    }
  });
}

export function postScore(score: Score): void {
  entities.ships.forEach(function (ship) {
    element("#" + ship.id + " .score").innerHTML = String(score[ship.id as keyof Score]);
  });
}

export default { post, postScore, prepare };

export function prepare(): void {
  entities.ships.forEach(function (ship) {
    element("#" + ship.id + " .battery").style.background = ship.colours.hull;
    element("#" + ship.id + " .battery").style.height = "10px";
    element("#" + ship.id + " .battery").style.width = "100px";

    element("#" + ship.id).style.color = ship.colours.hull;
    element("#" + ship.id).style.fontFamily = "monospace";
    element("#" + ship.id).style.fontSize = "3rem";
    element("#" + ship.id).style.opacity = "0.8";
    element("#" + ship.id).style.padding = "10px";
    element("#" + ship.id).style.position = "absolute";

    if (ship.id === "player1" || ship.id === "player2") {
      element("#" + ship.id).style.bottom = "20px";
    } else {
      element("#" + ship.id).style.top = "20px";
    }

    if (ship.id === "player1" || ship.id === "player4") {
      element("#" + ship.id).style.right = "20px";
      element("#" + ship.id).style.textAlign = "right";
    } else {
      element("#" + ship.id).style.left = "20px";
    }
  });
}
