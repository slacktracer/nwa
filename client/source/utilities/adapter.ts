import FPSMeter from "../../lib/fpsmeter.ts";
import tinycolor from "../../lib/tinycolor.ts";

export interface ScreenSize {
  height: number;
  width: number;
}

export function addEventListener(
  eventName: string,
  listener: EventListenerOrEventListenerObject,
  element?: Element,
): void {
  if (element) {
    element.addEventListener(eventName, listener);
  } else {
    window.addEventListener(eventName, listener);
  }
}

export function deepCopy<T>(object: T): T {
  return JSON.parse(JSON.stringify(object)) as T;
}

export function createCanvas(): HTMLCanvasElement {
  return document.createElement("canvas");
}

export function element(selector: string): HTMLElement {
  return document.querySelector(selector) as HTMLElement;
}

export function hide(selector: string): void {
  element(selector).style.visibility = "hidden";
}

export function nextFrame(callback: FrameRequestCallback): number {
  return requestAnimationFrame(callback);
}

export function now(): number {
  return performance.now();
}

export function screenSize(): ScreenSize {
  return {
    height: window.innerHeight,
    width: window.innerWidth,
  };
}

export function show(selector: string): void {
  element(selector).style.visibility = "visible";
}

export { FPSMeter, tinycolor };
