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
