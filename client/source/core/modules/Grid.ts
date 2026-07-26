import entities from "../data/entities.ts";
import { Grid } from "../data/entities.ts";

export function build(): void {
  entities.grid = entities.templates.grid();
}

export function render(context: CanvasRenderingContext2D, grid: Grid): void {
  let tracer: number;

  context.save();
  context.beginPath();

  let whereToStart = context.canvas.width % grid.size - context.canvas.width;
  let whereToStop = context.canvas.width + grid.lineWidth;

  for (tracer = whereToStart; tracer < whereToStop; tracer += grid.size) {
    context.moveTo(0.5 + tracer, -context.canvas.height);
    context.lineTo(0.5 + tracer, context.canvas.height);
  }

  whereToStart = context.canvas.height % grid.size - context.canvas.height;
  whereToStop = context.canvas.height + grid.lineWidth;

  for (tracer = whereToStart; tracer < whereToStop; tracer += grid.size) {
    context.moveTo(-context.canvas.width, 0.5 + tracer);
    context.lineTo(context.canvas.width, 0.5 + tracer);
  }

  context.lineWidth = grid.lineWidth;
  context.strokeStyle = grid.colour;
  context.stroke();
  context.restore();
}

export default { build, render };
