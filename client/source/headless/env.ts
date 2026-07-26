// Headless RL environment for NWA.
// Provides a Gym-style interface: reset(), step().
// No DOM, no rendering — pure state, pure physics.

import entities from "../core/data/entities.ts";
import type { Ship } from "../core/data/entities.ts";
import ships from "../core/data/ships/all.ts";
import { detectCollisions } from "../core/modules/Physics.ts";
import Missile from "../core/modules/Missile.ts";
import { update as shipUpdate } from "../core/modules/Ship.ts";
import { update as starUpdate } from "../core/modules/Star.ts";
import { tinycolor } from "../utilities/adapter.ts";
import type { Frame } from "../core/renderer.ts";

// ── types ────────────────────────────────────────────────

/** One ship's observation vector (flat, no nesting). */
export interface ShipObs {
  x: number;       // position x (world coords, ~[-250, 250])
  y: number;
  vx: number;      // velocity
  vy: number;
  angle: number;   // radians, [0, 2π)
  battery: number; // [0, 1]
  missiles: number; // [0, 1] — live / max
  alive: number;   // 0 or 1
}

export interface Obs {
  ships: ShipObs[];
  starRadius: number; // pulsating, useful for gravity distance
}

/** 5 independent booleans — matches how the keyboard input works. */
export interface Action {
  thrust: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  fire: boolean;
  clear: boolean;
}

export interface StepResult {
  obs: Obs;
  rewards: number[];    // per-ship reward this tick
  done: boolean;
  winner: string | null; // ship id, or null
  tick: number;
}

// ── constants ─────────────────────────────────────────────

const FRAME = { height: 500, width: 500 } as unknown as Frame;
const DELTA_TIME = 16; // ms per tick, same as original looper

const EMPTY_ACTION: Action = {
  thrust: false,
  turnLeft: false,
  turnRight: false,
  fire: false,
  clear: false,
};

const EMPTY_SHIP_OBS: ShipObs = {
  x: 0, y: 0, vx: 0, vy: 0, angle: 0, battery: 0, missiles: 0, alive: 0,
};

// ── reward helper ─────────────────────────────────────────

function shipIndex(id: string): number {
  return parseInt(id.slice(-1), 10) - 1;
}

// ── env ───────────────────────────────────────────────────

export class NWAEnv {
  numPlayers: number;
  maxTicks: number;
  rewards: number[]; // accumulated per-ship rewards this tick
  tick = 0;
  done = false;

  constructor(numPlayers = 2, maxTicks = 10_000) {
    this.numPlayers = Math.min(4, Math.max(2, numPlayers));
    this.maxTicks = maxTicks;
    this.rewards = new Array(this.numPlayers).fill(0);
  }

  // ── public API ──────────────────────────────────────────

  /** Reset the environment. Returns initial observation. */
  reset(): Obs {
    this.tick = 0;
    this.done = false;

    // Clear old state
    entities.missiles.length = 0;
    entities.ships.length = 0;
    (entities.ships as unknown as Record<string, unknown>).byId = {};

    // Build ships (headless — no canvas hull/shadow prerender)
    for (let i = 0; i < this.numPlayers; i += 1) {
      const template = entities.templates.ship();
      const config = ships[i] as Partial<Ship>;

      const ship: Ship = {
        ...template,
        id: config.id ?? `player${i + 1}`,
        name: config.name ?? template.name,
        position: config.position ?? template.position,
        velocity: config.velocity ?? template.velocity,
        radians: config.radians ?? template.radians,
        colours: {
          crash: config.colours?.crash ?? template.colours.crash,
          hull: config.colours?.hull ?? template.colours.hull,
          shadow: config.colours?.shadow ?? template.colours.shadow,
        },
        propulsor: {
          ...template.propulsor,
          colours: {
            flame: config.propulsor?.colours?.flame ?? template.propulsor.colours.flame,
            shadow: config.propulsor?.colours?.shadow ?? template.propulsor.colours.shadow,
          },
        },
        memory: {
          position: [...(config.position ?? template.position)] as [number, number],
          radians: config.radians ?? template.radians,
          renderPosition: [...(config.position ?? template.position)] as [number, number],
          velocity: [...(config.velocity ?? template.velocity)] as [number, number],
        },
        hull: null,
        shadow: null,
      };

      entities.ships.push(ship);
      entities.ships.byId[ship.id] = ship;
    }

    // Build star
    entities.star = entities.templates.star();

    // Build grid (unused in headless but needed for type completeness)
    entities.grid = entities.templates.grid();

    return this._observe();
  }

