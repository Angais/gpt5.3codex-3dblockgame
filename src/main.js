import * as THREE from "three";

import {
  BLOCK,
  BLOCK_DEFS,
  HOTBAR_BLOCKS,
  getFaceTextureName,
  isComparator,
  isPiston,
  isRedstoneDust,
  isRepeater,
  isWater,
  makeComparatorId,
  makeDustId,
  makePistonId,
  makeRepeaterId,
} from "./blocks.js";
import { CONFIG } from "./config.js";
import { PlayerController } from "./player.js";
import { VoxelWorld } from "./world.js";

const canvas = document.getElementById("game");
const debugEl = document.getElementById("debug");
const hotbarEl = document.getElementById("hotbar");
const blockNameEl = document.getElementById("block-name");
const startScreenEl = document.getElementById("start-screen");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance",
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.sortObjects = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec5ff);
scene.fog = new THREE.Fog(scene.background, 16, CONFIG.CHUNK_SIZE * (CONFIG.VIEW_DISTANCE + 2.5));

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 1000);

const hemiLight = new THREE.HemisphereLight(0xb8dbff, 0x425e37, 0.65);
scene.add(hemiLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.1);
sunLight.position.set(60, 110, 35);
scene.add(sunLight);

const params = new URLSearchParams(window.location.search);
const seed = params.get("seed") || "voxelcraft";
const world = new VoxelWorld(scene, { seed });

const player = new PlayerController(camera, document.body, world);
scene.add(player.getObject());

const selectionMesh = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005)),
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }),
);
selectionMesh.visible = false;
scene.add(selectionMesh);

const tmpOrigin = new THREE.Vector3();
const tmpDirection = new THREE.Vector3();
const tmpFeet = new THREE.Vector3();

let selectedIndex = 0;
let currentTarget = null;
let debugVisible = true;
let hotbarSlots = [];

let fpsCounter = 0;
let fpsTime = 0;
let fps = 0;

let dayTime = 0.2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getPlacementHorizontalDir() {
  player.controls.getDirection(tmpDirection);
  tmpDirection.y = 0;
  if (tmpDirection.lengthSq() === 0) {
    return 0;
  }
  tmpDirection.normalize();

  if (Math.abs(tmpDirection.x) > Math.abs(tmpDirection.z)) {
    return tmpDirection.x >= 0 ? 1 : 3;
  }
  return tmpDirection.z >= 0 ? 2 : 0;
}

function getPlacementBlockId(selectedBlockId) {
  if (selectedBlockId === BLOCK.WATER) {
    return BLOCK.WATER;
  }
  if (isRedstoneDust(selectedBlockId)) {
    return makeDustId(0);
  }

  const dir = getPlacementHorizontalDir();
  if (isRepeater(selectedBlockId)) {
    return makeRepeaterId(dir, false);
  }
  if (isComparator(selectedBlockId)) {
    return makeComparatorId(dir, false, 0);
  }
  if (isPiston(selectedBlockId)) {
    return makePistonId(dir, false);
  }
  return selectedBlockId;
}

function findSpawnPoint() {
  for (let radius = 0; radius <= 96; radius += 8) {
    for (let z = -radius; z <= radius; z += 8) {
      for (let x = -radius; x <= radius; x += 8) {
        const biome = world.getBiome(x, z);
        const h = world.sampleTerrainHeight(x, z, biome);
        if (h > CONFIG.WATER_LEVEL + 1) {
          return { x, z };
        }
      }
    }
  }

  return { x: 0, z: 0 };
}

function buildHotbar() {
  hotbarEl.innerHTML = "";
  hotbarSlots = [];

  HOTBAR_BLOCKS.forEach((blockId, index) => {
    const slot = document.createElement("button");
    slot.className = "hotbar-slot";
    slot.type = "button";
    slot.dataset.key = String(index + 1);

    const icon = document.createElement("div");
    icon.className = "hotbar-icon";

    const tile = blockId === BLOCK.WATER
      ? "bucket_water"
      : getFaceTextureName(blockId, "top");
    icon.style.backgroundImage = `url(${world.atlas.createIcon(tile, 3)})`;

    slot.append(icon);
    slot.addEventListener("click", () => setSelectedIndex(index));

    hotbarEl.append(slot);
    hotbarSlots.push(slot);
  });

  setSelectedIndex(0);
}

