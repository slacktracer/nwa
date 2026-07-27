#!/usr/bin/env python3
"""
PPO training script for NWA.

Communicates with a Deno bridge subprocess via stdin/stdout JSON lines.
Uses PyTorch with GPU support when available.

Network architecture:
  Policy: 33 → 64 → 64 → 20  (independent Bernoulli heads, 5 actions × 4 ships)
  Value:  33 → 64 → 64 → 1

Protocol (one JSON object per line):
  Python → bridge: {"type":"reset","players":4}
  bridge → Python: {"type":"obs","ships":[...],"starRadius":...}
  Python → bridge: {"type":"step","actions":[...]}
  bridge → Python: {"type":"step_result","obs":...,"rewards":[...],"done":...,"winner":...,"tick":...}

Usage:
  python train_gpu.py [--deno-path deno] [--bridge-path bridge.ts]
"""

from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim


# ── config ────────────────────────────────────────────────────────────────

@dataclass
class Config:
    num_players: int = 4
    hid_dim: int = 64

    def __post_init__(self):
        self.obs_dim = self.num_players * 8 + 1
        self.act_dim = self.num_players * 5

    lr: float = 3e-4
    gamma: float = 0.99
    gae_lambda: float = 0.95
    clip_epsilon: float = 0.2
    ent_coef: float = 0.01
    vf_coef: float = 0.5
    max_grad_norm: float = 0.5

    episodes_per_iter: int = 64
    ppo_epochs: int = 4
    batch_size: int = 256
    max_episode_steps: int = 2000
    total_iters: int = 2000
    num_workers: int = 4  # parallel bridge processes

    save_interval: int = 200
    log_interval: int = 10
    checkpoint_dir: str = "checkpoints"

    deno_path: str = "deno"
    bridge_path: str = "client/source/headless/bridge.ts"


# ── network ───────────────────────────────────────────────────────────────

