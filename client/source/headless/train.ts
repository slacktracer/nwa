// REINFORCE + baseline training for NWA.
// Neural network from scratch, zero dependencies.
// Multi-binary actions: each of 5 actions per ship is an independent sigmoid.
// Run: deno run --allow-read --allow-write client/source/headless/train.ts

import { NWAEnv, type Obs } from "./env.ts";
import type { Action } from "../controller.ts";

// ── neural network ────────────────────────────────────────

class MLP {
  w1: Float64Array; b1: Float64Array;
  w2: Float64Array; b2: Float64Array;

  constructor(readonly inSize: number, readonly hidSize: number, readonly outSize: number) {
    const s1 = Math.sqrt(2 / inSize), s2 = Math.sqrt(2 / hidSize);
    this.w1 = rand(inSize * hidSize, s1); this.b1 = new Float64Array(hidSize);
    this.w2 = rand(hidSize * outSize, s2); this.b2 = new Float64Array(outSize);
  }

  forward(input: Float64Array): { h: Float64Array; out: Float64Array } {
    const h = new Float64Array(this.hidSize);
    for (let i = 0; i < this.hidSize; i++) {
      let s = this.b1[i];
      for (let j = 0; j < this.inSize; j++) s += this.w1[j * this.hidSize + i] * input[j];
      h[i] = Math.max(0, s);
    }
    const out = new Float64Array(this.outSize);
    for (let i = 0; i < this.outSize; i++) {
      let s = this.b2[i];
      for (let j = 0; j < this.hidSize; j++) s += this.w2[j * this.outSize + i] * h[j];
      out[i] = 1 / (1 + Math.exp(-s));
    }
    return { h, out };
  }

  act(obs: number[]): { probs: Float64Array; actions: Action[] } {
    const { out: p } = this.forward(new Float64Array(obs));
    const acts: Action[] = [];
    for (let s = 0; s < numShips; s++) {
      acts.push({
        thrust:    Math.random() < p[s * 5 + 0],
        turnLeft:  Math.random() < p[s * 5 + 1],
        turnRight: Math.random() < p[s * 5 + 2],
        fire:      Math.random() < p[s * 5 + 3],
        clear:     Math.random() < p[s * 5 + 4],
      });
    }
    return { probs: p, actions: acts };
  }
}

// ── config ────────────────────────────────────────────────

const NUM_SHIPS = 4;
const numShips = NUM_SHIPS;
const OBS_DIM = NUM_SHIPS * 8 + 1; // 33
const ACT_DIM = NUM_SHIPS * 5;     // 20
const HID = 64;
const LR = 3e-4;
const GAMMA = 0.99;
const EPISODES = 64;
const ITERS = 500;

// ── helpers ───────────────────────────────────────────────

function rand(n: number, scale: number): Float64Array {
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * scale;
  return a;
}

function flatObs(obs: Obs): number[] {
  const f: number[] = [];
  for (const s of obs.ships) {
    f.push(s.x / 250, s.y / 250, s.vx, s.vy, s.angle / Math.PI, s.battery, s.missiles, s.alive);
  }
  f.push(obs.starRadius / 60);
  return f;
}

const actionKeys: (keyof Action)[] = ["thrust", "turnLeft", "turnRight", "fire", "clear"];

// ── training ──────────────────────────────────────────────

