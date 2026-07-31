#!/usr/bin/env bash
# monitor.sh — watch 2-player PPO training progress
# Usage: watch -n 5 ./monitor.sh   (refresh every 5s)
#    or: while true; do ./monitor.sh; sleep 5; done

set -euo pipefail

STATUS="client/training_status.json"
TOTAL_ITERS=2000
CHECKPOINT_DIR="checkpoints/p2_ppo"

# ── training status ──────────────────────────────────────────
if [[ -f "$STATUS" ]]; then
  iter=$(jq -r '.iter // 0' "$STATUS")
  steps=$(jq -r '.steps // 0' "$STATUS")
  avg_r=$(jq -r '.avg_rew // 0' "$STATUS")
  avg_len=$(jq -r '.avg_len // 0' "$STATUS")
  ent=$(jq -r '.ent // 0' "$STATUS")
  p_loss=$(jq -r '.p_loss // 0' "$STATUS")
  v_loss=$(jq -r '.v_loss // 0' "$STATUS")

  pct=$(echo "scale=1; $iter / $TOTAL_ITERS * 100" | bc)

  # ── bar ────────────────────────────────────────────────────
  bar_width=30
  filled=$(echo "$pct * $bar_width / 100" | bc | cut -d. -f1)
  bar=$(printf "█%.0s" $(seq 1 "$filled"))
  empty=$(printf "░%.0s" $(seq 1 $((bar_width - filled))))

  printf "\033[2J\033[H"  # clear screen
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  PPO Training — 2 players, hid=256, GPU (CUDA)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  printf "  Progress:  %s%s  %s%%  (iter %d / %d)\n" \
    "$bar" "$empty" "$pct" "$iter" "$TOTAL_ITERS"
  echo ""
  printf "  Avg Reward:  %10s\n" "$avg_r"
  printf "  Avg Length:  %10s ticks\n" "$avg_len"
  printf "  Entropy:     %10s\n" "$ent"
  printf "  Policy Loss: %10s\n" "$p_loss"
  printf "  Value Loss:  %10s\n" "$v_loss"
  printf "  Total Steps: %10s\n" "$steps"
  echo ""

  # ── checkpoints ────────────────────────────────────────────
  ckpts=$(find "$CHECKPOINT_DIR" -name "ppo_iter_*.pt" 2>/dev/null | sort -V | tail -3)
  if [[ -n "$ckpts" ]]; then
    echo "  Latest checkpoints:"
    echo "$ckpts" | while read -r f; do
      printf "    %s\n" "$(basename "$f")"
    done
  else
    echo "  Checkpoints:  none yet (first at iter 200)"
  fi
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
  echo "Waiting for training to start... ($STATUS not found)"
fi
