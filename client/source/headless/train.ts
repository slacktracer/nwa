// PPO training for NWA — shared-body network with policy + value heads.
// Run: deno run --allow-read --allow-write client/source/headless/train.ts

import { NWAEnv, type Obs } from "./env.ts";
import type { Action } from "../controller.ts";

// ── network ───────────────────────────────────────────────

class PPONet {
  // Hidden layers
  w1: Float64Array; b1: Float64Array;
  w2: Float64Array; b2: Float64Array;
  // Policy head
  pw: Float64Array; pb: Float64Array;
  // Value head
  vw: Float64Array; vb: Float64Array;

  constructor(readonly inSize: number, readonly hid: number, readonly outSize: number) {
    const s1 = Math.sqrt(2 / inSize), s2 = 1 / Math.sqrt(hid);
    this.w1 = rand(inSize * hid, s1); this.b1 = new Float64Array(hid);
    this.w2 = rand(hid * hid, s2);    this.b2 = new Float64Array(hid);
    this.pw = rand(hid * outSize, 0.01); this.pb = new Float64Array(outSize);
    this.vw = rand(hid, 0.01);        this.vb = new Float64Array(1);
  }

  forward(input: Float64Array): { h1: Float64Array; h2: Float64Array; probs: Float64Array; value: number } {
    const h1 = new Float64Array(this.hid);
    for (let i = 0; i < this.hid; i++) {
      let s = this.b1[i];
      for (let j = 0; j < this.inSize; j++) s += this.w1[j * this.hid + i] * input[j];
      h1[i] = Math.max(0, s);
    }
    const h2 = new Float64Array(this.hid);
    for (let i = 0; i < this.hid; i++) {
      let s = this.b2[i];
      for (let j = 0; j < this.hid; j++) s += this.w2[j * this.hid + i] * h1[j];
      h2[i] = Math.max(0, s);
    }
    const probs = new Float64Array(this.outSize);
    for (let i = 0; i < this.outSize; i++) {
      let s = this.pb[i];
      for (let j = 0; j < this.hid; j++) s += this.pw[j * this.outSize + i] * h2[j];
      probs[i] = 1 / (1 + Math.exp(-s));
    }
    let v = this.vb[0];
    for (let j = 0; j < this.hid; j++) v += this.vw[j] * h2[j];
    return { h1, h2, probs, value: v };
  }

  act(obs: number[]): { probs: Float64Array; value: number; actions: Action[] } {
    const { probs, value } = this.forward(new Float64Array(obs));
    const actions: Action[] = [];
    for (let s = 0; s < NUM_SHIPS; s++) {
      actions.push({
        thrust:    Math.random() < probs[s * 5 + 0],
        turnLeft:  Math.random() < probs[s * 5 + 1],
        turnRight: Math.random() < probs[s * 5 + 2],
        fire:      Math.random() < probs[s * 5 + 3],
        clear:     Math.random() < probs[s * 5 + 4],
      });
    }
    return { probs, value, actions };
  }
}

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

// ── config ────────────────────────────────────────────────

const NUM_SHIPS = 4;
const OBS_DIM = NUM_SHIPS * 8 + 1;
const ACT_DIM = NUM_SHIPS * 5;
const HID = 64;
const LR = 1e-4;
const GAMMA = 0.99;
const LAMBDA = 0.95;
const CLIP = 0.2;
const ENT_COEF = 0.01;
const VF_COEF = 0.5;
const EPISODES = 64;
const PPO_EPOCHS = 4;

// ── main ──────────────────────────────────────────────────

