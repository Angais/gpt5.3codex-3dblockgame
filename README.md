# VoxelCraft (Three.js Minecraft Clone)

A detailed Minecraft-style voxel sandbox built in plain HTML/CSS/JavaScript with Three.js.

## Features

- Infinite-ish chunked voxel world streamed around the player
- Deterministic seeded terrain generation
  - Multi-layer noise terrain
  - Biome selection (Plains, Forest, Desert)
  - Caves carved with 3D noise
  - Water level and shore blending
  - Procedural trees
- Custom voxel meshing
  - Per-face culling
  - Separate opaque / cutout / translucent layers
  - Neighbor-aware rebuild when editing blocks
- Minecraft-like first person gameplay
  - Pointer lock mouse look
  - WASD movement, sprint, jump
  - Gravity and AABB collisions against blocks
  - DDA voxel raycast for precise targeting
  - Break/place blocks with mouse
- Procedural texture atlas generated at runtime
  - Pixel textures for grass, dirt, stone, sand, logs, leaves, planks, glass, water, cobble, bucket
  - Nearest-neighbor filtering for crisp voxel style
- Custom decorative block
  - Placeable `Wooden Chair` block with non-cubic voxel model (seat, backrest, legs)
- Water bucket + fluid simulation
  - Placeable source water from hotbar
  - Downward and lateral flow with level decay
  - Basic infinite-source behavior (2 adjacent sources over solid support)
- Redstone systems
  - Redstone dust power levels (0-15) with propagation and decay
  - Repeaters (directional output)
  - Comparators (compare/subtract modes with analog output)
  - Pistons with extension/retraction and push behavior
  - Hard/soft power model through strong and weak signals
- HUD / UX
  - Crosshair
  - Hotbar (1-9 + scroll selection)
  - Selected block label
  - Debug panel with FPS, position, biome, target block, chunk queue
- Atmosphere
  - Dynamic day/night light cycle
  - Fog and sky color transition
- Persistence
  - Block edits saved to `localStorage` and re-applied on load

## File Structure

- `index.html`: app entry + overlay UI
- `style.css`: HUD and screen styling
- `src/config.js`: global constants
- `src/blocks.js`: block registry, rendering metadata, face definitions
- `src/noise.js`: seeded 2D/3D value noise + FBM
- `src/atlas.js`: procedural texture atlas and tile icon generation
- `src/world.js`: chunk generation, meshing, streaming, persistence, raycasting
- `src/player.js`: pointer-lock movement, physics, collisions
- `src/main.js`: app bootstrap, loop, UI, interaction wiring

## Run

You need to serve the folder over HTTP (do not open `index.html` directly with `file://`).

### Option 1: Python

```bash
python3 -m http.server 8000
```

Then open:

- `http://localhost:8000`

### Option 2: Node (if installed)

```bash
npx serve .
```

## Controls

- `WASD`: Move
- `Space`: Jump
- `Shift`: Sprint
- `Mouse`: Look around
- `Left Click`: Break block
- `Right Click`: Place selected block
- `Right Click` on comparator while holding comparator: Toggle compare/subtract mode
- `1-9` or `Mouse Wheel`: Select hotbar block
- `F3`: Toggle debug panel
- `Esc`: Unlock cursor

## Seed

Set a custom world seed via URL query:

- `http://localhost:8000/?seed=myworld`

## Notes

- This clone focuses on core sandbox loop and terrain pipeline.
- It does not yet implement mobs, crafting, inventory grids, hunger, or multiplayer.
