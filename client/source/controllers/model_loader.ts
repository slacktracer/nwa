// Browser-compatible PPO model loader for NWA.
// Loads a JSON model file and exposes an act() function.

import type { Action } from "../controller.ts";

// Lightweight forward pass (no training code, just inference)
class PolicyNet {
  private w1: Float64Array; private b1: Float64Array;
  private w2: Float64Array; private b2: Float64Array;
  private pw: Float64Array; private pb: Float64Array;

  constructor(data: Record<string, number[]>) {
    this.w1 = new Float64Array(data.w1!); this.b1 = new Float64Array(data.b1!);
    this.w2 = new Float64Array(data.w2!); this.b2 = new Float64Array(data.b2!);
    this.pw = new Float64Array(data.pw!); this.pb = new Float64Array(data.pb!);
  }

  act(input: Float64Array): Float64Array {
    const hid = data => data.w1 ? data.w1.length / data.b1!.length : 64;
    const H = this.b1.length;
    const h1 = new Float64Array(H);
    for (let i = 0; i < H; i++) {
      let s = this.b1[i];
      for (let j = 0; j < input.length; j++) s += this.w1[j * H + i] * input[j];
      h1[i] = Math.max(0, s);
    }
    const h2 = new Float64Array(H);
    for (let i = 0; i < H; i++) {
      let s = this.b2[i];
      for (let j = 0; j < H; j++) s += this.w2[j * H + i] * h1[j];
      h2[i] = Math.max(0, s);
    }
    const out = this.pb.length;
    const probs = new Float64Array(out);
    for (let i = 0; i < out; i++) {
      let s = this.pb[i];
      for (let j = 0; j < H; j++) s += this.pw[j * out + i] * h2[j];
      probs[i] = 1 / (1 + Math.exp(-s));
    }
    return probs;
  }
}

/**
 * Load a trained PPO model and return an action function.
 * Usage:
 *   const act = await loadModel("/ppo_model.json");
 *   const actions = act(observationArray);  // → Action[]
 */
export async function loadModel(url: string): Promise<(obs: number[]) => Action[]> {
  const resp = await fetch(url);
  const data = await resp.json();
  const net = new PolicyNet(data);

  return (obs: number[]): Action[] => {
    const probs = net.act(new Float64Array(obs));
    const actions: Action[] = [];
    const numShips = (data.outSize as number) / 5;
    for (let s = 0; s < numShips; s++) {
      actions.push({
        thrust:    probs[s * 5 + 0] > 0.5,
        turnLeft:  probs[s * 5 + 1] > 0.5,
        turnRight: probs[s * 5 + 2] > 0.5,
        fire:      probs[s * 5 + 3] > 0.5,
        clear:     probs[s * 5 + 4] > 0.5,
      });
    }
    return actions;
  };
}
