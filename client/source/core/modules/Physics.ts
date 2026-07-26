import { Vec2, create, add, scale, clone, normalize, negate, distance, set } from "../../../lib/gl-matrix.ts";
import type { Missile, Ship, Star } from "../data/entities.ts";

export interface PhysicsBody {
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
  force: Vec2;
  mass: number;
  radius: number;
}

export interface Boundary {
  height: number;
  width: number;
}

export function applyForce(body: PhysicsBody, force: Vec2): void {
  add(body.force, body.force, force);
}

export function bind(body: PhysicsBody, boundary: Boundary): void {
  if (body.position[0] - body.radius > boundary.width / 2) {
    body.position[0] = -boundary.width / 2 - body.radius;
  }
  if (body.position[0] + body.radius < -boundary.width / 2) {
    body.position[0] = boundary.width / 2 + body.radius;
  }
  if (body.position[1] - body.radius > boundary.height / 2) {
    body.position[1] = -boundary.height / 2 - body.radius;
  }
  if (body.position[1] + body.radius < -boundary.height / 2) {
    body.position[1] = boundary.height / 2 + body.radius;
  }
}

export function calculatePullForceFromTo(from: PhysicsBody, to: PhysicsBody): Vec2 {
  const direction = normalize(create(), clone(to.position));
  negate(direction, direction);
  const dist = distance(from.position, to.position);
  return scale(create(), direction, from.mass * to.mass / Math.pow(dist, 2));
}

export function detectCollisions(missiles: Missile[], ships: Ship[], star: Star): void {
  for (let i = 0; i < ships.length; i += 1) {
    if (ships[i].live) {
      const dist = distance(ships[i].position, star.position);
      if (dist > ships[i].radius + star.radius) {
        for (let j = i + 1; j < ships.length; j += 1) {
          if (ships[j].live) {
            const d = distance(ships[i].position, ships[j].position);
            if (d < ships[i].radius + ships[j].radius - 2) {
              ships[i].collisionData.isColliding = true;
              ships[j].collisionData.isColliding = true;
            }
          }
        }
      } else {
        ships[i].collisionData.isColliding = true;
      }
    }
  }

  for (let i = 0; i < missiles.length; i += 1) {
    if (missiles[i].live) {
      const dist = distance(missiles[i].position, star.position);
      if (dist > missiles[i].radius + star.radius) {
        for (let j = 0; j < ships.length; j += 1) {
          if (ships[j].live && ships[j].collisionData.isColliding === false) {
            const d = distance(missiles[i].position, ships[j].position);
            if (d < missiles[i].radius + ships[j].radius - 2) {
              missiles[i].collisionData.isColliding = true;
              missiles[i].collisionData.target = ships[j].id;
              ships[j].collisionData.isColliding = true;
              ships[j].collisionData.hit = true;
              if (missiles[i].owner === ships[j].id) {
                ships[j].collisionData.self = true;
              }
            }
          }
        }
      } else {
        missiles[i].collisionData.isColliding = true;
      }
    }
  }
}

export function getDirectionVector(radians: number): Vec2 {
  return create(Math.cos(radians), Math.sin(radians));
}

export function integrate(body: PhysicsBody, deltaTime: number): void {
  scale(body.acceleration, body.force, 1 / body.mass);
  scale(body.acceleration, body.acceleration, deltaTime / 2);
  add(body.velocity, body.velocity, body.acceleration);
  add(body.position, body.position, scale(create(), body.velocity, deltaTime));
  add(body.velocity, body.velocity, body.acceleration);
  set(body.acceleration, 0, 0);
  set(body.force, 0, 0);
}

export { create, add, scale, clone, copy, normalize, negate, distance, length } from "../../../lib/gl-matrix.ts";