class PPONet(nn.Module):
    """Shared-body MLP with separate policy (Bernoulli logits) and value heads."""

    def __init__(self, obs_dim: int, hid_dim: int, act_dim: int):
        super().__init__()
        self.shared = nn.Sequential(
            nn.Linear(obs_dim, hid_dim),
            nn.ReLU(),
            nn.Linear(hid_dim, hid_dim),
            nn.ReLU(),
        )
        self.policy_head = nn.Linear(hid_dim, act_dim)  # logits for Bernoulli
        self.value_head = nn.Linear(hid_dim, 1)

        self._init_weights()

    def _init_weights(self) -> None:
        for mod in self.shared:
            if isinstance(mod, nn.Linear):
                nn.init.orthogonal_(mod.weight, gain=math.sqrt(2))
                nn.init.zeros_(mod.bias)
        nn.init.orthogonal_(self.policy_head.weight, gain=0.01)
        nn.init.zeros_(self.policy_head.bias)
        nn.init.orthogonal_(self.value_head.weight, gain=1.0)
        nn.init.zeros_(self.value_head.bias)

    def forward(self, obs: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """Returns (action_logits, values)."""
        h = self.shared(obs)
        logits = self.policy_head(h)
        values = self.value_head(h)
        return logits, values

    def get_action(
        self, obs: torch.Tensor, deterministic: bool = False
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Sample actions from the policy.

        Returns (actions, log_probs, values).
          actions:  binary tensor [batch, act_dim]
          log_probs: summed log-prob per sample [batch]
          values:    [batch, 1]
        """
        logits, values = self.forward(obs)
        probs = torch.sigmoid(logits)

        if deterministic:
            actions = (probs > 0.5).float()
        else:
            actions = torch.bernoulli(probs)

        # Per-action Bernoulli log-prob → sum across action dim
        log_probs = F.binary_cross_entropy_with_logits(
            logits, actions, reduction="none"
        ).sum(dim=-1)

        return actions, log_probs, values.squeeze(-1)

    def evaluate_actions(
        self, obs: torch.Tensor, actions: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Evaluate given actions against the current policy.

        Returns (log_probs, values, entropy).
          log_probs: summed per-sample [batch]
          values:    [batch]
          entropy:   summed per-sample [batch]
        """
        logits, values = self.forward(obs)
        probs = torch.sigmoid(logits)

        log_probs = F.binary_cross_entropy_with_logits(
            logits, actions, reduction="none"
        ).sum(dim=-1)

        # Binary entropy: -[p*log(p) + (1-p)*log(1-p)]
        entropy = F.binary_cross_entropy_with_logits(
            logits, probs, reduction="none"
        ).sum(dim=-1)

        return log_probs, values.squeeze(-1), entropy


# ── environment bridge ────────────────────────────────────────────────────

class NWABridge:
    """Manages the Deno bridge subprocess."""

    def __init__(self, deno_path: str, bridge_path: str, num_players: int = 4):
        script_dir = Path(__file__).resolve().parent
        bridge_abs = script_dir / bridge_path
        if not bridge_abs.exists():
            # Fall back to resolving from cwd
            bridge_abs = Path(bridge_path).resolve()

        self._proc = subprocess.Popen(
            [deno_path, "run", "--allow-read", "--allow-write", str(bridge_abs)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
        )
        self._num_players = num_players

    def reset(self) -> dict[str, Any]:
        """Reset the environment. Returns the observation dict."""
        self._send({"type": "reset", "players": self._num_players})
        return self._recv()

    def step(self, actions: list[dict[str, bool]]) -> dict[str, Any]:
        """Step the environment with per-ship actions. Returns the step_result dict."""
        self._send({"type": "step", "actions": actions})
        return self._recv()

    def close(self) -> None:
        """Terminate the subprocess."""
        try:
            self._proc.stdin.close()
        except Exception:
            pass
        try:
            self._proc.stdout.close()
        except Exception:
            pass
        self._proc.terminate()
        try:
            self._proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self._proc.kill()
            self._proc.wait()

    def _send(self, obj: dict[str, Any]) -> None:
        line = json.dumps(obj) + "\n"
        self._proc.stdin.write(line)
        self._proc.stdin.flush()

    def _recv(self) -> dict[str, Any]:
        line = self._proc.stdout.readline()
        if not line:
            raise EOFError("Bridge subprocess closed stdout unexpectedly")
        return json.loads(line)


# ── observation helper ────────────────────────────────────────────────────

def flat_obs(obs: dict[str, Any], num_players: int) -> list[float]:
    """Flatten an observation dict into a fixed-size float list."""
    ships = obs.get("ships", [])
    arr: list[float] = []
    for s in ships:
        arr.extend([
            s["x"] / 250.0,
            s["y"] / 250.0,
            s["vx"],
            s["vy"],
            s["angle"] / math.pi,
            s["battery"],
            s["missiles"],
            s["alive"],
        ])
    # Pad if fewer ships than expected
    while len(arr) < num_players * 8:
        arr.extend([0.0] * 8)
    arr.append(obs.get("starRadius", 0.0) / 60.0)
    return arr


ACTION_KEYS = ["thrust", "turnLeft", "turnRight", "fire", "clear"]


def actions_to_tensor(actions: list[dict[str, bool]]) -> torch.Tensor:
    """Convert list of action dicts to a flat binary tensor: [num_players * 5]."""
    flat: list[float] = []
    for a in actions:
        for k in ACTION_KEYS:
            flat.append(1.0 if a.get(k, False) else 0.0)
    return torch.tensor(flat, dtype=torch.float32)


def tensor_to_actions(act_tensor: torch.Tensor, num_players: int) -> list[dict[str, bool]]:
    """Convert a flat binary tensor back to list of action dicts."""
    acts: list[dict[str, bool]] = []
    arr = act_tensor.tolist()
    for s in range(num_players):
        off = s * 5
        acts.append({
            "thrust": bool(arr[off + 0] > 0.5),
            "turnLeft": bool(arr[off + 1] > 0.5),
            "turnRight": bool(arr[off + 2] > 0.5),
            "fire": bool(arr[off + 3] > 0.5),
            "clear": bool(arr[off + 4] > 0.5),
        })
    return acts


# ── PPO buffer ────────────────────────────────────────────────────────────

@dataclass
class RolloutBatch:
    obs: torch.Tensor          # [T, obs_dim]
    actions: torch.Tensor      # [T, act_dim]
    log_probs: torch.Tensor    # [T]
    values: torch.Tensor       # [T]
    rewards: torch.Tensor      # [T]
    dones: torch.Tensor        # [T]


class PPOBuffer:
    def __init__(self, obs_dim: int, act_dim: int, device: torch.device):
        self.device = device
        self.obs: list[torch.Tensor] = []
        self.actions: list[torch.Tensor] = []
        self.log_probs: list[torch.Tensor] = []
        self.values: list[torch.Tensor] = []
        self.rewards: list[torch.Tensor] = []
        self.dones: list[torch.Tensor] = []

    def add(
        self,
        obs: torch.Tensor,
        action: torch.Tensor,
        log_prob: torch.Tensor,
        value: torch.Tensor,
        reward: float,
        done: bool,
    ) -> None:
        self.obs.append(obs.to("cpu"))
        self.actions.append(action.to("cpu"))
        self.log_probs.append(log_prob.to("cpu"))
        self.values.append(value.to("cpu"))
        self.rewards.append(torch.tensor(reward, dtype=torch.float32))
        self.dones.append(torch.tensor(float(done), dtype=torch.float32))

    def get(self) -> RolloutBatch:
        return RolloutBatch(
            obs=torch.stack(self.obs).to(self.device),
            actions=torch.stack(self.actions).to(self.device),
            log_probs=torch.stack(self.log_probs).to(self.device),
            values=torch.stack(self.values).to(self.device),
            rewards=torch.stack(self.rewards).to(self.device),
            dones=torch.stack(self.dones).to(self.device),
        )

    def clear(self) -> None:
        self.obs.clear()
        self.actions.clear()
        self.log_probs.clear()
        self.values.clear()
        self.rewards.clear()
        self.dones.clear()

    def __len__(self) -> int:
        return len(self.obs)


# ── GAE ───────────────────────────────────────────────────────────────────

def compute_gae(
    rewards: torch.Tensor,
    values: torch.Tensor,
    dones: torch.Tensor,
    gamma: float,
    gae_lambda: float,
) -> tuple[torch.Tensor, torch.Tensor]:
    """
    Compute GAE advantages and returns.

    Returns (advantages, returns). Both are [T].
    """
    T = rewards.shape[0]
    advantages = torch.zeros(T, device=rewards.device)
    returns = torch.zeros(T, device=rewards.device)

    gae = 0.0
    for t in reversed(range(T)):
        mask = 0.0 if dones[t] else 1.0
        next_val = values[t + 1] if t < T - 1 else 0.0
        delta = rewards[t] + gamma * next_val * mask - values[t]
        gae = delta + gamma * gae_lambda * mask * gae
        advantages[t] = gae
        returns[t] = gae + values[t]

    return advantages, returns


# ── PPO update ────────────────────────────────────────────────────────────

def ppo_update(
    net: PPONet,
    optimizer: optim.Optimizer,
    batch: RolloutBatch,
    config: Config,
) -> dict[str, float]:
    """Run PPO epochs over the rollout batch. Returns loss stats."""
    advantages, returns = compute_gae(
        batch.rewards, batch.values, batch.dones, config.gamma, config.gae_lambda
    )

    # Normalize advantages
    adv_mean = advantages.mean()
    adv_std = advantages.std() + 1e-8
    advantages = (advantages - adv_mean) / adv_std

    T = batch.obs.shape[0]

    total_p_loss = 0.0
    total_v_loss = 0.0
    total_ent = 0.0

    for _ in range(config.ppo_epochs):
        perm = torch.randperm(T, device=batch.obs.device)

        for start in range(0, T, config.batch_size):
            end = min(start + config.batch_size, T)
            mb_idx = perm[start:end]

            mb_obs = batch.obs[mb_idx]
            mb_actions = batch.actions[mb_idx]
            mb_old_log_probs = batch.log_probs[mb_idx]
            mb_advantages = advantages[mb_idx]
            mb_returns = returns[mb_idx]

            new_log_probs, new_values, entropy = net.evaluate_actions(mb_obs, mb_actions)

            # Policy loss (clipped PPO)
            ratio = torch.exp(new_log_probs - mb_old_log_probs)
            surr1 = ratio * mb_advantages
            surr2 = torch.clamp(ratio, 1.0 - config.clip_epsilon, 1.0 + config.clip_epsilon) * mb_advantages
            p_loss = -torch.min(surr1, surr2).mean()

            # Value loss
            v_loss = F.mse_loss(new_values, mb_returns)

            # Entropy bonus
            ent_loss = -entropy.mean()

            loss = p_loss + config.vf_coef * v_loss + config.ent_coef * ent_loss

            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(net.parameters(), config.max_grad_norm)
            optimizer.step()

            total_p_loss += p_loss.item()
            total_v_loss += v_loss.item()
            total_ent += -ent_loss.item()

    num_updates = config.ppo_epochs * max(1, (T + config.batch_size - 1) // config.batch_size)
    return {
        "p_loss": total_p_loss / num_updates,
        "v_loss": total_v_loss / num_updates,
        "entropy": total_ent / num_updates,
    }


# ── checkpointing ─────────────────────────────────────────────────────────

def save_checkpoint(
    net: PPONet,
    optimizer: optim.Optimizer,
    iteration: int,
    config: Config,
    stats: dict[str, float],
) -> None:
    os.makedirs(config.checkpoint_dir, exist_ok=True)
    path = os.path.join(config.checkpoint_dir, f"ppo_iter_{iteration:04d}.pt")
    torch.save(
        {
            "iteration": iteration,
            "model_state_dict": net.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
            "config": {k: v for k, v in config.__dict__.items() if not k.startswith("_")},
            "stats": stats,
        },
        path,
    )
    print(f"  [checkpoint] saved {path}")


def export_for_browser(net: PPONet, config: Config, path: str) -> None:
    """Export weights as flat JSON arrays for the browser model_loader.ts."""
    sd = net.state_dict()
    w1 = sd["shared.0.weight"].cpu().numpy().T.flatten().tolist()
    b1 = sd["shared.0.bias"].cpu().numpy().tolist()
    w2 = sd["shared.2.weight"].cpu().numpy().T.flatten().tolist()
    b2 = sd["shared.2.bias"].cpu().numpy().tolist()
    pw = sd["policy_head.weight"].cpu().numpy().T.flatten().tolist()
    pb = sd["policy_head.bias"].cpu().numpy().tolist()
    vw = sd["value_head.weight"].cpu().numpy().T.flatten().tolist()
    vb = sd["value_head.bias"].cpu().numpy().tolist()
    data = {
        "inSize": config.obs_dim, "hid": config.hid_dim, "outSize": config.act_dim,
        "w1": w1, "b1": b1, "w2": w2, "b2": b2,
        "pw": pw, "pb": pb, "vw": vw, "vb": vb,
    }
    with open(path, "w") as f:
        json.dump(data, f)
    print(f"  [export] browser model → {path}")


def write_status(iteration: int, steps: int, stats: dict, avg_r: float, avg_len: float, path: str = "client/training_status.json") -> None:
    """Write live status for the training dashboard."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as f:
        json.dump({
            "iter": iteration, "steps": steps,
            "avg_len": avg_len, "avg_rew": avg_r,
            "p_loss": stats.get("p_loss", 0),
            "v_loss": stats.get("v_loss", 0),
            "ent": stats.get("entropy", 0),
        }, f)


def load_checkpoint(
    path: str,
    net: PPONet,
    optimizer: optim.Optimizer | None = None,
) -> tuple[int, dict[str, float]]:
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    net.load_state_dict(ckpt["model_state_dict"])
    if optimizer is not None and "optimizer_state_dict" in ckpt:
        optimizer.load_state_dict(ckpt["optimizer_state_dict"])
    return ckpt.get("iteration", 0), ckpt.get("stats", {})


# ── parallel episode runner ────────────────────────────────────────────────

def _run_episodes_batched(
    bridges: list[NWABridge],
    net: PPONet,
    config: Config,
    device: torch.device,
) -> tuple[list[list[dict[str, Any]]], list[float], list[int]]:
    """Run one episode per bridge in lockstep, batching GPU inference."""
    active = list(range(len(bridges)))
    obs_list: list[dict[str, Any] | None] = [b.reset() for b in bridges]
    all_steps: list[list[dict[str, Any]]] = [[] for _ in bridges]
    all_rewards: list[float] = [0.0] * len(bridges)
    all_lengths: list[int] = [0] * len(bridges)

    for _step in range(config.max_episode_steps):
        if not active:
            break
        # GPU batched inference
        batch_obs = [flat_obs(obs_list[idx], config.num_players) for idx in active]
        obs_t = torch.tensor(batch_obs, dtype=torch.float32, device=device)
        with torch.no_grad():
            actions_t, log_probs_t, values_t = net.get_action(obs_t)

        new_active = []
        for i, idx in enumerate(active):
            actions_dict = tensor_to_actions(actions_t[i], config.num_players)
            result = bridges[idx].step(actions_dict)
            reward = sum(result.get("rewards", []))
            done = result.get("done", False)
            all_steps[idx].append({
                "obs": obs_t[i].cpu(), "actions": actions_t[i].cpu(),
                "log_probs": log_probs_t[i].cpu(), "values": values_t[i].cpu(),
                "reward": reward, "done": done,
            })
            all_rewards[idx] += reward
            all_lengths[idx] += 1
            if not done:
                obs_list[idx] = result["obs"]
                new_active.append(idx)
        active = new_active

    return all_steps, all_rewards, all_lengths


# ── main training loop ────────────────────────────────────────────────────

def train(config: Config) -> None:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    print(f"Workers: {config.num_workers} parallel bridges")
    print(f"Config: obs_dim={config.obs_dim} act_dim={config.act_dim} hid_dim={config.hid_dim}")
    print(f"        lr={config.lr} gamma={config.gamma} lambda={config.gae_lambda}")
    print(f"        clip={config.clip_epsilon} ent_coef={config.ent_coef} vf_coef={config.vf_coef}")
    print(f"        episodes/iter={config.episodes_per_iter} ppo_epochs={config.ppo_epochs} batch={config.batch_size}")
    print(f"        total_iters={config.total_iters} save_interval={config.save_interval}\n")

    net = PPONet(config.obs_dim, config.hid_dim, config.act_dim).to(device)
    optimizer = optim.Adam(net.parameters(), lr=config.lr, eps=1e-5)

    buffer = PPOBuffer(config.obs_dim, config.act_dim, device)
    episode_rewards: deque[float] = deque(maxlen=100)
    episode_lengths: deque[int] = deque(maxlen=100)

    print(f"Starting {config.num_workers} bridge workers...")
    bridges = [NWABridge(config.deno_path, config.bridge_path, config.num_players)
               for _ in range(config.num_workers)]
    print("All bridges ready.\n")

    total_steps = 0

    try:
        for iteration in range(1, config.total_iters + 1):
            buffer.clear()
            iter_steps = 0
            iter_ep_rewards: list[float] = []

            # Run episodes in lockstep batches — GPU inference for each step
            for batch_start in range(0, config.episodes_per_iter, config.num_workers):
                batch_bridges = bridges[:min(config.num_workers, config.episodes_per_iter - batch_start)]
                all_steps, all_rewards, all_lengths = _run_episodes_batched(
                    batch_bridges, net, config, device
                )
                for ep_idx in range(len(batch_bridges)):
                    for s in all_steps[ep_idx]:
                        buffer.add(
                            s["obs"].to(device), s["actions"].to(device),
                            s["log_probs"].to(device), s["values"].to(device),
                            s["reward"], s["done"],
                        )
                    iter_ep_rewards.append(all_rewards[ep_idx])
                    episode_rewards.append(all_rewards[ep_idx])
                    episode_lengths.append(all_lengths[ep_idx])
                    iter_steps += all_lengths[ep_idx]

            total_steps += iter_steps

            # PPO update
            batch = buffer.get()
            stats = ppo_update(net, optimizer, batch, config)

            # Logging
            if iteration % config.log_interval == 0:
                avg_r = sum(iter_ep_rewards) / len(iter_ep_rewards) if iter_ep_rewards else 0.0
                avg_len = iter_steps / config.episodes_per_iter
                last100_r = sum(episode_rewards) / len(episode_rewards) if episode_rewards else 0.0
                print(
                    f"iter {iteration:4d} | steps={total_steps:6d} | "
                    f"p_loss={stats['p_loss']:.4f} v_loss={stats['v_loss']:.4f} "
                    f"ent={stats['entropy']:.4f} | "
                    f"avg_r={avg_r:.3f} avg_len={avg_len:.0f} | "
                    f"last100_r={last100_r:.3f}"
                )
                write_status(iteration, total_steps, stats, avg_r, avg_len)

            # Checkpoint
            if iteration % config.save_interval == 0:
                save_checkpoint(net, optimizer, iteration, config, stats)
                export_for_browser(net, config, "client/ppo_model_final.json")

    except KeyboardInterrupt:
        print("\nInterrupted. Saving checkpoint...")
        save_checkpoint(net, optimizer, 0, config, {"interrupted": True})
    finally:
        for bridge in bridges:
            bridge.close()

    # Final save
    save_checkpoint(net, optimizer, config.total_iters, config, {})
    print("\nDone.")


# ── CLI ───────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="PPO training for NWA")
    parser.add_argument("--deno-path", default="deno", help="Path to deno executable")
    parser.add_argument("--bridge-path", default="bridge.ts", help="Path to bridge.ts (relative to this script)")
    parser.add_argument("--players", type=int, default=4, help="Number of players")
    parser.add_argument("--lr", type=float, default=3e-4, help="Learning rate")
    parser.add_argument("--iters", type=int, default=2000, help="Total training iterations")
    parser.add_argument("--episodes", type=int, default=64, help="Episodes per iteration")
    parser.add_argument("--checkpoint-dir", default="checkpoints", help="Checkpoint output directory")
    parser.add_argument("--save-interval", type=int, default=200, help="Checkpoint save interval")
    parser.add_argument("--num-workers", type=int, default=4, help="Number of parallel bridge workers")
    parser.add_argument("--resume", default=None, help="Resume from checkpoint path")
    args = parser.parse_args()

    config = Config(
        num_players=args.players,
        lr=args.lr,
        total_iters=args.iters,
        episodes_per_iter=args.episodes,
        checkpoint_dir=args.checkpoint_dir,
        save_interval=args.save_interval,
        num_workers=args.num_workers,
        deno_path=args.deno_path,
        bridge_path=args.bridge_path,
    )

    if args.resume:
        print(f"Resuming from {args.resume}...")
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        net = PPONet(config.obs_dim, config.hid_dim, config.act_dim).to(device)
        optimizer = optim.Adam(net.parameters(), lr=config.lr, eps=1e-5)
        load_checkpoint(args.resume, net, optimizer)
        # We would continue training from here — for now this is just checkpoint loading
        print("Checkpoint loaded; use the full train() flow for resumption.")

    train(config)


if __name__ == "__main__":
    main()