function setSelectedIndex(index) {
  const next = ((index % HOTBAR_BLOCKS.length) + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length;
  selectedIndex = next;

  hotbarSlots.forEach((slot, i) => {
    slot.classList.toggle("selected", i === selectedIndex);
  });

  const selectedBlock = HOTBAR_BLOCKS[selectedIndex];
  const selectedName = selectedBlock === BLOCK.WATER
    ? "Water Bucket"
    : BLOCK_DEFS[selectedBlock].name;
  blockNameEl.textContent = `Selected: ${selectedName}`;
}

function initSpawn() {
  const spawn = findSpawnPoint();
  world.primeAtWorldPosition(spawn.x, spawn.z, 1);
  player.respawn(spawn.x, spawn.z);

  world.update(spawn.x, spawn.z);
}

function updateDayCycle(dt) {
  dayTime = (dayTime + dt / CONFIG.DAY_LENGTH_SECONDS) % 1;
  const angle = dayTime * Math.PI * 2;

  const sunHeight = Math.sin(angle);
  const sunX = Math.cos(angle) * 140;
  const sunZ = Math.sin(angle) * 95;

  sunLight.position.set(sunX, Math.max(-10, sunHeight * 135), sunZ);

  const dayFactor = clamp(sunHeight * 0.55 + 0.45, 0, 1);

  sunLight.intensity = 0.08 + dayFactor * 1.2;
  hemiLight.intensity = 0.2 + dayFactor * 0.7;
  ambientLight.intensity = 0.08 + dayFactor * 0.25;

  const sky = scene.background;
  sky.setRGB(
    lerp(0.03, 0.57, dayFactor),
    lerp(0.04, 0.76, dayFactor),
    lerp(0.09, 0.98, dayFactor),
  );
  scene.fog.color.copy(sky);
}

function updateSelectionTarget() {
  currentTarget = null;
  selectionMesh.visible = false;

  if (!player.isLocked()) {
    return;
  }

  player.getEyePosition(tmpOrigin);
  player.controls.getDirection(tmpDirection);

  const result = world.raycast(tmpOrigin, tmpDirection, CONFIG.RAYCAST_DISTANCE);
  if (!result) {
    return;
  }

  currentTarget = result;
  selectionMesh.visible = true;
  selectionMesh.position.set(
    result.hit.x + 0.5,
    result.hit.y + 0.5,
    result.hit.z + 0.5,
  );
}

function tryBreakBlock() {
  if (!currentTarget) {
    return;
  }

  const { x, y, z } = currentTarget.hit;
  const id = world.getBlock(x, y, z);
  if (id === BLOCK.AIR) {
    return;
  }

  const changed = world.setBlock(x, y, z, BLOCK.AIR);
  if (!changed) {
    return;
  }
  world.processRedstoneUpdates(CONFIG.REDSTONE_UPDATES_PER_FRAME * 2);
  world.processFluidUpdates(CONFIG.WATER_UPDATES_PER_FRAME * 2);
  world.processDirtyChunks(CONFIG.MAX_MESH_REBUILDS_PER_FRAME * 4);
}

function tryPlaceBlock() {
  if (!currentTarget) {
    return;
  }

  const selected = HOTBAR_BLOCKS[selectedIndex];
  if (isComparator(selected) && currentTarget.hit && isComparator(currentTarget.hit.id)) {
    const toggled = world.toggleComparatorMode(
      currentTarget.hit.x,
      currentTarget.hit.y,
      currentTarget.hit.z,
    );
    if (toggled) {
      world.processRedstoneUpdates(CONFIG.REDSTONE_UPDATES_PER_FRAME * 2);
      world.processDirtyChunks(CONFIG.MAX_MESH_REBUILDS_PER_FRAME * 4);
    }
    return;
  }

  const { x, y, z } = currentTarget.adjacent;
  const existing = world.getBlock(x, y, z);
  if (existing !== BLOCK.AIR && !isWater(existing)) {
    return;
  }

  const placeId = getPlacementBlockId(selected);

  if (placeId !== BLOCK.WATER && player.intersectsBlock(x, y, z)) {
    return;
  }

  const placed = world.setBlock(x, y, z, placeId);
  if (!placed) {
    return;
  }

  if (placeId === BLOCK.WATER) {
    world.processFluidUpdates(CONFIG.WATER_UPDATES_PER_FRAME * 3);
  }
  world.processRedstoneUpdates(CONFIG.REDSTONE_UPDATES_PER_FRAME * 2);
  world.processDirtyChunks(CONFIG.MAX_MESH_REBUILDS_PER_FRAME * 4);
}

function updateDebugText() {
  if (!debugVisible) {
    return;
  }

  const eye = player.getEyePosition(tmpOrigin);
  const feet = player.getFeetPosition(tmpFeet);
  const blockBelow = world.getBlock(Math.floor(feet.x), Math.floor(feet.y - 0.2), Math.floor(feet.z));

  const biome = world.getBiomeLabel(Math.floor(feet.x), Math.floor(feet.z));
  const looking = currentTarget ? BLOCK_DEFS[currentTarget.hit.id].name : "None";

  debugEl.textContent = [
    `FPS: ${fps.toFixed(0)}`,
    `Seed: ${seed}`,
    `Pos: ${eye.x.toFixed(2)}, ${eye.y.toFixed(2)}, ${eye.z.toFixed(2)}`,
    `Vel: ${player.velocity.x.toFixed(2)}, ${player.velocity.y.toFixed(2)}, ${player.velocity.z.toFixed(2)}`,
    `Biome: ${biome}`,
    `Standing On: ${BLOCK_DEFS[blockBelow]?.name ?? "Air"}`,
    `Looking At: ${looking}`,
    `Chunks Loaded: ${world.getLoadedChunkCount()}`,
    `Chunk Queue: ${world.pendingChunkGeneration.length}`,
    `Redstone Queue: ${world.redstoneQueue.length}`,
    `Fluid Queue: ${world.fluidQueue.length}`,
    `Time: ${(dayTime * 24).toFixed(2)}h`,
  ].join("\n");
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener("resize", onResize);
window.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener("beforeunload", () => world.saveEditsNow());

window.addEventListener("wheel", (event) => {
  if (!player.isLocked()) {
    return;
  }
  event.preventDefault();
  const dir = event.deltaY > 0 ? 1 : -1;
  setSelectedIndex(selectedIndex + dir);
}, { passive: false });

window.addEventListener("keydown", (event) => {
  if (event.code.startsWith("Digit")) {
    const n = Number(event.code.replace("Digit", ""));
    if (n >= 1 && n <= HOTBAR_BLOCKS.length) {
      setSelectedIndex(n - 1);
    }
    return;
  }

  if (event.code === "F3") {
    event.preventDefault();
    debugVisible = !debugVisible;
    debugEl.style.display = debugVisible ? "block" : "none";
  }
});

window.addEventListener("mousedown", (event) => {
  if (!player.isLocked()) {
    return;
  }

  if (event.button === 0) {
    tryBreakBlock();
  } else if (event.button === 2) {
    tryPlaceBlock();
  }
});

startScreenEl.addEventListener("click", () => player.lock());
canvas.addEventListener("click", () => {
  if (!player.isLocked()) {
    player.lock();
  }
});

player.controls.addEventListener("lock", () => {
  startScreenEl.classList.add("hidden");
});

player.controls.addEventListener("unlock", () => {
  startScreenEl.classList.remove("hidden");
});

buildHotbar();
initSpawn();

let lastTime = performance.now();
let debugTick = 0;

function frame(now) {
  requestAnimationFrame(frame);

  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  fpsCounter += 1;
  fpsTime += dt;
  if (fpsTime >= 0.4) {
    fps = fpsCounter / fpsTime;
    fpsCounter = 0;
    fpsTime = 0;
  }

  player.getFeetPosition(tmpFeet);
  world.update(tmpFeet.x, tmpFeet.z);

  player.update(dt);
  updateSelectionTarget();
  updateDayCycle(dt);

  renderer.render(scene, camera);

  debugTick += dt;
  if (debugTick >= 0.12) {
    updateDebugText();
    debugTick = 0;
  }
}

requestAnimationFrame(frame);
