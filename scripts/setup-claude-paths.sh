#!/usr/bin/env bash
set -euo pipefail

# Creates compatibility symlinks for tools that assume /home/user/VTC-website.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_ROOT="/home/user/VTC-website"

mkdir -p /home/user

if [ -e "$TARGET_ROOT" ] && [ ! -L "$TARGET_ROOT" ]; then
  echo "[setup-claude-paths] $TARGET_ROOT exists and is not a symlink; leaving it unchanged."
  echo "[setup-claude-paths] Expected sprites at: $TARGET_ROOT/images/games"
  exit 0
fi

ln -sfn "$REPO_ROOT" "$TARGET_ROOT"

echo "[setup-claude-paths] Linked $TARGET_ROOT -> $REPO_ROOT"
echo "[setup-claude-paths] Sprite manifest path: $TARGET_ROOT/images/games/sprite-manifest.json"
