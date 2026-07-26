import entities from "../data/entities.ts";
import { Frame } from "../renderer.ts";
import type { Missile as MissileEntity, Star as StarEntity } from "../data/entities.ts";
import type { PhysicsBody } from "./Physics.ts";
import { Vec2, create, add, scale, copy } from "../../../lib/gl-matrix.ts";
import { applyForce, bind, calculatePullForceFromTo, integrate } from "./Physics.ts";
import { trigger } from "../../utilities/events.ts";

function build(): MissileEntity {
  for (let i = 0; i < entities.missiles.length; i += 1) {
    if (entities.missiles[i].live === false) {
      return entities.missiles[i];
    }
  }

  const missile = entities.templates.missile();
  entities.missiles.push(missile);
  return missile;
}

function deactivate(missile: MissileEntity): void {
  missile.live = false;
}

function drawDetonation(context: CanvasRenderingContext2D, fillStyle: string, position: Vec2): void {
  const innerRadius = 20;
  const outerRadius = 10;
  const spikes = 8;
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

function drawMissile(context: CanvasRenderingContext2D, fillStyle: string, radius: number, position: Vec2): void {
  context.save();
  context.translate(position[0], position[1]);
  context.beginPath();
  context.moveTo(radius, 0);
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fillStyle = fillStyle;
  context.fill();
  context.restore();
}

function launch(
  coreColour: string,
  crashColour: string,
  direction: Vec2,
  owner: string,
  position: Vec2,
  shadowColour: string,
  velocity: Vec2,
): MissileEntity {
  const missile = build();

  missile.collisionData.isColliding = false;
  missile.collisionData.target = false;
  missile.colours.core = coreColour;
  missile.colours.crash = crashColour;
  missile.colours.shadow = shadowColour;
  missile.detonated = false;
  missile.live = true;
  missile.owner = owner;

  add(missile.position, position, scale(create(), direction, 20));
  copy(missile.velocity, velocity);
  applyForce(missile, scale(create(), direction, missile.power));

  return missile;
}

interface UnrenderResult {
  padding: number;
  position: Vec2;
}

function render(
  coreContext: CanvasRenderingContext2D,
  missile: MissileEntity,
  offset: number,
  shadowContext: CanvasRenderingContext2D,
): false | void {
  if (missile.live === false) {
    if (missile.detonated === false) {
      drawDetonation(shadowContext, missile.colours.crash, missile.position);
      missile.detonated = true;
      trigger("detonation", {
        owner: missile.owner,
        target: missile.collisionData.target,
      });
    }
    return false;
  }

  missile.renderPosition = add(create(), missile.position, scale(create(), missile.velocity as Vec2, offset));

  drawMissile(coreContext, missile.colours.core, missile.radius, missile.renderPosition);
  drawMissile(shadowContext, missile.colours.shadow, missile.blastRadius, missile.renderPosition);
}

function unrender(missile: MissileEntity): UnrenderResult {
  return {
    padding: missile.radius + 1,
    position: missile.renderPosition,
  };
}

function update(deltaTime: number, frame: Frame, missile: MissileEntity, star: StarEntity): false | void {
  if (missile.collisionData.isColliding) {
    missile.live = false;
  }

  if (missile.live === false) {
    return false;
  }

  bind(missile, { height: frame.height, width: frame.width });

  const pullForce = calculatePullForceFromTo(star as unknown as PhysicsBody, missile);
  applyForce(missile, pullForce);

  integrate(missile, deltaTime);
}

export default Object.freeze({
  build,
  deactivate,
  launch,
  render,
  unrender,
  update,
});
