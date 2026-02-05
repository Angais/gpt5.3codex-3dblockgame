import * as THREE from "three";

import { createTextureAtlas } from "./atlas.js";
import {
  BLOCK,
  FACES,
  getComparatorDir,
  getComparatorOutput,
  getDustPower,
  getFaceTextureName,
  getFlowingWaterId,
  getHorizontalDirVector,
  getLeftHorizontalDir,
  getOppositeHorizontalDir,
  getPistonDir,
  getPistonHeadDir,
  getRepeaterDir,
  getRightHorizontalDir,
  getBlockDef,
  getWaterLevel,
  isComparator,
  isComparatorSubtract,
  isFlowingWater,
  isOpaqueSolid,
  isPiston,
  isPistonExtended,
  isPistonHead,
  isRedstoneDust,
  isRepeater,
  isRepeaterPowered,
  isWater,
  isWaterSource,
  makeComparatorId,
  makeDustId,
  makePistonHeadId,
  makePistonId,
  makeRepeaterId,
} from "./blocks.js";
import { CONFIG } from "./config.js";
import { ValueNoise, stringToSeed } from "./noise.js";

const BIOME = Object.freeze({
  PLAINS: "plains",
  FOREST: "forest",
  DESERT: "desert",
});

const BIOME_SETTINGS = {
  [BIOME.PLAINS]: {
    surface: BLOCK.GRASS,
    subsurface: BLOCK.DIRT,
    treeChance: 0.04,
    heightOffset: 0,
  },
  [BIOME.FOREST]: {
    surface: BLOCK.GRASS,
    subsurface: BLOCK.DIRT,
    treeChance: 0.085,
    heightOffset: 2,
  },
  [BIOME.DESERT]: {
    surface: BLOCK.SAND,
    subsurface: BLOCK.SAND,
    treeChance: 0,
    heightOffset: -2,
  },
};

const ALL_NEIGHBOR_OFFSETS = Object.freeze([
  Object.freeze({ dx: 1, dy: 0, dz: 0 }),
  Object.freeze({ dx: -1, dy: 0, dz: 0 }),
  Object.freeze({ dx: 0, dy: 1, dz: 0 }),
  Object.freeze({ dx: 0, dy: -1, dz: 0 }),
  Object.freeze({ dx: 0, dy: 0, dz: 1 }),
  Object.freeze({ dx: 0, dy: 0, dz: -1 }),
]);

function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

function parseChunkKey(key) {
  const [cx, cz] = key.split(",").map(Number);
  return { cx, cz };
}

function worldToChunkCoord(value) {
  return Math.floor(value / CONFIG.CHUNK_SIZE);
}

function worldToLocalCoord(value) {
  const m = value % CONFIG.CHUNK_SIZE;
  return m < 0 ? m + CONFIG.CHUNK_SIZE : m;
}

function chunkDistance(aX, aZ, bX, bZ) {
  return Math.max(Math.abs(aX - bX), Math.abs(aZ - bZ));
}

