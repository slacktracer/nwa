import { addEventListener } from "./adapter.ts";

// deno-lint-ignore no-explicit-any
type EventHandler = (eventData: any) => void;

const handlers: Record<string, EventHandler[]> = {};

function listener(eventData: Event | Record<string, unknown>): void {
  const type = (eventData as Record<string, unknown>).type as string;
  for (const eventHandler of handlers[type] ?? []) {
    eventHandler(eventData);
  }
}

export function on(
  eventName: string,
  eventHandler: EventHandler,
  element?: Element,
): void {
  if (!handlers[eventName]) {
    handlers[eventName] = [];
    addEventListener(eventName, listener, element);
  }
  handlers[eventName].push(eventHandler);
}

export function trigger(
  eventName: string,
  eventData: Record<string, unknown>,
): void {
  eventData.type = eventName;
  listener(eventData);
}

export default { on, trigger };
