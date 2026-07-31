#!/usr/bin/env python3
"""
Evolution Strategies trainer for NWA.

ES bypasses the credit-assignment problem by evaluating whole genomes
(parameter vectors) against a direct fitness metric: total reward per episode.
No gradients, no value function, no advantage estimation — just "did this
network win games?"

Algorithm: OpenAI-ES with antithetic sampling.
  Population: 64 perturbed networks per generation.
  Each: play 1 episode, fitness = sum of all ship rewards.
  Update: theta += lr * sum((fitness_pos - fitness_neg) * epsilon) / (N * sigma)

Usage:
  python train_es.py [--pop 64] [--generations 500] [--sigma 0.02] [--lr 0.01]
"""

from __future__ import annotations

import argparse
import json
import math
import multiprocessing as mp
import os
import sys
import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path

import torch
import torch.nn as nn

# Reuse the existing env and network
sys.path.insert(0, str(Path(__file__).resolve().parent))
from env import NWAEnv
from train_gpu import PPONet, Config, flat_obs, tensor_to_actions


# ── ES config ───────────────────────────────────────────────────────────────

@dataclass
class ESConfig:
    num_players: int = 4
    hid_dim: int = 256
    obs_dim: int = 33   # 4 * 8 + 1
    act_dim: int = 20   # 4 * 5

    pop_size: int = 64
    generations: int = 500
    sigma: float = 0.02       # noise std
    lr: float = 0.01           # ES learning rate
    lr_decay: float = 1.0      # multiplicative decay per generation (1.0 = none)
    num_workers: int = 0       # parallel workers (0 = auto-detect)

    episodes_per_eval: int = 1  # episodes per fitness evaluation
    max_episode_steps: int = 2000

    save_interval: int = 50
    log_interval: int = 5
    checkpoint_dir: str = "checkpoints"

    def __post_init__(self):
        self.obs_dim = self.num_players * 8 + 1
        self.act_dim = self.num_players * 5


# ── parameter helpers ──────────────────────────────────────────────────────

def get_params(net: nn.Module) -> torch.Tensor:
    """Flatten all network parameters into a single vector."""
    return nn.utils.parameters_to_vector(net.parameters()).detach()


def set_params(net: nn.Module, vec: torch.Tensor) -> None:
    """Load a flat parameter vector into the network."""
    nn.utils.vector_to_parameters(vec, net.parameters())


def count_params(net: nn.Module) -> int:
    """Return total number of trainable parameters."""
    return sum(p.numel() for p in net.parameters())


# ── fitness evaluation ─────────────────────────────────────────────────────

def _worker_spawn(args: tuple) -> list[float]:
    """Spawn worker: receives (theta, eps, sign, obs_dim, hid_dim, act_dim, num_players)."""
    theta_vec, eps_vec, sign, obs_dim, hid_dim, act_dim, num_players = args

    combined = (theta_vec + eps_vec * sign).contiguous()
    net = PPONet(obs_dim, hid_dim, act_dim)
    nn.utils.vector_to_parameters(combined, net.parameters())

    env = NWAEnv(num_players=num_players)
    total = 0.0
    obs = env.reset()
    done = False
    while not done:
        flat = flat_obs(obs, num_players)
        obs_t = torch.tensor(flat, dtype=torch.float32).unsqueeze(0)
        with torch.no_grad():
            actions_t, _, _ = net.get_action(obs_t)
        actions = tensor_to_actions(actions_t[0], num_players)
        result = env.step(actions)
        total += sum(result.get("rewards", []))
        done = result.get("done", False)
        obs = result["obs"]

    return [total]


@torch.no_grad()
def _eval_cpu(net: PPONet, config: ESConfig) -> float:
    """Run one episode on CPU and return total reward. Net params must be pre-set."""
    env = NWAEnv(num_players=config.num_players)
    total = 0.0
    obs = env.reset()
    done = False
    while not done:
        flat = flat_obs(obs, config.num_players)
        obs_t = torch.tensor(flat, dtype=torch.float32).unsqueeze(0)
        actions_t, _, _ = net.get_action(obs_t)
        actions = tensor_to_actions(actions_t[0], config.num_players)
        result = env.step(actions)
        total += sum(result.get("rewards", []))
        done = result.get("done", False)
        obs = result["obs"]
    return total


# ── ES training loop ────────────────────────────────────────────────────────

