// JSON-line bridge: reads commands from stdin, writes responses to stdout.
// Protocol:
//   → {"type":"reset","players":4}
//   ← {"type":"obs","ships":[...],"starRadius":...}
//   → {"type":"step","actions":[...]}
//   ← {"type":"step_result","obs":...,"rewards":[...],"done":false,"winner":null,"tick":0}
//
// Run: deno run --allow-read --allow-write bridge.ts

import { NWAEnv, type Obs } from "./env.ts";
import type { Action } from "../controller.ts";

const encoder = new TextEncoder();

function respond(obj: unknown): void {
  const line = JSON.stringify(obj) + "\n";
  Deno.stdout.writeSync(encoder.encode(line));
}

async function main(): Promise<void> {
  const buf = new Uint8Array(65536);
  let pos = 0;

  // Read from stdin in a loop
  while (true) {
    const n = await Deno.stdin.read(buf.subarray(pos));
    if (n === null) break; // EOF
    pos += n;

    // Process complete lines
    let start = 0;
    for (let i = 0; i < pos; i++) {
      if (buf[i] === 10) { // '\n'
        const line = new TextDecoder().decode(buf.subarray(start, i));
        start = i + 1;

        if (line.length === 0) continue;

        let msg: { type: string; players?: number; actions?: Action[] };
        try {
          msg = JSON.parse(line);
        } catch {
          respond({ type: "error", message: "invalid json" });
          continue;
        }

        if (msg.type === "reset") {
          const numPlayers = msg.players ?? 4;
          // Re-create env each reset (clean state)
          const env = new NWAEnv(numPlayers, 10_000);
          (globalThis as unknown as Record<string, unknown>)._env = env;
          const obs: Obs = env.reset();
          respond({ type: "obs", ships: obs.ships, starRadius: obs.starRadius });
        } else if (msg.type === "step") {
          const env = (globalThis as unknown as Record<string, unknown>)._env as NWAEnv | undefined;
          if (!env) {
            respond({ type: "error", message: "call reset first" });
            continue;
          }
          const actions: Action[] = msg.actions ?? [];
          const result = env.step(actions);
          respond({
            type: "step_result",
            obs: result.obs,
            rewards: result.rewards,
            done: result.done,
            winner: result.winner,
            tick: result.tick,
          });
        } else {
          respond({ type: "error", message: `unknown command: ${msg.type}` });
        }
      }
    }

    // Compact buffer: move unprocessed tail to front
    if (start > 0 && start < pos) {
      buf.copyWithin(0, start, pos);
      pos -= start;
    } else if (start === pos) {
      pos = 0;
    }
  }
}

if (import.meta.main) main();