function buildGeometry(buffers) {
  if (buffers.positions.length === 0) {
    return null;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(buffers.positions, 3),
  );
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(buffers.normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(buffers.uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(buffers.colors, 3));
  geometry.setIndex(buffers.indices);
  geometry.computeBoundingSphere();

  return geometry;
}

function shouldRenderFace(blockId, neighborId) {
  if (neighborId === BLOCK.AIR) {
    return true;
  }

  const current = getBlockDef(blockId);
  const neighbor = getBlockDef(neighborId);

  if (current.layer === "translucent") {
    if (isWater(blockId) && isWater(neighborId)) {
      return false;
    }
    if (neighborId === blockId) {
      return false;
    }
    return !(neighbor.solid && !neighbor.transparent);
  }

  if (current.layer === "cutout") {
    if (isRedstoneDust(blockId) && isRedstoneDust(neighborId)) {
      return false;
    }
    if (neighborId === blockId) {
      return false;
    }
    return !(neighbor.solid && !neighbor.transparent);
  }

  return neighbor.transparent || !neighbor.solid;
}

const MODEL_EPS = 1e-4;

function nearlyEqual(a, b) {
  return Math.abs(a - b) <= MODEL_EPS;
}

function rangeContains(containerMin, containerMax, targetMin, targetMax) {
  return containerMin <= targetMin + MODEL_EPS && containerMax >= targetMax - MODEL_EPS;
}

function getFaceCornersForPart(part, faceKey) {
  const { x0, y0, z0, x1, y1, z1 } = part;
  switch (faceKey) {
    case "px":
      return [
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
      ];
    case "nx":
      return [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
      ];
    case "py":
      return [
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
        [x0, y1, z0],
      ];
    case "ny":
      return [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
      ];
    case "pz":
      return [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ];
    case "nz":
      return [
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
      ];
    default:
      return null;
  }
}

function isPartFaceOnBoundary(part, faceKey) {
  switch (faceKey) {
    case "px":
      return nearlyEqual(part.x1, 1);
    case "nx":
      return nearlyEqual(part.x0, 0);
    case "py":
      return nearlyEqual(part.y1, 1);
    case "ny":
      return nearlyEqual(part.y0, 0);
    case "pz":
      return nearlyEqual(part.z1, 1);
    case "nz":
      return nearlyEqual(part.z0, 0);
    default:
      return false;
  }
}

function isPartFaceOccludedBySibling(part, other, faceKey) {
  switch (faceKey) {
    case "px":
      return (
        nearlyEqual(other.x0, part.x1) &&
        rangeContains(other.y0, other.y1, part.y0, part.y1) &&
        rangeContains(other.z0, other.z1, part.z0, part.z1)
      );
    case "nx":
      return (
        nearlyEqual(other.x1, part.x0) &&
        rangeContains(other.y0, other.y1, part.y0, part.y1) &&
        rangeContains(other.z0, other.z1, part.z0, part.z1)
      );
    case "py":
      return (
        nearlyEqual(other.y0, part.y1) &&
        rangeContains(other.x0, other.x1, part.x0, part.x1) &&
        rangeContains(other.z0, other.z1, part.z0, part.z1)
      );
    case "ny":
      return (
        nearlyEqual(other.y1, part.y0) &&
        rangeContains(other.x0, other.x1, part.x0, part.x1) &&
        rangeContains(other.z0, other.z1, part.z0, part.z1)
      );
    case "pz":
      return (
        nearlyEqual(other.z0, part.z1) &&
        rangeContains(other.x0, other.x1, part.x0, part.x1) &&
        rangeContains(other.y0, other.y1, part.y0, part.y1)
      );
    case "nz":
      return (
        nearlyEqual(other.z1, part.z0) &&
        rangeContains(other.x0, other.x1, part.x0, part.x1) &&
        rangeContains(other.y0, other.y1, part.y0, part.y1)
      );
    default:
      return false;
  }
}

function shouldCullPartFace(part, partIndex, modelParts, faceKey) {
  for (let i = 0; i < modelParts.length; i += 1) {
    if (i === partIndex) {
      continue;
    }
    if (isPartFaceOccludedBySibling(part, modelParts[i], faceKey)) {
      return true;
    }
  }
  return false;
}

function intBound(s, ds) {
  if (ds === 0) {
    return Infinity;
  }

  const sFloor = Math.floor(s);
  if (ds > 0) {
    return (sFloor + 1 - s) / ds;
  }
  return (s - sFloor) / -ds;
}

function clampPower(value) {
  return Math.max(0, Math.min(15, value | 0));
}

class VoxelChunk {
  constructor(world, cx, cz) {
    this.world = world;
    this.cx = cx;
    this.cz = cz;
    this.key = chunkKey(cx, cz);

    this.originX = cx * CONFIG.CHUNK_SIZE;
    this.originZ = cz * CONFIG.CHUNK_SIZE;

    this.blocks = new Uint8Array(CONFIG.CHUNK_SIZE * CONFIG.CHUNK_SIZE * CONFIG.WORLD_HEIGHT);
    this.generated = false;

    this.meshOpaque = null;
    this.meshCutout = null;
    this.meshTranslucent = null;
  }

  index(lx, y, lz) {
    return y * CONFIG.CHUNK_SIZE * CONFIG.CHUNK_SIZE + lz * CONFIG.CHUNK_SIZE + lx;
  }

  get(lx, y, lz) {
    if (
      lx < 0 ||
      lx >= CONFIG.CHUNK_SIZE ||
      lz < 0 ||
      lz >= CONFIG.CHUNK_SIZE ||
      y < 0 ||
      y >= CONFIG.WORLD_HEIGHT
    ) {
      return BLOCK.AIR;
    }
    return this.blocks[this.index(lx, y, lz)];
  }

  set(lx, y, lz, id) {
    if (
      lx < 0 ||
      lx >= CONFIG.CHUNK_SIZE ||
      lz < 0 ||
      lz >= CONFIG.CHUNK_SIZE ||
      y < 0 ||
      y >= CONFIG.WORLD_HEIGHT
    ) {
      return;
    }
    this.blocks[this.index(lx, y, lz)] = id;
  }

  setIfReplaceable(lx, y, lz, id) {
    const current = this.get(lx, y, lz);
    if (current === BLOCK.AIR || isWater(current) || current === BLOCK.LEAVES) {
      this.set(lx, y, lz, id);
    }
  }

  generate() {
    for (let lx = 0; lx < CONFIG.CHUNK_SIZE; lx += 1) {
      const wx = this.originX + lx;
      for (let lz = 0; lz < CONFIG.CHUNK_SIZE; lz += 1) {
        const wz = this.originZ + lz;

        const biome = this.world.getBiome(wx, wz);
        const biomeSettings = BIOME_SETTINGS[biome.type];
        const terrainHeight = this.world.sampleTerrainHeight(wx, wz, biome);

        const nearWater = terrainHeight <= CONFIG.WATER_LEVEL + 1;
        const surfaceBlock = nearWater ? BLOCK.SAND : biomeSettings.surface;
        const subsurfaceBlock = nearWater ? BLOCK.SAND : biomeSettings.subsurface;

        for (let y = 0; y <= terrainHeight; y += 1) {
          let block = BLOCK.STONE;
          if (y === terrainHeight) {
            block = surfaceBlock;
          } else if (y >= terrainHeight - 3) {
            block = subsurfaceBlock;
          }

          if (
            y > 3 &&
            y < terrainHeight - 2 &&
            this.world.sampleCave(wx, y, wz) > 0.52 + (y / CONFIG.WORLD_HEIGHT) * 0.2
          ) {
            continue;
          }

          this.set(lx, y, lz, block);
        }

        if (terrainHeight < CONFIG.WATER_LEVEL) {
          for (let y = terrainHeight + 1; y <= CONFIG.WATER_LEVEL; y += 1) {
            this.set(lx, y, lz, BLOCK.WATER);
          }
        }

        if (
          biomeSettings.treeChance > 0 &&
          surfaceBlock === BLOCK.GRASS &&
          terrainHeight > CONFIG.WATER_LEVEL + 1 &&
          lx > 2 &&
          lx < CONFIG.CHUNK_SIZE - 3 &&
          lz > 2 &&
          lz < CONFIG.CHUNK_SIZE - 3
        ) {
          const treeRand = this.world.randomAt(wx, wz, 99);
          if (treeRand > 1 - biomeSettings.treeChance) {
            this.placeTree(lx, terrainHeight + 1, lz, treeRand);
          }
        }
      }
    }

    this.generated = true;
  }

  placeTree(lx, baseY, lz, seedValue) {
    const trunkHeight = 4 + Math.floor(seedValue * 3);

    for (let i = 0; i < trunkHeight; i += 1) {
      this.setIfReplaceable(lx, baseY + i, lz, BLOCK.LOG);
    }

    const canopyStart = baseY + trunkHeight - 2;
    for (let dy = 0; dy <= 3; dy += 1) {
      const radius = dy === 3 ? 1 : 2;
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dz = -radius; dz <= radius; dz += 1) {
          const dist = dx * dx + dz * dz;
          if (dist > radius * radius + (dy === 0 ? 1 : 0)) {
            continue;
          }

          const leafX = lx + dx;
          const leafY = canopyStart + dy;
          const leafZ = lz + dz;
          if (this.world.randomAt(leafX + this.originX, leafZ + this.originZ, leafY + 77) > 0.12) {
            this.setIfReplaceable(leafX, leafY, leafZ, BLOCK.LEAVES);
          }
        }
      }
    }

    this.setIfReplaceable(lx, baseY + trunkHeight, lz, BLOCK.LEAVES);
  }

  buildMeshes() {
    this.disposeMeshes();

    const opaque = {
      positions: [],
      normals: [],
      uvs: [],
      colors: [],
      indices: [],
      vertexCount: 0,
    };
    const cutout = {
      positions: [],
      normals: [],
      uvs: [],
      colors: [],
      indices: [],
      vertexCount: 0,
    };
    const translucent = {
      positions: [],
      normals: [],
      uvs: [],
      colors: [],
      indices: [],
      vertexCount: 0,
    };

    const layers = {
      opaque,
      cutout,
      translucent,
    };

    for (let y = 0; y < CONFIG.WORLD_HEIGHT; y += 1) {
      for (let lz = 0; lz < CONFIG.CHUNK_SIZE; lz += 1) {
        for (let lx = 0; lx < CONFIG.CHUNK_SIZE; lx += 1) {
          const blockId = this.get(lx, y, lz);
          if (blockId === BLOCK.AIR) {
            continue;
          }

          const def = getBlockDef(blockId);
          if (def.layer === "empty") {
            continue;
          }

          const target = layers[def.layer];
          const wx = this.originX + lx;
          const wz = this.originZ + lz;

          if (Array.isArray(def.modelParts) && def.modelParts.length > 0) {
            this.pushCustomBlockFaces(target, blockId, wx, y, wz, lx, lz, def.modelParts);
            continue;
          }

          for (const face of FACES) {
            const nx = wx + face.dir[0];
            const ny = y + face.dir[1];
            const nz = wz + face.dir[2];
            const neighborId = this.world.getBlock(nx, ny, nz);
            if (!shouldRenderFace(blockId, neighborId)) {
              continue;
            }

            const tileName = getFaceTextureName(blockId, face.uvFace);
            const uv = this.world.atlas.getUV(tileName);
            this.pushFace(target, lx, y, lz, face, uv, blockId);
          }
        }
      }
    }

    const geometryOpaque = buildGeometry(opaque);
    if (geometryOpaque) {
      this.meshOpaque = new THREE.Mesh(geometryOpaque, this.world.materials.opaque);
      this.meshOpaque.position.set(this.originX, 0, this.originZ);
      this.world.chunkGroup.add(this.meshOpaque);
    }

    const geometryCutout = buildGeometry(cutout);
    if (geometryCutout) {
      this.meshCutout = new THREE.Mesh(geometryCutout, this.world.materials.cutout);
      this.meshCutout.position.set(this.originX, 0, this.originZ);
      this.world.chunkGroup.add(this.meshCutout);
    }

    const geometryTranslucent = buildGeometry(translucent);
    if (geometryTranslucent) {
      this.meshTranslucent = new THREE.Mesh(
        geometryTranslucent,
        this.world.materials.translucent,
      );
      this.meshTranslucent.position.set(this.originX, 0, this.originZ);
      this.world.chunkGroup.add(this.meshTranslucent);
    }
  }

  pushCustomBlockFaces(buffers, blockId, wx, y, wz, lx, lz, modelParts) {
    for (let partIndex = 0; partIndex < modelParts.length; partIndex += 1) {
      const part = modelParts[partIndex];

      for (const face of FACES) {
        if (shouldCullPartFace(part, partIndex, modelParts, face.key)) {
          continue;
        }

        if (isPartFaceOnBoundary(part, face.key)) {
          const nx = wx + face.dir[0];
          const ny = y + face.dir[1];
          const nz = wz + face.dir[2];
          const neighborId = this.world.getBlock(nx, ny, nz);
          if (!shouldRenderFace(blockId, neighborId)) {
            continue;
          }
        }

        const corners = getFaceCornersForPart(part, face.key);
        if (!corners) {
          continue;
        }

        const tileName = getFaceTextureName(blockId, face.uvFace);
        const uv = this.world.atlas.getUV(tileName);
        this.pushFace(buffers, lx, y, lz, face, uv, blockId, corners);
      }
    }
  }

  pushFace(buffers, lx, y, lz, face, uv, blockId, corners = face.corners) {
    const base = buffers.vertexCount;
    const waterLevel = getWaterLevel(blockId) ?? 0;
    const waterTopY = Math.max(0.24, 0.88 - waterLevel * 0.08);

    for (let i = 0; i < 4; i += 1) {
      const corner = corners[i];
      const vx = lx + corner[0];
      let vy = y + corner[1];
      const vz = lz + corner[2];

      if (isWater(blockId) && face.key === "py" && corner[1] >= 1 - MODEL_EPS) {
        vy = y + waterTopY;
      }

      buffers.positions.push(vx, vy, vz);
      buffers.normals.push(face.normal[0], face.normal[1], face.normal[2]);

      const shade = face.shade;
      if (isWater(blockId)) {
        buffers.colors.push(shade * 0.8, shade * 0.9, shade);
      } else if (blockId === BLOCK.LEAVES) {
        buffers.colors.push(shade * 0.88, shade, shade * 0.88);
      } else {
        buffers.colors.push(shade, shade, shade);
      }
    }

    buffers.uvs.push(uv.u1, uv.v0, uv.u0, uv.v0, uv.u0, uv.v1, uv.u1, uv.v1);
    buffers.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    buffers.vertexCount += 4;
  }

  disposeMeshes() {
    const dispose = (mesh) => {
      if (!mesh) {
        return;
      }
      this.world.chunkGroup.remove(mesh);
      mesh.geometry.dispose();
    };

    dispose(this.meshOpaque);
    dispose(this.meshCutout);
    dispose(this.meshTranslucent);

    this.meshOpaque = null;
    this.meshCutout = null;
    this.meshTranslucent = null;
  }

  dispose() {
    this.disposeMeshes();
  }
}

