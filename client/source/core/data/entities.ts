import { deepCopy } from "../../utilities/adapter.ts";
import type { Vec2 } from "../../../lib/gl-matrix.ts";
import gridTemplate from "./templates/grid.ts";
import missileTemplate from "./templates/missile.ts";
import shipTemplate from "./templates/ship.ts";
import starTemplate from "./templates/star.ts";

export type { Vec2 };

export interface CollisionData {
  isColliding: boolean;
  hit?: string | boolean;
  self?: string | boolean;
  target?: string | boolean;
}

export interface Battery {
  level: number;
  maximum: number;
}

export interface Propulsor {
  active: boolean;
  colours: {
    flame: string;
    shadow: string;
  };
  efficiency: number;
}

export interface Missile {
  acceleration: Vec2;
  blastRadius: number;
  collisionData: CollisionData;
  colours: {
    core: string;
    crash: string;
    shadow: string;
  };
  detonated: boolean;
  force: Vec2;
  live: boolean;
  mass: number;
  owner?: string;
  position: Vec2;
  power: number;
  radius: number;
  renderPosition: Vec2;
  velocity: Vec2;
}

export interface ShipTemplate {
  acceleration: Vec2;
  battery: Battery;
  collisionData: CollisionData;
  colours: {
    crash: string;
    hull: string;
    shadow: string;
  };
  commands: {
    anticlockwise: boolean;
    clear: boolean;
    clockwise: boolean;
    fire: boolean;
    thrust: boolean;
  };
  crashed: boolean;
  force: Vec2;
  hull: HTMLCanvasElement | null;
  live: boolean;
  mass: number;
  memory: {
    position: Vec2;
    radians: number;
    renderPosition: Vec2;
    velocity: Vec2;
  };
  name: string;
  position: Vec2;
  propulsor: Propulsor;
  radians: number;
  radius: number;
  renderPosition: Vec2;
  rotationVelocity: number;
  shadow: HTMLCanvasElement | null;
  velocity: Vec2;
  weaponsSystem: {
    missiles: {
      cost: number;
      live: number;
      maximum: number;
    };
  };
}

export interface Ship extends ShipTemplate {
  id: string;
}

export interface Star {
  baseColour: string;
  baseRadius: number;
  colour: string;
  mass: number;
  oscillator: {
    amplitude: number;
    step: number;
    value: number;
  };
  position: Vec2;
  power: number;
  radius: number;
}

export interface Grid {
  colour: string;
  lineWidth: number;
  size: number;
}

interface Entities {
  grid: Grid | null;
  missiles: Missile[];
  ships: Ship[] & { byId: Record<string, Ship> };
  star: Star | null;
  templates: {
    grid(): Grid;
    missile(): Missile;
    ship(): ShipTemplate;
    star(): Star;
  };
}

const entities: Entities = {
  grid: null,
  missiles: [],
  ships: [] as unknown as Ship[] & { byId: Record<string, Ship> },
  star: null,
  templates: {
    grid(): Grid {
      return deepCopy(gridTemplate as Grid);
    },
    missile(): Missile {
      return deepCopy(missileTemplate as Missile);
    },
    ship(): ShipTemplate {
      return deepCopy(shipTemplate as ShipTemplate);
    },
    star(): Star {
      return deepCopy(starTemplate as Star);
    },
  },
};

(entities.ships as Ship[] & { byId: Record<string, Ship> }).byId = {};

export default entities;
