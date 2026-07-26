import { Vec2 } from "../../../lib/gl-matrix.ts";

export interface PropulsorColours {
  flame: string;
  shadow: string;
}

function drawPropulsor(context: CanvasRenderingContext2D, fillStyle: string, position: Vec2, radians: number): void {
  context.save();
  context.translate(position[0], position[1]);
  context.rotate(radians);
  context.beginPath();
  context.moveTo(-5, 0);
  context.lineTo(-10, 5);
  context.lineTo(-10, -5);
  context.closePath();
  context.fillStyle = fillStyle;
  context.fill();
  context.restore();
}

export function render(
  colours: PropulsorColours,
  flameContext: CanvasRenderingContext2D,
  position: Vec2,
  radians: number,
  shadowContext: CanvasRenderingContext2D,
): void {
  drawPropulsor(flameContext, colours.flame, position, radians);
  drawPropulsor(shadowContext, colours.shadow, position, radians);
}