  /**
   * Advance one tick.
   * @param actions per-ship actions, must match numPlayers.
   */
  step(actions: Action[]): StepResult {
    if (this.done) return this._result();

    // Reset per-tick rewards
    this.rewards.fill(0);

    // Apply actions → ship.commands
    for (let i = 0; i < this.numPlayers; i += 1) {
      const ship = entities.ships[i];
      if (!ship.live) continue;
      const a = actions[i] ?? EMPTY_ACTION;
      ship.commands.anticlockwise = a.turnLeft;
      ship.commands.clockwise = a.turnRight;
      ship.commands.thrust = a.thrust;
      if (a.fire) ship.commands.fire = true;
      if (a.clear) ship.commands.clear = true;
    }

    // Run one physics tick
    this._tick();

    // Scan for death/detonation events (normally triggered in the render functions,
    // which we don't call in headless mode)
    this._collectEvents();

    this.tick += 1;

    // Check termination
    const aliveCount = entities.ships.filter((s) => s.live).length;
    if (aliveCount <= 1 || this.tick >= this.maxTicks) {
      this.done = true;
    }

    return this._result();
  }

  // ── internal ────────────────────────────────────────────

  private _tick(): void {
    starUpdate(DELTA_TIME, entities.star!, this.tick, tinycolor);

    detectCollisions(entities.missiles, entities.ships, entities.star!);

    for (const missile of entities.missiles) {
      Missile.update(DELTA_TIME, FRAME, missile, entities.star!);
    }

    for (const ship of entities.ships) {
      shipUpdate(DELTA_TIME, FRAME, ship, entities.star!);
    }
  }

  /**
   * Replicates the event-driven scoring from dispatcher.ts, headless style.
   * Scans entity state for death/detonation transitions that would normally
   * be triggered in the render path.
   */
  private _collectEvents(): void {
    // Detonations: missiles that just died this tick
    for (const missile of entities.missiles) {
      if (missile.live === false && missile.detonated === false) {
        missile.detonated = true;

        // Decrement owner's live missile count
        const ownerId = missile.owner;
        if (ownerId) {
          const ownerShip = entities.ships.byId[ownerId];
          if (ownerShip) {
            ownerShip.weaponsSystem.missiles.live -= 1;
            if (ownerShip.weaponsSystem.missiles.live < 0) {
              ownerShip.weaponsSystem.missiles.live = 0;
            }
          }
        }

        // Award point if the missile hit a target
        if (missile.collisionData.target && ownerId) {
          this.rewards[shipIndex(ownerId)] += 1;
        }
      }
    }

    // Crashes: ships that just died this tick
    for (const ship of entities.ships) {
      if (ship.live === false && ship.crashed === false) {
        ship.crashed = true;

        const i = shipIndex(ship.id);

        if (ship.collisionData.self) {
          // Self-hit (own missile): the original scoring subtracts an extra
          // point then subtracts 2, net -3. But dispatcher does:
          //   game.score -= 1 (undo the point from the hit)
          //   game.death(id, "self") → -2
          // The point for the hit was already awarded above in the detonation loop.
          // Net: +1 (from detonation) - 1 (undo) - 2 = -2
          this.rewards[i] -= 1; // undo the hit point
          this.rewards[i] -= 2; // death by self
        } else if (ship.collisionData.hit) {
          // Hit by opponent missile
          this.rewards[i] -= 1;
        } else {
          // Hit the star
          this.rewards[i] -= 2;
        }
      }
    }
  }

  private _observe(): Obs {
    const ships: ShipObs[] = [];
    for (let i = 0; i < this.numPlayers; i += 1) {
      const s = entities.ships[i];
      if (s.live) {
        ships.push({
          x: s.position[0],
          y: s.position[1],
          vx: s.velocity[0],
          vy: s.velocity[1],
          angle: s.radians % (Math.PI * 2),
          battery: s.battery.level / s.battery.maximum,
          missiles: s.weaponsSystem.missiles.live / s.weaponsSystem.missiles.maximum,
          alive: 1,
        });
      } else {
        ships.push(EMPTY_SHIP_OBS);
      }
    }

    return {
      ships,
      starRadius: entities.star!.radius,
    };
  }

  private _result(): StepResult {
    let winner: string | null = null;
    if (this.done) {
      const alive = entities.ships.filter((s) => s.live);
      winner = alive.length === 1 ? alive[0].id : null;
    }

    return {
      obs: this._observe(),
      rewards: [...this.rewards],
      done: this.done,
      winner,
      tick: this.tick,
    };
  }
}