async function main() {
  const net = new PPONet(OBS_DIM, HID, ACT_DIM);

  console.log(`PPO: ships=${NUM_SHIPS} obs=${OBS_DIM} act=${ACT_DIM} hid=${HID}`);
  console.log(`lr=${LR} gamma=${GAMMA} lambda=${LAMBDA} clip=${CLIP} episodes=${EPISODES}\n`);

  for (let iter = 0; iter < 2000; iter++) {
    // ── collect ──────────────────────────────────────────
    const allObs: Float64Array[] = [];
    const allActs: Float64Array[] = [];
    const allOldProbs: Float64Array[] = [];
    const allRewards: number[] = [];
    const allValues: number[] = [];
    const allDones: boolean[] = [];

    let totalSteps = 0;
    let totalEpReward = 0;

    for (let ep = 0; ep < EPISODES; ep++) {
      const env = new NWAEnv(NUM_SHIPS, 2000);
      let obs = env.reset();

      while (true) {
        const arr = flatObs(obs);
        const { probs, value, actions } = net.act(arr);
        const result = env.step(actions);

        const actVec = new Float64Array(ACT_DIM);
        for (let s = 0; s < NUM_SHIPS; s++) {
          for (let a = 0; a < 5; a++) {
            actVec[s * 5 + a] = actions[s][actionKeys[a]] ? 1 : 0;
          }
        }

        const summedReward = result.rewards.reduce((s: number, r: number) => s + r, 0);

        allObs.push(new Float64Array(arr));
        allActs.push(actVec);
        allOldProbs.push(probs);
        allRewards.push(summedReward);
        allValues.push(value);
        allDones.push(result.done);

        totalSteps++;
        totalEpReward += summedReward;

        if (result.done) break;
        obs = result.obs;
      }
    }

    // ── GAE ───────────────────────────────────────────────
    const T = allRewards.length;
    const advantages = new Float64Array(T);
    const returns = new Float64Array(T);
    let gae = 0;
    for (let t = T - 1; t >= 0; t--) {
      const mask = allDones[t] ? 0 : 1;
      const nextVal = t < T - 1 ? allValues[t + 1] : 0;
      const delta = allRewards[t] + GAMMA * nextVal * mask - allValues[t];
      gae = delta + GAMMA * LAMBDA * mask * gae;
      advantages[t] = gae;
      returns[t] = gae + allValues[t];
    }
    // Normalize advantages
    const advMean = advantages.reduce((s, v) => s + v, 0) / T;
    const advStd = Math.sqrt(advantages.reduce((s, v) => s + (v - advMean) ** 2, 0) / T) || 1;

    // ── PPO update ────────────────────────────────────────
    let lastPLoss = 0, lastVLoss = 0, lastEnt = 0;
    for (let epoch = 0; epoch < PPO_EPOCHS; epoch++) {
      // Shuffle indices
      const idx = Array.from({ length: T }, (_, i) => i);
      for (let i = T - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [idx[i], idx[j]] = [idx[j], idx[i]]; }

      let totalPLoss = 0, totalVLoss = 0, totalEnt = 0;

      for (const i of idx) {
        const { probs: newP, value: newV } = net.forward(allObs[i]);
        const oldP = allOldProbs[i];
        const act = allActs[i];
        const adv = (advantages[i] - advMean) / advStd;
        const ret = returns[i];

        // Policy loss: clipped PPO for multi-binary
        let pLoss = 0;
        let ent = 0;
        for (let a = 0; a < ACT_DIM; a++) {
          const pOld = Math.max(oldP[a], 1e-8);
          const pNew = Math.max(newP[a], 1e-8);
          const ratio = act[a] ? (pNew / pOld) : ((1 - pNew) / (1 - pOld));
          const clipped = Math.max(1 - CLIP, Math.min(1 + CLIP, ratio));
          pLoss -= Math.min(ratio * adv, clipped * adv);
          ent -= pNew * Math.log(pNew) + (1 - pNew) * Math.log(1 - pNew);
        }
        pLoss /= ACT_DIM;
        ent /= ACT_DIM;

        // Value loss
        const vLoss = (newV - ret) ** 2;

        totalPLoss += pLoss;
        totalVLoss += vLoss;
        totalEnt += ent;

        // Proper backprop through both heads to hidden layers
        const lr = LR;
        const { h1, h2 } = net.forward(allObs[i]);

        // dh2 = sum of policy head gradient + value head gradient
        const dh2 = new Float64Array(HID);
        for (let a = 0; a < ACT_DIM; a++) {
          const pGrad = (newP[a] - act[a]) * adv / ACT_DIM;
          for (let j = 0; j < HID; j++) dh2[j] += pGrad * net.pw[j * ACT_DIM + a];
        }
        const vGrad = 2 * (newV - ret) * VF_COEF;
        for (let j = 0; j < HID; j++) dh2[j] += vGrad * net.vw[j];

        // Policy head update
        for (let a = 0; a < ACT_DIM; a++) {
          const g = (newP[a] - act[a]) * adv / ACT_DIM;
          for (let j = 0; j < HID; j++) net.pw[j * ACT_DIM + a] -= lr * g * h2[j];
          net.pb[a] -= lr * g;
        }
        // Value head update
        for (let j = 0; j < HID; j++) net.vw[j] -= lr * vGrad * h2[j];
        net.vb[0] -= lr * vGrad;

        // Hidden layer 2: dh2 * ReLU'(h2) back through w2
        const dh1 = new Float64Array(HID);
        for (let j = 0; j < HID; j++) {
          if (h2[j] > 0) {
            for (let k = 0; k < HID; k++) {
              net.w2[k * HID + j] -= lr * dh2[j] * h1[k]; // w2[k][j]
              dh1[k] += dh2[j] * net.w2[k * HID + j];
            }
            net.b2[j] -= lr * dh2[j];
          }
        }
        // Hidden layer 1
        for (let j = 0; j < HID; j++) {
          if (h1[j] > 0) {
            for (let k = 0; k < OBS_DIM; k++) {
              net.w1[k * HID + j] -= lr * dh1[j] * allObs[i][k]; // w1[k][j]
            }
            net.b1[j] -= lr * dh1[j];
          }
        }
      }

      if (epoch === 0 && iter % 10 === 0) {
        console.log(`iter ${String(iter).padStart(4)} | steps=${T} | p_loss=${(totalPLoss / T).toFixed(4)} v_loss=${(totalVLoss / T).toFixed(4)} ent=${(totalEnt / T).toFixed(4)}`);
      }
      lastPLoss = totalPLoss / T;
      lastVLoss = totalVLoss / T;
      lastEnt = totalEnt / T;
    }

    const avgLen = totalSteps / EPISODES;
    const avgRew = totalEpReward / EPISODES;

    if (iter % 10 === 0) {
      console.log(`  → avg_len=${avgLen.toFixed(0)} avg_rew=${avgRew.toFixed(3)}`);
      // Write status for dashboard
      await Deno.writeTextFile("client/training_status.json", JSON.stringify({
        iter, steps: totalSteps, avg_len: avgLen, avg_rew: avgRew,
        p_loss: lastPLoss, v_loss: lastVLoss, ent: lastEnt,
      }));
    }

    if (iter > 0 && iter % 200 === 0) {
      await save(net, `ppo_model_${iter}.json`);
    }
  }

  await save(net, "ppo_model_final.json");
  console.log("\nDone → ppo_model_final.json");
}

async function save(net: PPONet, path: string) {
  await Deno.writeTextFile(path, JSON.stringify({
    inSize: net.inSize, hid: net.hid, outSize: net.outSize,
    w1: [...net.w1], b1: [...net.b1], w2: [...net.w2], b2: [...net.b2],
    pw: [...net.pw], pb: [...net.pb], vw: [...net.vw], vb: [...net.vb],
  }));
  console.log(`  saved ${path}`);
}

if (import.meta.main) main();
