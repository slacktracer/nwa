#!/usr/bin/env python3
"""
Evaluate a trained PPO model: run N episodes and report what the policy actually does.

Usage:
  python eval_model.py [--checkpoint checkpoints/ppo_iter_2000.pt] [--episodes 100] [--seed 42]
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from collections import defaultdict
from pathlib import Path

# Add the headless dir to path so we can import env
sys.path.insert(0, str(Path(__file__).resolve().parent))

import torch

from env import NWAEnv
from train_gpu import PPONet, Config, flat_obs, tensor_to_actions


def load_model(checkpoint_path: str, device: torch.device):
    ckpt = torch.load(checkpoint_path, map_location=device, weights_only=False)
    cfg = ckpt.get("config", {})
    obs_dim = cfg.get("obs_dim", 33)
    hid_dim = cfg.get("hid_dim", 512)
    act_dim = cfg.get("act_dim", 20)

    net = PPONet(obs_dim, hid_dim, act_dim).to(device)
    net.load_state_dict(ckpt["model_state_dict"])
    net.eval()
    return net, obs_dim, hid_dim, act_dim


def run_episodes(net: PPONet, num_players: int, num_episodes: int,
                 device: torch.device, deterministic: bool = False):
    """Run episodes and collect per-component reward stats."""

    # Accumulators
    stats = {
        "survival": 0.0, "distance": 0.0, "hits": 0.0, "deaths": 0.0,
        "fire_count": 0, "total_ticks": 0, "wins": defaultdict(int),
        "death_cause": defaultdict(int),  # "star", "missile", "self", "none"
        "episode_lengths": [],
        "total_rewards": [],
        "per_episode_breakdown": [],
    }

    env = NWAEnv(num_players=num_players)

    for ep in range(num_episodes):
        obs = env.reset()
        done = False
        ep_total = 0.0

        while not done:
            flat = flat_obs(obs, num_players)
            obs_t = torch.tensor(flat, dtype=torch.float32, device=device).unsqueeze(0)

            with torch.no_grad():
                actions_t, _, _ = net.get_action(obs_t, deterministic=deterministic)

            actions = tensor_to_actions(actions_t[0], num_players)
            result = env.step(actions)

            # Count fires
            for a in actions:
                if a.get("fire"):
                    stats["fire_count"] += 1

            done = result.get("done", False)
            obs = result["obs"]

        # Episode finished — collect stats
        breakdown = result.get("reward_breakdown", [])
        ep_surv = sum(b["survival"] for b in breakdown)
        ep_dist = sum(b["distance"] for b in breakdown)
        ep_hits = sum(b["hits"] for b in breakdown)
        ep_deaths = sum(b["deaths"] for b in breakdown)
        ep_total = ep_surv + ep_dist + ep_hits + ep_deaths

        stats["survival"] += ep_surv
        stats["distance"] += ep_dist
        stats["hits"] += ep_hits
        stats["deaths"] += ep_deaths
        stats["total_ticks"] += result.get("tick", 0)
        stats["episode_lengths"].append(result.get("tick", 0))
        stats["total_rewards"].append(ep_total)
        stats["per_episode_breakdown"].append({
            "tick": result.get("tick", 0),
            "winner": result.get("winner"),
            "survival": ep_surv,
            "distance": ep_dist,
            "hits": ep_hits,
            "deaths": ep_deaths,
            "total": ep_total,
        })

        winner = result.get("winner")
        if winner:
            stats["wins"][winner] += 1

        # Determine death causes
        for i, b in enumerate(breakdown):
            if b["deaths"] < 0:
                d = b["deaths"]
                if d <= -3:
                    stats["death_cause"]["self"] += 1
                elif d <= -2:
                    stats["death_cause"]["star"] += 1
                elif d <= -1:
                    stats["death_cause"]["missile"] += 1

    return stats


def print_report(stats: dict, num_episodes: int, num_players: int):
    n = num_episodes

    print("=" * 60)
    print(f"  Model Evaluation — {n} episodes, {num_players} players")
    print("=" * 60)

    print(f"\n── Reward breakdown (average per episode) ──")
    print(f"  Survival bonus:  {stats['survival']/n:8.2f}")
    print(f"  Distance bonus:  {stats['distance']/n:8.2f}")
    print(f"  Hit rewards:     {stats['hits']/n:8.2f}")
    print(f"  Death penalties: {stats['deaths']/n:8.2f}")
    print(f"  ─────────────────────────")
    avg_rew = sum(stats["total_rewards"]) / n
    print(f"  TOTAL:           {avg_rew:8.2f}")

    print(f"\n── Combat stats ──")
    fire_rate = stats["fire_count"] / stats["total_ticks"] / num_players
    print(f"  Fire rate:       {fire_rate:8.4f} per tick per ship")
    print(f"  Hits per episode:{stats['hits']/n:8.2f}")
    hits_per_fire = stats["hits"] / max(1, stats["fire_count"]) * 100
    print(f"  Hit accuracy:    {hits_per_fire:7.1f}%")

    print(f"\n── Death causes ──")
    for cause in ["star", "missile", "self", "none"]:
        count = stats["death_cause"].get(cause, 0)
        print(f"  {cause:>8}:       {count:4d}")

    print(f"\n── Episode stats ──")
    lengths = stats["episode_lengths"]
    print(f"  Avg length:      {sum(lengths)/len(lengths):8.1f} ticks")
    print(f"  Min/Max length:  {min(lengths):4d} / {max(lengths):4d}")

    print(f"\n── Wins ──")
    for pid in sorted(stats["wins"]):
        print(f"  {pid}:  {stats['wins'][pid]:4d} wins ({stats['wins'][pid]/n*100:.1f}%)")
    no_winner = n - sum(stats["wins"].values())
    if no_winner > 0:
        print(f"  (draw/no winner): {no_winner:4d} ({no_winner/n*100:.1f}%)")

    # Diagnostic
    print(f"\n── Diagnostic ──")
    surv_pct = stats["survival"] / max(1, avg_rew * n) * 100
    dist_pct = stats["distance"] / max(1, avg_rew * n) * 100
    hits_pct = stats["hits"] / max(1, avg_rew * n) * 100
    deaths_pct = stats["deaths"] / max(1, avg_rew * n) * 100
    print(f"  Survival is {surv_pct:.0f}% of total reward")
    print(f"  Distance is {dist_pct:.0f}% of total reward")
    print(f"  Hits are    {hits_pct:.1f}% of total reward")
    print(f"  Deaths are  {deaths_pct:.0f}% of total reward")

    if abs(hits_pct) < 0.5:
        print("\n  ⚠  HITS ≈ 0%: The policy never learned to fight.")
        print("     All reward comes from shaped signals (survival/distance).")
        print("     Combat is still random — the gradient never reached the firing actions.")
    elif hits_pct > 5:
        print(f"\n  ✓  Hits are {hits_pct:.0f}% of reward — policy is fighting.")
    else:
        print(f"\n  →  Hits at {hits_pct:.1f}% — some fighting, but shaped rewards dominate.")

    print()


def main():
    parser = argparse.ArgumentParser(description="Evaluate a trained PPO model")
    parser.add_argument("--checkpoint", default="checkpoints/ppo_iter_2000.pt",
                        help="Path to checkpoint")
    parser.add_argument("--episodes", type=int, default=100,
                        help="Number of episodes to run")
    parser.add_argument("--players", type=int, default=4,
                        help="Number of players")
    parser.add_argument("--deterministic", action="store_true",
                        help="Use deterministic actions (argmax instead of sample)")
    parser.add_argument("--seed", type=int, default=None,
                        help="Random seed")
    parser.add_argument("--json", action="store_true",
                        help="Output per-episode breakdown as JSON")
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)
        torch.manual_seed(args.seed)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    print(f"Checkpoint: {args.checkpoint}")
    print(f"Episodes: {args.episodes}, Players: {args.players}")
    print(f"Deterministic: {args.deterministic}\n")

    ckpt_path = Path(args.checkpoint)
    if not ckpt_path.exists():
        print(f"ERROR: checkpoint not found: {args.checkpoint}")
        sys.exit(1)

    net, obs_dim, hid_dim, act_dim = load_model(args.checkpoint, device)
    print(f"Model: obs={obs_dim} hid={hid_dim} act={act_dim}")

    stats = run_episodes(net, args.players, args.episodes, device, args.deterministic)
    print_report(stats, args.episodes, args.players)

    if args.json:
        print(json.dumps(stats["per_episode_breakdown"], indent=2))


if __name__ == "__main__":
    main()