async function main() {
  const net = new MLP(OBS_DIM, HID, ACT_DIM);

  console.log(`REINFORCE: ships=${NUM_SHIPS} obs=${OBS_DIM} act=${ACT_DIM} hid=${HID}`);
  console.log(`lr=${LR} gamma=${GAMMA} episodes_per_iter=${EPISODES}\n`);

  for (let iter = 0; iter < ITERS; iter++) {
    // ── collect episodes ────────────────────────────────
    const allObs: Float64Array[] = [];
    const allActs: Float64Array[] = [];   // 0/1 per action dim
    const allProbs: Float64Array[] = [];  // old probs
    const allRets: number[] = [];         // discounted returns per timestep

    for (let ep = 0; ep < EPISODES; ep++) {
      const env = new NWAEnv(NUM_SHIPS, 2000);
      let obs = env.reset();
      const epObs: Float64Array[] = [];
      const epActs: Float64Array[] = [];
      const epProbs: Float64Array[] = [];
      const epRewards: number[] = [];

      while (true) {
        const arr = flatObs(obs);
        const { probs, actions } = net.act(arr);
        const result = env.step(actions);

        const actVec = new Float64Array(ACT_DIM);
        for (let s = 0; s < NUM_SHIPS; s++) {
          for (let a = 0; a < 5; a++) {
            actVec[s * 5 + a] = actions[s][actionKeys[a]] ? 1 : 0;
          }
        }

        epObs.push(new Float64Array(arr));
        epActs.push(actVec);
        epProbs.push(probs);
        // Sum rewards across all ships as the step reward
        epRewards.push(result.rewards.reduce((s, r) => s + r, 0));

        obs = result.obs;
        if (result.done) break;
      }

      // Discounted returns
      const T = epRewards.length;
      const rets = new Float64Array(T);
      let running = 0;
      for (let t = T - 1; t >= 0; t--) {
        running = epRewards[t] + GAMMA * running;
        rets[t] = running;
      }

      // Normalize returns within episode
      const mean = rets.reduce((s, v) => s + v, 0) / T;
      const std = Math.sqrt(rets.reduce((s, v) => s + (v - mean) ** 2, 0) / T) || 1;

      for (let t = 0; t < T; t++) {
        allObs.push(epObs[t]);
        allActs.push(epActs[t]);
        allProbs.push(epProbs[t]);
        allRets.push((rets[t] - mean) / std);
      }
    }

    // ── policy gradient update ────────────────────────────
    // Gradient for sigmoid binary action with REINFORCE:
    //   ∂log π(a|s)/∂w = (a - p) * ∂logit/∂w
    //   SGD: w -= lr * (p - a) * advantage * ∂logit/∂w
    // We use the approximation: update each output weight proportionally
    // to hidden activation * (p - a) * advantage.

    const N = allObs.length;
    const gw2 = new Float64Array(HID * ACT_DIM);
    const gb2 = new Float64Array(ACT_DIM);
    const gw1 = new Float64Array(OBS_DIM * HID);
    const gb1 = new Float64Array(HID);

    for (let i = 0; i < N; i++) {
      const { h, out: newP } = net.forward(allObs[i]);
      const oldP = allProbs[i];
      const act = allActs[i];
      const adv = allRets[i];

      for (let o = 0; o < ACT_DIM; o++) {
        // Policy gradient: (p - a) * advantage * sigmoid'(logit) * h
        // sigmoid' = p * (1-p), but for gradient we use (p - a) directly
        const grad = (newP[o] - act[o]) * adv;
        for (let j = 0; j < HID; j++) {
          gw2[j * ACT_DIM + o] += grad * h[j];
        }
        gb2[o] += grad;
      }

      // Backprop to hidden layer
      for (let j = 0; j < HID; j++) {
        let dHidden = 0;
        for (let o = 0; o < ACT_DIM; o++) {
          dHidden += (newP[o] - act[o]) * adv * net.w2[j * ACT_DIM + o];
        }
        // ReLU derivative: 1 if h[j] > 0
        if (h[j] > 0) {
          for (let k = 0; k < OBS_DIM; k++) {
            gw1[k * HID + j] += dHidden * allObs[i][k];
          }
          gb1[j] += dHidden;
        }
      }
    }

    // Apply gradients
    const scale = LR / N;
    for (let i = 0; i < net.w1.length; i++) net.w1[i] -= scale * gw1[i];
    for (let i = 0; i < net.b1.length; i++) net.b1[i] -= scale * gb1[i];
    for (let i = 0; i < net.w2.length; i++) net.w2[i] -= scale * gw2[i];
    for (let i = 0; i < net.b2.length; i++) net.b2[i] -= scale * gb2[i];

    // ── log ──────────────────────────────────────────────
    if (iter % 10 === 0) {
      const avgR = allRets.reduce((s, v) => s + v, 0) / N;
      const avgLen = N / EPISODES;
      console.log(`iter ${String(iter).padStart(4)} | avg_ret=${avgR.toFixed(4)} | avg_len=${avgLen.toFixed(0)} | steps=${N}`);
    }

    if (iter > 0 && iter % 100 === 0) {
      await save(net, `model_${iter}.json`);
    }
  }

  await save(net, "model_final.json");
  console.log("\nDone → model_final.json");
}

async function save(net: MLP, path: string) {
  await Deno.writeTextFile(path, JSON.stringify({
    inSize: net.inSize, hidSize: net.hidSize, outSize: net.outSize,
    w1: [...net.w1], b1: [...net.b1], w2: [...net.w2], b2: [...net.b2],
  }));
  console.log(`  saved ${path}`);
}

if (import.meta.main) main();