export class VoxelWorld {
  constructor(scene, { seed = "voxelcraft" } = {}) {
    this.scene = scene;
    this.seedString = seed;
    this.seed = stringToSeed(seed);
    this.noise = new ValueNoise(this.seed);

    this.atlas = createTextureAtlas(this.seed);

    this.materials = {
      opaque: new THREE.MeshLambertMaterial({
        map: this.atlas.texture,
        vertexColors: true,
      }),
      cutout: new THREE.MeshLambertMaterial({
        map: this.atlas.texture,
        vertexColors: true,
        transparent: true,
        alphaTest: 0.5,
      }),
      translucent: new THREE.MeshLambertMaterial({
        map: this.atlas.texture,
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      }),
    };

    this.chunkGroup = new THREE.Group();
    this.scene.add(this.chunkGroup);

    this.chunks = new Map();
    this.pendingChunkGeneration = [];
    this.pendingChunkSet = new Set();
    this.dirtyChunks = new Set();
    this.fluidQueue = [];
    this.fluidQueued = new Set();
    this.redstoneQueue = [];
    this.redstoneQueued = new Set();
    this.editsByChunk = new Map();

    this.centerChunkX = 0;
    this.centerChunkZ = 0;

    this.saveTimer = null;
    this.loadEdits();
  }

