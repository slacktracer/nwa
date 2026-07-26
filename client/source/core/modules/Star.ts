import entities from "../data/entities.ts";
import { Star as StarEntity } from "../data/entities.ts";
import tinycolor from "../../../lib/tinycolor.ts";

export function build(): void {
  entities.star = entities.templates.star();
}

export function render(context: CanvasRenderingContext2D, star: StarEntity): void {
  context.save();
  context.translate(star.position[0], star.position[1]);
  context.beginPath();
  context.moveTo(star.radius, 0);
  context.arc(0, 0, star.radius, 0, Math.PI * 2);
  context.fillStyle = star.colour;
  context.fill();
  context.restore();
}

export function unrender(star: StarEntity): { padding: number; position: [number, number] } {
  return {
    padding: star.radius + 2,
    position: [star.position[0], star.position[1]],
  };
}

export function update(
  _deltaTime: number,
  star: StarEntity,
  _time: number,
  tc: typeof tinycolor,
): void {
  star.oscillator.value += star.oscillator.step;
  star.radius = star.baseRadius + Math.sin(star.oscillator.value) * star.oscillator.amplitude;

  if (star.radius < star.baseRadius) {
    if (Math.random() < 0.7) {
      star.colour = tc(star.colour).saturate()?.toString() ?? star.colour;
    } else {
      star.colour = tc(star.colour).desaturate()?.toString() ?? star.colour;
    }
  } else {
    if (Math.random() < 0.3) {
      star.colour = tc(star.colour).saturate()?.toString() ?? star.colour;
    } else {
      star.colour = tc(star.colour).desaturate()?.toString() ?? star.colour;
    }
  }
}

export default { build, render, unrender, update };
