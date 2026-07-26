import entities from "../data/entities.ts";
import { Ship as ShipEntity, Star as StarEntity } from "../data/entities.ts";
import { Frame } from "../renderer.ts";
import { Vec2, create, add, scale, copy, length } from "../../../lib/gl-matrix.ts";
import { drain, recharge } from "./Battery.ts";
import { applyForce, bind, calculatePullForceFromTo, getDirectionVector, integrate } from "./Physics.ts";
import type { PhysicsBody } from "./Physics.ts";
import Missile from "./Missile.ts";
const { launch, deactivate } = Missile;
import { render as propulsorRender } from "./Propulsor.ts";
import { trigger } from "../../utilities/events.ts";

function build(configuration: Partial<ShipEntity>, hullCanvas: HTMLCanvasElement, shadowCanvas: HTMLCanvasElement): void {
  const ship = entities.templates.ship() as ShipEntity;

  ship.colours.crash = configuration.colours?.crash ?? ship.colours.crash;
  ship.colours.hull = configuration.colours?.hull ?? ship.colours.hull;
  ship.colours.shadow = configuration.colours?.shadow ?? ship.colours.shadow;
  ship.id = configuration.id ?? ship.id;
  ship.name = configuration.name ?? ship.name;
  ship.position[0] = configuration.position?.[0] ?? ship.position[0];
  ship.position[1] = configuration.position?.[1] ?? ship.position[1];
  ship.propulsor.colours.flame = configuration.propulsor?.colours?.flame ?? ship.propulsor.colours.flame;
  ship.propulsor.colours.shadow = configuration.propulsor?.colours?.shadow ?? ship.propulsor.colours.shadow;
  ship.radians = configuration.radians ?? ship.radians;
  ship.renderPosition[0] = configuration.position?.[0] ?? ship.renderPosition[0];
  ship.renderPosition[1] = configuration.position?.[1] ?? ship.renderPosition[1];
  ship.velocity[0] = configuration.velocity?.[0] ?? ship.velocity[0];
  ship.velocity[1] = configuration.velocity?.[1] ?? ship.velocity[1];

  ship.memory.position[0] = configuration.position?.[0] ?? ship.memory.position[0];
  ship.memory.position[1] = configuration.position?.[1] ?? ship.memory.position[1];
  ship.memory.radians = configuration.radians ?? ship.memory.radians;
  ship.memory.renderPosition[0] = configuration.position?.[0] ?? ship.memory.renderPosition[0];
  ship.memory.renderPosition[1] = configuration.position?.[1] ?? ship.memory.renderPosition[1];
  ship.memory.velocity[0] = configuration.velocity?.[0] ?? ship.memory.velocity[0];
  ship.memory.velocity[1] = configuration.velocity?.[1] ?? ship.memory.velocity[1];

  ship.hull = prerenderHull(hullCanvas, ship);
  ship.shadow = prerenderShadow(shadowCanvas, ship);

  entities.ships.push(ship);
  entities.ships.byId[ship.id] = ship;
}

function drawCrash(context: CanvasRenderingContext2D, fillStyle: string, position: Vec2): void {
  const innerRadius = 20;
  const outerRadius = 30;
  const spikes = 17;
  const step = Math.PI / spikes;

  let rotation = Math.PI / 2 * 3;
  let x = position[0];
  let y = position[1];

  context.beginPath();
  context.moveTo(position[0], position[1] - outerRadius);

  for (let i = 0; i < spikes; i += 1) {
    x = position[0] + Math.cos(rotation) * outerRadius;
    y = position[1] + Math.sin(rotation) * outerRadius;
    context.lineTo(x, y);
    rotation += step;

    x = position[0] + Math.cos(rotation) * innerRadius;
    y = position[1] + Math.sin(rotation) * innerRadius;
    context.lineTo(x, y);
    rotation += step;
  }

  context.lineTo(position[0], position[1] - outerRadius);
  context.closePath();
  context.fillStyle = fillStyle;
  context.fill();
}

function drawShip(context: CanvasRenderingContext2D, fillStyle: string, radius: number): void {
  context.beginPath();
  context.moveTo(radius, 0);
  for (let i = 1; i < 5; i++) {
    context.lineTo(
      radius * Math.cos(-Math.PI * 2 / 6 * i),
      radius * Math.sin(-Math.PI * 2 / 6 * i),
    );
  }
  context.lineTo(0, 0);
  context.closePath();
  context.fillStyle = fillStyle;
  context.fill();
}

function prerenderHull(canvas: HTMLCanvasElement, ship: ShipEntity): HTMLCanvasElement {
  canvas.width = ship.radius * 2;
  canvas.height = ship.radius * 2;
  const context = canvas.getContext("2d")!;
  context.translate(canvas.width / 2, canvas.height / 2);
  drawShip(context, ship.colours.hull, ship.radius);
  return canvas;
}

