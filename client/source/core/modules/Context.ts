import { Frame } from "../renderer.ts";
import { ScreenSize } from "../../utilities/adapter.ts";

function centerFrameByHeight(frame: Frame, screen: ScreenSize): void {
  frame.element.style.top = screen.height / 2 - frame.height / 2 + "px";
}

function centerFrameByWidth(frame: Frame, screen: ScreenSize): void {
  frame.element.style.left = screen.width / 2 - frame.width / 2 + "px";
}

export function centerFrame(frame: Frame, screen: ScreenSize): void {
  frame.element.style.position = "absolute";
  centerFrameByHeight(frame, screen);
  centerFrameByWidth(frame, screen);
}

export function clearContext(context: CanvasRenderingContext2D): void {
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.restore();
}

export function resetContext(context: CanvasRenderingContext2D, frame: Frame): void {
  context.canvas.height = frame.height;
  context.canvas.width = frame.width;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.translate(context.canvas.width / 2, context.canvas.height / 2);
}

export function resetFrame(frame: Frame, screen: ScreenSize): void {
  let side: number;

  switch (frame.aspect) {
    case "fullscreen":
      frame.height = screen.height;
      frame.width = screen.width;
      break;
    case "fullHeight":
      frame.height = screen.height;
      centerFrameByWidth(frame, screen);
      break;
    case "fullWidth":
      frame.width = screen.width;
      centerFrameByHeight(frame, screen);
      break;
    case "fullSquare": {
      side = screen.height <= screen.width ? screen.height : screen.width;
      frame.height = side;
      frame.width = side;
      centerFrame(frame, screen);
      break;
    }
    default:
      centerFrame(frame, screen);
  }

  frame.height = frame.height === 0 ? screen.height : frame.height;
  frame.width = frame.width === 0 ? screen.width : frame.width;

  frame.element.style.height = frame.height + "px";
  frame.element.style.width = frame.width + "px";
}

export default { centerFrame, clearContext, resetContext, resetFrame };