def train_es(config: ESConfig) -> None:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    print(f"Population: {config.pop_size}, Generations: {config.generations}")
    print(f"Sigma: {config.sigma}, LR: {config.lr}")
    print(f"Params: {count_params(PPONet(config.obs_dim, config.hid_dim, config.act_dim)):,}")

    # Initialize mean network
    net = PPONet(config.obs_dim, config.hid_dim, config.act_dim).to(device)
    theta = get_params(net)
    n_params = theta.numel()
    print(f"Theta shape: {theta.shape}")

    # Tracking
    fitness_history: deque[float] = deque(maxlen=20)
    best_fitness = -float("inf")
    best_theta = theta.clone()
    total_evals = 0

    # Switch to CPU — GPU is slower for single-sample 33→256→256→20 inference
    theta = theta.cpu().float()
    net = net.cpu()

    for gen in range(1, config.generations + 1):
        t_start = time.time()

        # Generate perturbations
        epsilons = torch.randn(config.pop_size, n_params, dtype=torch.float32) * config.sigma

        fitnesses_pos = torch.zeros(config.pop_size, dtype=torch.float32)
        fitnesses_neg = torch.zeros(config.pop_size, dtype=torch.float32)

        for i in range(config.pop_size):
            eps = epsilons[i]

            set_params(net, theta + eps)
            fitnesses_pos[i] = _eval_cpu(net, config)

            set_params(net, theta - eps)
            fitnesses_neg[i] = _eval_cpu(net, config)

            total_evals += 2

        # ES gradient: (1 / (N * sigma)) * sum((f_pos - f_neg) * eps)
        fitness_diff = fitnesses_pos - fitnesses_neg
        gradient = (fitness_diff @ epsilons) / (config.pop_size * config.sigma)

        # Update
        lr = config.lr * (config.lr_decay ** (gen - 1))
        theta = theta + lr * gradient

        # Track best
        mean_fitness = (fitnesses_pos.mean().item() + fitnesses_neg.mean().item()) / 2
        fitness_history.append(mean_fitness)

        if mean_fitness > best_fitness:
            best_fitness = mean_fitness
            best_theta = theta.clone()

        # Logging
        if gen % config.log_interval == 0:
            elapsed = time.time() - t_start
            avg20 = sum(fitness_history) / len(fitness_history) if fitness_history else 0.0
            print(
                f"gen {gen:4d} | "
                f"fitness={mean_fitness:8.2f} best={best_fitness:8.2f} avg20={avg20:8.2f} | "
                f"f_pos={fitnesses_pos.mean().item():7.2f} f_neg={fitnesses_neg.mean().item():7.2f} | "
                f"lr={lr:.4f} | {elapsed:.1f}s"
            )

            # Write status for dashboard
            os.makedirs(config.checkpoint_dir, exist_ok=True)
            status_path = "client/training_status.json"
            os.makedirs(os.path.dirname(status_path) or ".", exist_ok=True)
            with open(status_path, "w") as f:
                json.dump({
                    "generation": gen, "total_evals": total_evals,
                    "fitness": mean_fitness, "best_fitness": best_fitness,
                    "avg20": avg20,
                }, f)

        # Save checkpoint
        if gen % config.save_interval == 0:
            # Save best model
            set_params(net, best_theta)
            ckpt_path = os.path.join(config.checkpoint_dir, f"es_gen_{gen:04d}.pt")
            os.makedirs(config.checkpoint_dir, exist_ok=True)
            torch.save({
                "generation": gen,
                "theta": best_theta.cpu(),
                "best_fitness": best_fitness,
                "config": {k: v for k, v in config.__dict__.items() if not k.startswith("_")},
            }, ckpt_path)
            print(f"  [checkpoint] saved {ckpt_path}")

            # Export for browser (both paths so game picks it up)
            for p in ("client/es_model_final.json", "client/ppo_model_final.json"):
                os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
                export_for_browser(net, config, p)
            set_params(net, theta)  # restore current mean

    # Final save
    set_params(net, best_theta)
    torch.save({
        "generation": config.generations,
        "theta": best_theta.cpu(),
        "best_fitness": best_fitness,
        "config": {k: v for k, v in config.__dict__.items() if not k.startswith("_")},
    }, os.path.join(config.checkpoint_dir, "es_final.pt"))

    for p in ("client/es_model_final.json", "client/ppo_model_final.json"):
        os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
        export_for_browser(net, config, p)
    print(f"\nDone. Best fitness: {best_fitness:.2f}")


def export_for_browser(net: PPONet, config: ESConfig, path: str) -> None:
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


# ── CLI ────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="ES training for NWA")
    parser.add_argument("--players", type=int, default=4)
    parser.add_argument("--pop", type=int, default=64, help="Population size")
    parser.add_argument("--generations", type=int, default=500, help="Total generations")
    parser.add_argument("--sigma", type=float, default=0.02, help="Noise std dev")
    parser.add_argument("--lr", type=float, default=0.01, help="ES learning rate")
    parser.add_argument("--lr-decay", type=float, default=1.0, help="LR decay per generation")
    parser.add_argument("--hid-dim", type=int, default=256, help="Hidden layer size")
    parser.add_argument("--workers", type=int, default=0, help="Parallel workers (0=auto)")
    parser.add_argument("--checkpoint-dir", type=str, default="checkpoints", help="Checkpoint output directory")
    parser.add_argument("--save-interval", type=int, default=50)
    parser.add_argument("--log-interval", type=int, default=5)
    args = parser.parse_args()

    config = ESConfig(
        num_players=args.players,
        pop_size=args.pop,
        generations=args.generations,
        sigma=args.sigma,
        lr=args.lr,
        lr_decay=args.lr_decay,
        hid_dim=args.hid_dim,
        num_workers=args.workers,
        checkpoint_dir=args.checkpoint_dir,
        save_interval=args.save_interval,
        log_interval=args.log_interval,
    )

    train_es(config)


if __name__ == "__main__":
    main()