function prerenderShadow(canvas: HTMLCanvasElement, ship: ShipEntity): HTMLCanvasElement {
  canvas.width = ship.radius * 2;
  canvas.height = ship.radius * 2;
  const context = canvas.getContext("2d")!;
  context.translate(canvas.width / 2, canvas.height / 2);
  drawShip(context, ship.colours.shadow, ship.radius);
  return canvas;
}

function processCommands(deltaTime: number, ship: ShipEntity): void {
  if (ship.commands.anticlockwise) {
    ship.radians -= ship.rotationVelocity * deltaTime;
  }

  if (ship.commands.clockwise) {
    ship.radians += ship.rotationVelocity * deltaTime;
  }

  if (ship.commands.thrust) {
    let energy = drain(ship.battery, 1, true);
    energy /= ship.propulsor.efficiency;

    if (energy > 0) {
      const direction = getDirectionVector(ship.radians);
      applyForce(ship, scale(create(), direction, energy));
      ship.propulsor.active = true;
    } else {
      ship.propulsor.active = false;
    }
  } else {
    ship.propulsor.active = false;
  }

  if (ship.commands.fire) {
    if (ship.weaponsSystem.missiles.live < ship.weaponsSystem.missiles.maximum) {
      const energy = drain(ship.battery, ship.weaponsSystem.missiles.cost, true);
      if (energy) {
        launch(
          ship.colours.hull,
          ship.colours.crash,
          getDirectionVector(ship.radians),
          ship.id,
          ship.position,
          ship.colours.shadow,
          ship.velocity,
        );
        ship.weaponsSystem.missiles.live += 1;
      }
    }
    ship.commands.fire = false;
  }

  if (ship.commands.clear === true) {
    entities.missiles.forEach(function (missile) {
      if (missile.owner === ship.id) {
        deactivate(missile);
      }
    });
    ship.weaponsSystem.missiles.live = 0;
    ship.commands.clear = false;
  }
}

interface UnrenderResult {
  padding: number;
  position: Vec2;
}

export function render(
  hullContext: CanvasRenderingContext2D,
  shadowContext: CanvasRenderingContext2D,
  ship: ShipEntity,
  offset: number,
): false | void {
  if (ship.live === false) {
    if (ship.crashed === false) {
      drawCrash(shadowContext, ship.colours.crash, ship.position);
      trigger("crash", {
        id: ship.id,
        hit: ship.collisionData.hit,
        self: ship.collisionData.self,
      });
      ship.crashed = true;
    }
    return false;
  }

  ship.renderPosition = add(create(), ship.position, scale(create(), ship.velocity as Vec2, offset));

  copy(ship.renderPosition, create(
    Math.round(ship.renderPosition[0]),
    Math.round(ship.renderPosition[1]),
  ));

  hullContext.save();
  hullContext.translate(ship.renderPosition[0], ship.renderPosition[1]);
  hullContext.rotate(ship.radians + Math.PI * 2 / 6 * 2);
  hullContext.drawImage(ship.hull!, -ship.hull!.width / 2, -ship.hull!.height / 2);
  hullContext.restore();

  shadowContext.save();
  shadowContext.translate(ship.renderPosition[0], ship.renderPosition[1]);
  shadowContext.rotate(ship.radians + Math.PI * 2 / 6 * 2);
  shadowContext.drawImage(ship.shadow!, -ship.shadow!.width / 2, -ship.shadow!.height / 2);
  shadowContext.restore();

  if (ship.propulsor.active) {
    propulsorRender(
      ship.propulsor.colours,
      hullContext,
      ship.renderPosition,
      ship.radians,
      shadowContext,
    );
  }
}

export function revive(ship: ShipEntity): void {
  ship.crashed = false;
  ship.collisionData.hit = false;
  ship.collisionData.isColliding = false;
  ship.collisionData.self = false;
  ship.live = true;
  ship.position[0] = ship.memory.position[0];
  ship.position[1] = ship.memory.position[1];
  ship.radians = ship.memory.radians;
  ship.renderPosition[0] = ship.memory.renderPosition[0];
  ship.renderPosition[1] = ship.memory.renderPosition[1];
  ship.velocity[0] = ship.memory.velocity[0];
  ship.velocity[1] = ship.memory.velocity[1];
}

export function unrender(ship: ShipEntity): false | UnrenderResult {
  if (ship.crashed === true) return false;
  return {
    padding: ship.radius + 5,
    position: ship.renderPosition,
  };
}

export function update(deltaTime: number, frame: Frame, ship: ShipEntity, star: StarEntity): void {
  if (ship.collisionData.isColliding) {
    ship.live = false;
  }

  if (ship.live) {
    bind(ship, { height: frame.height, width: frame.width });

    const pullForce = calculatePullForceFromTo(star as unknown as PhysicsBody, ship);
    applyForce(ship, pullForce);
    recharge(ship.battery, star.power * length(pullForce));

    processCommands(deltaTime, ship);

    integrate(ship, deltaTime);
  }
}

export default { build, render, revive, unrender, update };