  randomAt(x, z, salt = 0) {
    return this.noise.hash3(x + salt * 17, z - salt * 31, salt * 53);
  }

  getBiome(wx, wz) {
    const temperature =
      this.noise.fbm2(wx * 0.00135 + 100, wz * 0.00135 - 250, {
        octaves: 4,
        frequency: 1,
      }) *
        0.5 +
      0.5;

    const moisture =
      this.noise.fbm2(wx * 0.0015 - 400, wz * 0.0015 + 920, {
        octaves: 5,
        frequency: 1,
      }) *
        0.5 +
      0.5;

    let type = BIOME.PLAINS;
    if (temperature > 0.58 && moisture < 0.42) {
      type = BIOME.DESERT;
    } else if (moisture > 0.58) {
      type = BIOME.FOREST;
    }

    return { type, temperature, moisture };
  }

  sampleTerrainHeight(wx, wz, biome = this.getBiome(wx, wz)) {
    const continental =
      this.noise.fbm2(wx * 0.0009, wz * 0.0009, {
        octaves: 5,
        frequency: 1,
      }) *
        0.5 +
      0.5;

    const mountains = Math.pow(
      Math.max(
        0,
        this.noise.fbm2(wx * 0.0024 + 500, wz * 0.0024 - 900, {
          octaves: 4,
          frequency: 1,
        }) *
          0.5 +
          0.5,
      ),
      2.25,
    );

    const erosion =
      this.noise.fbm2(wx * 0.0042 - 75, wz * 0.0042 + 44, {
        octaves: 3,
        frequency: 1,
      }) *
        0.5 +
      0.5;

    const detail =
      this.noise.fbm2(wx * 0.022, wz * 0.022, {
        octaves: 3,
        frequency: 1,
      }) *
        0.5 +
      0.5;

    const biomeOffset = BIOME_SETTINGS[biome.type].heightOffset;
    const rawHeight =
      CONFIG.WATER_LEVEL -
      6 +
      continental * 23 +
      mountains * 29 +
      (erosion - 0.5) * 9 +
      (detail - 0.5) * 5 +
      biomeOffset;

    const height = Math.floor(rawHeight);
    return Math.max(6, Math.min(CONFIG.WORLD_HEIGHT - 8, height));
  }

  sampleCave(wx, y, wz) {
    const a = this.noise.fbm3(wx * 0.045, y * 0.045, wz * 0.045, {
      octaves: 3,
      frequency: 1,
    });
    const b = this.noise.fbm3(wx * 0.09 + 200, y * 0.09 - 140, wz * 0.09 + 90, {
      octaves: 2,
      frequency: 1,
    });
    return a * 0.72 + b * 0.28;
  }

  getChunk(cx, cz) {
    return this.chunks.get(chunkKey(cx, cz));
  }

  hasChunk(cx, cz) {
    return this.chunks.has(chunkKey(cx, cz));
  }

  generateChunkNow(cx, cz) {
    const key = chunkKey(cx, cz);
    if (this.chunks.has(key)) {
      return this.chunks.get(key);
    }

    const chunk = new VoxelChunk(this, cx, cz);
    chunk.generate();
    this.chunks.set(key, chunk);
    const { fluidSeeds, redstoneSeeds } = this.applyEditsToChunk(chunk);
    for (const seed of fluidSeeds) {
      this.enqueueFluidNeighbors(seed.x, seed.y, seed.z);
    }
    for (const seed of redstoneSeeds) {
      this.enqueueRedstoneNeighbors(seed.x, seed.y, seed.z);
    }

    this.markChunkDirty(cx, cz);
    this.markChunkDirty(cx + 1, cz);
    this.markChunkDirty(cx - 1, cz);
    this.markChunkDirty(cx, cz + 1);
    this.markChunkDirty(cx, cz - 1);

    return chunk;
  }

  queueChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    if (this.chunks.has(key) || this.pendingChunkSet.has(key)) {
      return;
    }

