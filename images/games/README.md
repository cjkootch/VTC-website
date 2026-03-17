# Caribbean Port Control Sprites

These vessel sprites are stored here for game runtime usage and for other coding agents (including Claude Code) to reference.

## Files
- `cargo-ship.svg`
- `fuel-tanker.svg`
- `speedboat.svg`
- `container-barge.svg`
- `lng-carrier.svg`
- `sprite-manifest.json`

## Integration note
`game.html` loads these SVG assets from `images/games/` and falls back to procedural canvas drawings if any sprite fails to load.

## Claude/Codex path compatibility
If a tool is launched from an environment that expects this repository at `/home/user/VTC-website`, run:

```bash
./scripts/setup-claude-paths.sh
```

Then these absolute paths will resolve:
- `/home/user/VTC-website/images/games/`
- `/home/user/VTC-website/images/games/sprite-manifest.json`

Preferred integration remains using repo-relative paths (for example `images/games/sprite-manifest.json`).
