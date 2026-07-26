// Extracted from gl-matrix v2.3.2 — vec2 subset only
// Copyright (c) 2015, Brandon Jones, Colin MacKenzie IV. MIT License.

export type Vec2 = [number, number] | Float32Array;

export function create(): Vec2;
export function create(x: number, y: number): Vec2;
export function create(x?: number, y?: number): Vec2 {
  const out = new Float32Array(2);
  if (x !== undefined) out[0] = x;
  if (y !== undefined) out[1] = y;
  return out as unknown as Vec2;
}

export function clone(a: Vec2): Vec2 {
  const out = new Float32Array(2) as unknown as Vec2;
  out[0] = a[0];
  out[1] = a[1];
  return out;
}

export function copy(out: Vec2, a: Vec2): Vec2 {
  out[0] = a[0];
  out[1] = a[1];
  return out;
}

export function set(out: Vec2, x: number, y: number): Vec2 {
  out[0] = x;
  out[1] = y;
  return out;
}

export function add(out: Vec2, a: Vec2, b: Vec2): Vec2 {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  return out;
}

export function scale(out: Vec2, a: Vec2, b: number): Vec2 {
  out[0] = a[0] * b;
  out[1] = a[1] * b;
  return out;
}

export function negate(out: Vec2, a: Vec2): Vec2 {
  out[0] = -a[0];
  out[1] = -a[1];
  return out;
}

export function normalize(out: Vec2, a: Vec2): Vec2 {
  const len = a[0] * a[0] + a[1] * a[1];
  if (len > 0) {
    const invLen = 1 / Math.sqrt(len);
    out[0] = a[0] * invLen;
    out[1] = a[1] * invLen;
  }
  return out;
}

export function distance(a: Vec2, b: Vec2): number {
  const x = b[0] - a[0];
  const y = b[1] - a[1];
  return Math.sqrt(x * x + y * y);
}

export function length(a: Vec2): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1]);
}
