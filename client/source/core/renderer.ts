import config from "./config.ts";
import entities from "./data/entities.ts";
import type { Vec2 } from "./data/entities.ts";
import { clearContext, resetContext, centerFrame, resetFrame } from "./modules/Context.ts";
import Missile from "./modules/Missile.ts";
import { render as shipRender, unrender as shipUnrender } from "./modules/Ship.ts";
import { render as starRender, unrender as starUnrender } from "./modules/Star.ts";
import { ScreenSize } from "../utilities/adapter.ts";

export interface Frame {
  aspect: string;
  element: HTMLElement;
  height: number;
  width: number;
}

export interface Configuration {
  aspect: string;
  contexts: Record<string, CanvasRenderingContext2D>;
  element: HTMLElement;
  height: number;
  width: number;
  screen: ScreenSize;
}

const contexts: Record<string, CanvasRenderingContext2D> = {};
const frame: Frame = { aspect: "fullscreen", element: document.body, height: 0, width: 0 };

export function getContext(canvas: string): CanvasRenderingContext2D {
  return contexts[canvas];
}

export function getFrame(): Frame {
  return frame;
}

export function render(offset: number): void {
  if (config.render !== true) return;

  if (config.clear === false) {
    entities.ships.forEach(function (ship) {
      unrender("foreground", shipUnrender(ship));
    });

    unrender("foreground", starUnrender(entities.star!));

    entities.missiles.forEach(function (missile) {
      unrender("foreground", Missile.unrender(missile));
    });
  } else {
    clearContext(contexts.foreground);
  }

  entities.ships.forEach(function (ship) {
    shipRender(
      contexts.foreground,
      contexts.middleground,
      ship,
      offset,
    );
  });

  starRender(contexts.foreground, entities.star!);

  entities.missiles.forEach(function (missile) {
    Missile.render(
      contexts.foreground,
      missile,
      offset,
      contexts.middleground,
    );
  });
}

function setContext(canvas: string, context: CanvasRenderingContext2D): void {
  contexts[canvas] = context;
  resetContext(context, frame);
}

function setFrame(configuration: Frame, screen: ScreenSize): Frame {
  Object.assign(frame, configuration);
  resetFrame(frame, screen);
  centerFrame(frame, screen);
  return frame;
}

function unrender(canvas: string, something: false | { padding: number; position: Vec2 }): void {
  if (something !== false) {
    contexts[canvas].save();
    contexts[canvas].translate(something.position[0], something.position[1]);
    contexts[canvas].clearRect(-something.padding, -something.padding, something.padding * 2, something.padding * 2);
    contexts[canvas].restore();
  }
}

export default { getContext, getFrame, render, setup };

export function setup(configuration: Configuration): void {
  setFrame(
    {
      aspect: configuration.aspect,
      element: configuration.element,
      height: configuration.height,
      width: configuration.width,
    },
    {
      height: configuration.screen.height,
      width: configuration.screen.width,
    },
  );

  setContext("background", configuration.contexts.background);
  setContext("middleground", configuration.contexts.middleground);
  setContext("foreground", configuration.contexts.foreground);
}