    this.pendingChunkSet.add(key);
    this.pendingChunkGeneration.push({ cx, cz, key });
  }

  primeAtWorldPosition(x, z, radius = 1) {
    const centerX = worldToChunkCoord(x);
    const centerZ = worldToChunkCoord(z);

    const targets = [];
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        targets.push({
          cx: centerX + dx,
          cz: centerZ + dz,
          d: chunkDistance(0, 0, dx, dz),
        });
      }
    }

    targets.sort((a, b) => a.d - b.d);

    for (const target of targets) {
      this.generateChunkNow(target.cx, target.cz);
    }

    this.flushMeshQueue();
  }

  flushMeshQueue() {
    while (this.dirtyChunks.size > 0) {
      this.processDirtyChunks(this.dirtyChunks.size);
    }
  }

  requestChunksAroundWorldPosition(x, z) {
    const centerX = worldToChunkCoord(x);
    const centerZ = worldToChunkCoord(z);

    this.centerChunkX = centerX;
    this.centerChunkZ = centerZ;

    const needed = new Set();
    const targets = [];

    for (let dz = -CONFIG.VIEW_DISTANCE; dz <= CONFIG.VIEW_DISTANCE; dz += 1) {
      for (let dx = -CONFIG.VIEW_DISTANCE; dx <= CONFIG.VIEW_DISTANCE; dx += 1) {
        const cx = centerX + dx;
        const cz = centerZ + dz;
        const key = chunkKey(cx, cz);
        needed.add(key);

        if (!this.chunks.has(key) && !this.pendingChunkSet.has(key)) {
          targets.push({ cx, cz, d: chunkDistance(0, 0, dx, dz) });
        }
      }
    }

    targets.sort((a, b) => a.d - b.d);
    for (const target of targets) {
      this.queueChunk(target.cx, target.cz);
    }

    for (const [key, chunk] of this.chunks.entries()) {
      if (needed.has(key)) {
        continue;
      }

      const { cx, cz } = parseChunkKey(key);
      const d = chunkDistance(cx, cz, centerX, centerZ);
      if (d > CONFIG.UNLOAD_DISTANCE) {
        chunk.dispose();
        this.chunks.delete(key);
      }
    }

    for (let i = this.pendingChunkGeneration.length - 1; i >= 0; i -= 1) {
      const pending = this.pendingChunkGeneration[i];
      const d = chunkDistance(pending.cx, pending.cz, centerX, centerZ);
      if (d > CONFIG.UNLOAD_DISTANCE + 1) {
        this.pendingChunkSet.delete(pending.key);
        this.pendingChunkGeneration.splice(i, 1);
      }
    }
  }

  processChunkGeneration(limit = CONFIG.CHUNK_GEN_PER_FRAME) {
    let generated = 0;
    while (generated < limit && this.pendingChunkGeneration.length > 0) {
      const next = this.pendingChunkGeneration.shift();
      this.pendingChunkSet.delete(next.key);

      const d = chunkDistance(next.cx, next.cz, this.centerChunkX, this.centerChunkZ);
      if (d > CONFIG.UNLOAD_DISTANCE + 1) {
        continue;
      }

      this.generateChunkNow(next.cx, next.cz);
      generated += 1;
    }
  }

  markChunkDirty(cx, cz) {
    const key = chunkKey(cx, cz);
    if (!this.chunks.has(key)) {
      return;
    }
    this.dirtyChunks.add(key);
  }

  processDirtyChunks(limit = CONFIG.MAX_MESH_REBUILDS_PER_FRAME) {
    let processed = 0;

    while (processed < limit && this.dirtyChunks.size > 0) {
      const key = this.dirtyChunks.values().next().value;
      this.dirtyChunks.delete(key);
      const chunk = this.chunks.get(key);
      if (!chunk) {
        continue;
      }
      chunk.buildMeshes();
      processed += 1;
    }
  }

  update(playerX, playerZ) {
    this.requestChunksAroundWorldPosition(playerX, playerZ);
    this.processChunkGeneration();
    this.processFluidUpdates();
    this.processRedstoneUpdates();
    this.processDirtyChunks();
  }

  getBlock(x, y, z) {
    if (y < 0 || y >= CONFIG.WORLD_HEIGHT) {
      return BLOCK.AIR;
    }

    const cx = worldToChunkCoord(x);
    const cz = worldToChunkCoord(z);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) {
      return BLOCK.AIR;
    }

    const lx = worldToLocalCoord(x);
    const lz = worldToLocalCoord(z);
    return chunk.get(lx, y, lz);
  }

  setBlock(x, y, z, id, {
    saveEdit = true,
    updateFluids = true,
    updateRedstone = true,
  } = {}) {
    if (y < 0 || y >= CONFIG.WORLD_HEIGHT) {
      return false;
    }

    const cx = worldToChunkCoord(x);
    const cz = worldToChunkCoord(z);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) {
      return false;
    }

    const lx = worldToLocalCoord(x);
    const lz = worldToLocalCoord(z);
    const old = chunk.get(lx, y, lz);
    if (old === id) {
      return false;
    }

    chunk.set(lx, y, lz, id);
    this.markChunkDirty(cx, cz);

    if (lx === 0) this.markChunkDirty(cx - 1, cz);
    if (lx === CONFIG.CHUNK_SIZE - 1) this.markChunkDirty(cx + 1, cz);
    if (lz === 0) this.markChunkDirty(cx, cz - 1);
    if (lz === CONFIG.CHUNK_SIZE - 1) this.markChunkDirty(cx, cz + 1);

    if (saveEdit) {
      this.recordEdit(cx, cz, lx, y, lz, id);
    }

    if (updateFluids) {
      this.enqueueFluidNeighbors(x, y, z);
    }

    if (updateRedstone) {
      this.enqueueRedstoneNeighbors(x, y, z);
    }

    return true;
  }

  createFluidKey(x, y, z) {
    return `${x},${y},${z}`;
  }

  enqueueFluidUpdate(x, y, z) {
    if (y < 0 || y >= CONFIG.WORLD_HEIGHT) {
      return;
    }

    const cx = worldToChunkCoord(x);
    const cz = worldToChunkCoord(z);
    if (!this.hasChunk(cx, cz)) {
      return;
    }

    const key = this.createFluidKey(x, y, z);
    if (this.fluidQueued.has(key)) {
      return;
    }

    this.fluidQueued.add(key);
    this.fluidQueue.push({ x, y, z, key });
  }

  enqueueFluidNeighbors(x, y, z) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 2) {
            continue;
          }
          this.enqueueFluidUpdate(x + dx, y + dy, z + dz);
        }
      }
    }
  }

  isFluidSupportBlock(id) {
    const def = getBlockDef(id);
    return def.solid && !def.liquid;
  }

  canWaterOccupyCell(id) {
    return id === BLOCK.AIR || isFlowingWater(id);
  }

  shouldCreateWaterSource(x, y, z) {
    if (!this.isFluidSupportBlock(this.getBlock(x, y - 1, z))) {
      return false;
    }

    let adjacentSources = 0;
    if (isWaterSource(this.getBlock(x + 1, y, z))) adjacentSources += 1;
    if (isWaterSource(this.getBlock(x - 1, y, z))) adjacentSources += 1;
    if (isWaterSource(this.getBlock(x, y, z + 1))) adjacentSources += 1;
    if (isWaterSource(this.getBlock(x, y, z - 1))) adjacentSources += 1;

    return adjacentSources >= 2;
  }

  computeDesiredWaterLevel(x, y, z) {
    const current = this.getBlock(x, y, z);
    if (!this.canWaterOccupyCell(current)) {
      return null;
    }

    const aboveId = this.getBlock(x, y + 1, z);
    if (isWater(aboveId)) {
      return 0;
    }

    let minNeighborLevel = Infinity;
    const neighborOffsets = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    for (const [dx, dz] of neighborOffsets) {
      const nx = x + dx;
      const nz = z + dz;
      const neighborId = this.getBlock(nx, y, nz);
      if (!isWater(neighborId)) {
        continue;
      }

      const belowNeighborId = this.getBlock(nx, y - 1, nz);
      const aboveNeighborId = this.getBlock(nx, y + 1, nz);
      const donorSupported =
        this.isFluidSupportBlock(belowNeighborId) ||
        isWaterSource(neighborId) ||
        isWater(aboveNeighborId);

      if (!donorSupported) {
        continue;
      }

      const neighborLevel = getWaterLevel(neighborId);
      if (neighborLevel !== null) {
        minNeighborLevel = Math.min(minNeighborLevel, neighborLevel);
      }
    }

    if (minNeighborLevel === Infinity) {
      return null;
    }

    const nextLevel = minNeighborLevel + 1;
    if (nextLevel > 7) {
      return null;
    }
    return nextLevel;
  }

  updateWaterAt(x, y, z) {
    const current = this.getBlock(x, y, z);
    if (current === BLOCK.WATER) {
      return;
    }

    if (!this.canWaterOccupyCell(current)) {
      return;
    }

    const desiredLevel = this.computeDesiredWaterLevel(x, y, z);
    let targetId = BLOCK.AIR;

    if (desiredLevel !== null) {
      targetId = this.shouldCreateWaterSource(x, y, z)
        ? BLOCK.WATER
        : getFlowingWaterId(desiredLevel);
    }

    if (current === targetId) {
      return;
    }

    this.setBlock(x, y, z, targetId, {
      saveEdit: false,
      updateFluids: false,
      updateRedstone: false,
    });
    this.enqueueFluidNeighbors(x, y, z);
  }

  processFluidUpdates(limit = CONFIG.WATER_UPDATES_PER_FRAME) {
    let processed = 0;

    while (processed < limit && this.fluidQueue.length > 0) {
      const node = this.fluidQueue.shift();
      this.fluidQueued.delete(node.key);

      const cx = worldToChunkCoord(node.x);
      const cz = worldToChunkCoord(node.z);
      if (!this.hasChunk(cx, cz)) {
        continue;
      }

      this.updateWaterAt(node.x, node.y, node.z);
      processed += 1;
    }
  }

  createRedstoneKey(x, y, z) {
    return `${x},${y},${z}`;
  }

  enqueueRedstoneUpdate(x, y, z) {
    if (y < 0 || y >= CONFIG.WORLD_HEIGHT) {
      return;
    }

    const cx = worldToChunkCoord(x);
    const cz = worldToChunkCoord(z);
    if (!this.hasChunk(cx, cz)) {
      return;
    }

    const key = this.createRedstoneKey(x, y, z);
    if (this.redstoneQueued.has(key)) {
      return;
    }

    this.redstoneQueued.add(key);
    this.redstoneQueue.push({ x, y, z, key });
  }

  enqueueRedstoneNeighbors(x, y, z) {
    this.enqueueRedstoneUpdate(x, y, z);
    for (const offset of ALL_NEIGHBOR_OFFSETS) {
      this.enqueueRedstoneUpdate(x + offset.dx, y + offset.dy, z + offset.dz);
    }
  }

  getDirectSignalFromBlock(sourceId, sx, sy, sz, tx, ty, tz) {
    const dx = tx - sx;
    const dy = ty - sy;
    const dz = tz - sz;

    if (sourceId === BLOCK.REDSTONE_BLOCK) {
      return { weak: 15, strong: 15 };
    }

    if (isRedstoneDust(sourceId)) {
      const power = getDustPower(sourceId);
      if (power <= 0) {
        return { weak: 0, strong: 0 };
      }

      const manhattan = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
      if (manhattan !== 1) {
        return { weak: 0, strong: 0 };
      }

      if (dy === 0 || dy === -1) {
        return { weak: power, strong: 0 };
      }
      return { weak: 0, strong: 0 };
    }

    if (isRepeater(sourceId)) {
      if (!isRepeaterPowered(sourceId)) {
        return { weak: 0, strong: 0 };
      }
      const dir = getRepeaterDir(sourceId);
      const front = getHorizontalDirVector(dir);
      if (dy === 0 && dx === front.dx && dz === front.dz) {
        return { weak: 15, strong: 15 };
      }
      return { weak: 0, strong: 0 };
    }

    if (isComparator(sourceId)) {
      const out = getComparatorOutput(sourceId);
      if (out <= 0) {
        return { weak: 0, strong: 0 };
      }
      const dir = getComparatorDir(sourceId);
      const front = getHorizontalDirVector(dir);
      if (dy === 0 && dx === front.dx && dz === front.dz) {
        return { weak: out, strong: out };
      }
      return { weak: 0, strong: 0 };
    }

    return { weak: 0, strong: 0 };
  }

  getStrongPowerAt(x, y, z) {
    let power = 0;
    for (const offset of ALL_NEIGHBOR_OFFSETS) {
      const sx = x + offset.dx;
      const sy = y + offset.dy;
      const sz = z + offset.dz;
      const sourceId = this.getBlock(sx, sy, sz);
      if (sourceId === BLOCK.AIR) {
        continue;
      }
      const signal = this.getDirectSignalFromBlock(sourceId, sx, sy, sz, x, y, z);
      power = Math.max(power, signal.strong);
      if (power >= 15) {
        return 15;
      }
    }
    return power;
  }

  isHardPoweredBlock(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (!isOpaqueSolid(id)) {
      return false;
    }
    return this.getStrongPowerAt(x, y, z) > 0;
  }

  getSignalFromSourceToTarget(sx, sy, sz, tx, ty, tz) {
    const sourceId = this.getBlock(sx, sy, sz);
    if (sourceId === BLOCK.AIR) {
      return 0;
    }

    const signal = this.getDirectSignalFromBlock(sourceId, sx, sy, sz, tx, ty, tz);
    let power = Math.max(signal.weak, signal.strong);

    if (isOpaqueSolid(sourceId) && this.isHardPoweredBlock(sx, sy, sz)) {
      power = Math.max(power, 15);
    }

    return power;
  }

  getComponentInputSignal(x, y, z, sourceDx, sourceDy, sourceDz) {
    const sx = x + sourceDx;
    const sy = y + sourceDy;
    const sz = z + sourceDz;
    return this.getSignalFromSourceToTarget(sx, sy, sz, x, y, z);
  }

  updateDustAt(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (!isRedstoneDust(id)) {
      return;
    }

    let nextPower = 0;

    for (const offset of ALL_NEIGHBOR_OFFSETS) {
      const nx = x + offset.dx;
      const ny = y + offset.dy;
      const nz = z + offset.dz;
      const neighborId = this.getBlock(nx, ny, nz);

      if (isRedstoneDust(neighborId)) {
        nextPower = Math.max(nextPower, getDustPower(neighborId) - 1);
      } else {
        nextPower = Math.max(nextPower, this.getSignalFromSourceToTarget(nx, ny, nz, x, y, z));
      }
    }

    const nextId = makeDustId(clampPower(nextPower));
    if (nextId === id) {
      return;
    }

    this.setBlock(x, y, z, nextId, {
      saveEdit: false,
      updateFluids: false,
      updateRedstone: false,
    });
    this.enqueueRedstoneNeighbors(x, y, z);
  }

  updateRepeaterAt(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (!isRepeater(id)) {
      return;
    }

    const dir = getRepeaterDir(id);
    const backDir = getOppositeHorizontalDir(dir);
    const back = getHorizontalDirVector(backDir);
    const input = this.getComponentInputSignal(x, y, z, back.dx, 0, back.dz);
    const nextId = makeRepeaterId(dir, input > 0);

    if (nextId === id) {
      return;
    }

    this.setBlock(x, y, z, nextId, {
      saveEdit: false,
      updateFluids: false,
      updateRedstone: false,
    });
    this.enqueueRedstoneNeighbors(x, y, z);
  }

  updateComparatorAt(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (!isComparator(id)) {
      return;
    }

    const dir = getComparatorDir(id);
    const backDir = getOppositeHorizontalDir(dir);
    const leftDir = getLeftHorizontalDir(dir);
    const rightDir = getRightHorizontalDir(dir);

    const back = getHorizontalDirVector(backDir);
    const left = getHorizontalDirVector(leftDir);
    const right = getHorizontalDirVector(rightDir);

    const rearInput = this.getComponentInputSignal(x, y, z, back.dx, 0, back.dz);
    const sideInput = Math.max(
      this.getComponentInputSignal(x, y, z, left.dx, 0, left.dz),
      this.getComponentInputSignal(x, y, z, right.dx, 0, right.dz),
    );

    const subtract = isComparatorSubtract(id);
    const output = subtract
      ? clampPower(rearInput - sideInput)
      : (rearInput >= sideInput ? clampPower(rearInput) : 0);

    const nextId = makeComparatorId(dir, subtract, output);
    if (nextId === id) {
      return;
    }

    this.setBlock(x, y, z, nextId, {
      saveEdit: false,
      updateFluids: false,
      updateRedstone: false,
    });
    this.enqueueRedstoneNeighbors(x, y, z);
  }

  toggleComparatorMode(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (!isComparator(id)) {
      return false;
    }

    const dir = getComparatorDir(id);
    const subtract = !isComparatorSubtract(id);
    const output = getComparatorOutput(id);
    const nextId = makeComparatorId(dir, subtract, output);

    const changed = this.setBlock(x, y, z, nextId, {
      saveEdit: true,
      updateFluids: false,
      updateRedstone: false,
    });
    if (changed) {
      this.enqueueRedstoneNeighbors(x, y, z);
    }
    return changed;
  }

  isPistonPowered(x, y, z, dir) {
    const front = getHorizontalDirVector(dir);
    for (const offset of ALL_NEIGHBOR_OFFSETS) {
      if (offset.dy === 0 && offset.dx === front.dx && offset.dz === front.dz) {
        continue;
      }

      const sx = x + offset.dx;
      const sy = y + offset.dy;
      const sz = z + offset.dz;
      if (this.getSignalFromSourceToTarget(sx, sy, sz, x, y, z) > 0) {
        return true;
      }
    }
    return false;
  }

  canPistonMoveBlock(id) {
    if (id === BLOCK.AIR || isWater(id)) {
      return false;
    }
    if (isPistonHead(id)) {
      return false;
    }
    if (isPiston(id) && isPistonExtended(id)) {
      return false;
    }
    return true;
  }

  tryExtendPiston(x, y, z, dir) {
    const front = getHorizontalDirVector(dir);

    const chain = [];
    let cx = x + front.dx;
    let cy = y;
    let cz = z + front.dz;

    for (let i = 0; i < 13; i += 1) {
      const id = this.getBlock(cx, cy, cz);
      if (id === BLOCK.AIR || isWater(id)) {
        break;
      }

      if (!this.canPistonMoveBlock(id)) {
        return false;
      }

      chain.push({ x: cx, y: cy, z: cz, id });
      cx += front.dx;
      cz += front.dz;
      if (chain.length > 12) {
        return false;
      }
    }

    const destinationId = this.getBlock(cx, cy, cz);
    if (destinationId !== BLOCK.AIR && !isWater(destinationId)) {
      return false;
    }

    for (let i = chain.length - 1; i >= 0; i -= 1) {
      const node = chain[i];
      const tx = node.x + front.dx;
      const ty = node.y;
      const tz = node.z + front.dz;
      this.setBlock(tx, ty, tz, node.id, {
        saveEdit: false,
        updateFluids: false,
        updateRedstone: false,
      });
      this.setBlock(node.x, node.y, node.z, BLOCK.AIR, {
        saveEdit: false,
        updateFluids: false,
        updateRedstone: false,
      });
      this.enqueueRedstoneNeighbors(node.x, node.y, node.z);
      this.enqueueRedstoneNeighbors(tx, ty, tz);
      this.enqueueFluidNeighbors(node.x, node.y, node.z);
      this.enqueueFluidNeighbors(tx, ty, tz);
    }

    this.setBlock(x + front.dx, y, z + front.dz, makePistonHeadId(dir), {
      saveEdit: false,
      updateFluids: false,
      updateRedstone: false,
    });
    this.setBlock(x, y, z, makePistonId(dir, true), {
      saveEdit: false,
      updateFluids: false,
      updateRedstone: false,
    });

    this.enqueueRedstoneNeighbors(x, y, z);
    this.enqueueRedstoneNeighbors(x + front.dx, y, z + front.dz);
    this.enqueueFluidNeighbors(x + front.dx, y, z + front.dz);
    return true;
  }

  tryRetractPiston(x, y, z, dir) {
    const front = getHorizontalDirVector(dir);
    const hx = x + front.dx;
    const hy = y;
    const hz = z + front.dz;

    const frontId = this.getBlock(hx, hy, hz);
    if (isPistonHead(frontId) && getPistonHeadDir(frontId) === dir) {
      this.setBlock(hx, hy, hz, BLOCK.AIR, {
        saveEdit: false,
        updateFluids: false,
        updateRedstone: false,
      });
      this.enqueueRedstoneNeighbors(hx, hy, hz);
      this.enqueueFluidNeighbors(hx, hy, hz);
    }

    this.setBlock(x, y, z, makePistonId(dir, false), {
      saveEdit: false,
      updateFluids: false,
      updateRedstone: false,
    });
    this.enqueueRedstoneNeighbors(x, y, z);
    return true;
  }

  updatePistonAt(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (!isPiston(id)) {
      return;
    }

    const dir = getPistonDir(id);
    const extended = isPistonExtended(id);
    const powered = this.isPistonPowered(x, y, z, dir);

    if (powered && !extended) {
      this.tryExtendPiston(x, y, z, dir);
      return;
    }

    if (!powered && extended) {
      this.tryRetractPiston(x, y, z, dir);
    }
  }

  evaluateRedstoneAt(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (isRedstoneDust(id)) {
      this.updateDustAt(x, y, z);
      return;
    }
    if (isRepeater(id)) {
      this.updateRepeaterAt(x, y, z);
      return;
    }
    if (isComparator(id)) {
      this.updateComparatorAt(x, y, z);
      return;
    }
    if (isPiston(id)) {
      this.updatePistonAt(x, y, z);
    }
  }

  processRedstoneUpdates(limit = CONFIG.REDSTONE_UPDATES_PER_FRAME) {
    let processed = 0;
    while (processed < limit && this.redstoneQueue.length > 0) {
      const node = this.redstoneQueue.shift();
      this.redstoneQueued.delete(node.key);

      const cx = worldToChunkCoord(node.x);
      const cz = worldToChunkCoord(node.z);
      if (!this.hasChunk(cx, cz)) {
        continue;
      }

      this.evaluateRedstoneAt(node.x, node.y, node.z);
      processed += 1;
    }
  }

  isSolidAt(x, y, z) {
    const id = this.getBlock(x, y, z);
    const def = getBlockDef(id);
    return def.solid && !def.liquid;
  }

  getSurfaceHeight(x, z) {
    const cx = worldToChunkCoord(x);
    const cz = worldToChunkCoord(z);
    const chunk = this.getChunk(cx, cz);

    if (!chunk) {
      return this.sampleTerrainHeight(x, z);
    }

    const lx = worldToLocalCoord(x);
    const lz = worldToLocalCoord(z);

    for (let y = CONFIG.WORLD_HEIGHT - 1; y >= 0; y -= 1) {
      const id = chunk.get(lx, y, lz);
      if (id === BLOCK.AIR || isWater(id)) {
        continue;
      }
      return y;
    }

    return 0;
  }

  getBiomeLabel(x, z) {
    const biome = this.getBiome(x, z).type;
    if (biome === BIOME.FOREST) return "Forest";
    if (biome === BIOME.DESERT) return "Desert";
    return "Plains";
  }

  raycast(origin, direction, maxDistance = CONFIG.RAYCAST_DISTANCE) {
    const dir = direction.clone();
    if (dir.lengthSq() === 0) {
      return null;
    }
    dir.normalize();

    const originShifted = origin.clone().addScaledVector(dir, 0.0001);

    let x = Math.floor(originShifted.x);
    let y = Math.floor(originShifted.y);
    let z = Math.floor(originShifted.z);

    const stepX = dir.x > 0 ? 1 : dir.x < 0 ? -1 : 0;
    const stepY = dir.y > 0 ? 1 : dir.y < 0 ? -1 : 0;
    const stepZ = dir.z > 0 ? 1 : dir.z < 0 ? -1 : 0;

    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

    let tMaxX = intBound(originShifted.x, dir.x);
    let tMaxY = intBound(originShifted.y, dir.y);
    let tMaxZ = intBound(originShifted.z, dir.z);

    let dist = 0;
    let prevX = x;
    let prevY = y;
    let prevZ = z;

    while (dist <= maxDistance) {
      const id = this.getBlock(x, y, z);
      if (id !== BLOCK.AIR) {
        return {
          hit: { x, y, z, id },
          adjacent: { x: prevX, y: prevY, z: prevZ },
          distance: dist,
        };
      }

      prevX = x;
      prevY = y;
      prevZ = z;

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          dist = tMaxX;
          tMaxX += tDeltaX;
        } else {
          z += stepZ;
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
        }
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        dist = tMaxY;
        tMaxY += tDeltaY;
      } else {
        z += stepZ;
        dist = tMaxZ;
        tMaxZ += tDeltaZ;
      }
    }

    return null;
  }

  getLoadedChunkCount() {
    return this.chunks.size;
  }

  recordEdit(cx, cz, lx, y, lz, id) {
    const key = chunkKey(cx, cz);
    let changes = this.editsByChunk.get(key);
    if (!changes) {
      changes = new Map();
      this.editsByChunk.set(key, changes);
    }

    const localKey = `${lx},${y},${lz}`;
    changes.set(localKey, id);
    this.scheduleSaveEdits();
  }

  applyEditsToChunk(chunk) {
    const changes = this.editsByChunk.get(chunk.key);
    if (!changes) {
      return { fluidSeeds: [], redstoneSeeds: [] };
    }

    const fluidSeeds = [];
    const redstoneSeeds = [];
    for (const [key, id] of changes.entries()) {
      const [lx, y, lz] = key.split(",").map(Number);
      chunk.set(lx, y, lz, id);
      if (id === BLOCK.AIR || isWater(id)) {
        fluidSeeds.push({
          x: chunk.originX + lx,
          y,
          z: chunk.originZ + lz,
        });
      }

      if (
        isRedstoneDust(id) ||
        isRepeater(id) ||
        isComparator(id) ||
        isPiston(id) ||
        id === BLOCK.REDSTONE_BLOCK ||
        id === BLOCK.AIR
      ) {
        redstoneSeeds.push({
          x: chunk.originX + lx,
          y,
          z: chunk.originZ + lz,
        });
      }
    }
    return { fluidSeeds, redstoneSeeds };
  }

  scheduleSaveEdits() {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
    }

    this.saveTimer = window.setTimeout(() => {
      this.saveEditsNow();
      this.saveTimer = null;
    }, 350);
  }

  saveEditsNow() {
    const out = {};
    for (const [key, changes] of this.editsByChunk.entries()) {
      if (changes.size === 0) {
        continue;
      }

      out[key] = [];
      for (const [localKey, id] of changes.entries()) {
        const [lx, y, lz] = localKey.split(",").map(Number);
        out[key].push([lx, y, lz, id]);
      }
    }

    try {
      localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(out));
    } catch (error) {
      console.warn("Failed to save world edits:", error);
    }
  }

  loadEdits() {
    try {
      const raw = localStorage.getItem(CONFIG.SAVE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      for (const key of Object.keys(parsed)) {
        const entries = parsed[key];
        const changes = new Map();
        for (const entry of entries) {
          if (!Array.isArray(entry) || entry.length !== 4) {
            continue;
          }
          const [lx, y, lz, id] = entry.map(Number);
          if (Number.isNaN(lx) || Number.isNaN(y) || Number.isNaN(lz) || Number.isNaN(id)) {
            continue;
          }
          changes.set(`${lx},${y},${lz}`, id);
        }
        this.editsByChunk.set(key, changes);
      }
    } catch (error) {
      console.warn("Failed to load world edits:", error);
      this.editsByChunk.clear();
    }
  }
}
