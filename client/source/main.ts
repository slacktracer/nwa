import main from "./core/main.ts";
import type { GameConfiguration } from "./core/main.ts";
import { element, hide, screenSize, show } from "./utilities/adapter.ts";
import events from "./utilities/events.ts";

show("#menu");
element("#start").focus();

events.on(
  "click",
  start,
  element("#start"),
);

function configuration(): GameConfiguration {
  const playersSelect = element("#players") as HTMLSelectElement;
  const aiSelect = element("#aiplayers") as HTMLSelectElement;
  const clearCheck = element("#clearmissiles") as HTMLInputElement;
  return {
    aspect: "fullscreen",
    contexts: {
      background: (element("#background") as HTMLCanvasElement).getContext("2d")!,
      middleground: (element("#middleground") as HTMLCanvasElement).getContext("2d")!,
      foreground: (element("#foreground") as HTMLCanvasElement).getContext("2d")!,
    },
    element: element("#frame"),
    height: 500,
    players: parseInt(playersSelect.value, 10) || 2,
    aiPlayers: parseInt(aiSelect.value, 10) || 0,
    clearMissiles: clearCheck.checked,
    width: 500,
    screen: screenSize(),
  };
}

function start(event: Event): void {
  event.preventDefault();
  element("#start").blur();
  hide("#menu");
  main.boot(configuration());
}
