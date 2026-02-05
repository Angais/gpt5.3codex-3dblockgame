const CHAIR_MODEL_PARTS = Object.freeze([
  { x0: 0.12, y0: 0.38, z0: 0.12, x1: 0.88, y1: 0.5, z1: 0.88 },
  { x0: 0.12, y0: 0.5, z0: 0.72, x1: 0.88, y1: 0.95, z1: 0.88 },
  { x0: 0.12, y0: 0.0, z0: 0.12, x1: 0.26, y1: 0.38, z1: 0.26 },
  { x0: 0.74, y0: 0.0, z0: 0.12, x1: 0.88, y1: 0.38, z1: 0.26 },
  { x0: 0.12, y0: 0.0, z0: 0.74, x1: 0.26, y1: 0.38, z1: 0.88 },
  { x0: 0.74, y0: 0.0, z0: 0.74, x1: 0.88, y1: 0.38, z1: 0.88 },
]);

const DUST_MODEL_PARTS = Object.freeze([
  { x0: 0.0, y0: 0.0, z0: 0.0, x1: 1.0, y1: 0.04, z1: 1.0 },
]);

const FLAT_COMPONENT_PARTS = Object.freeze([
  { x0: 0.0, y0: 0.0, z0: 0.0, x1: 1.0, y1: 0.125, z1: 1.0 },
]);

const BLOCK_IDS = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  LOG: 5,
  LEAVES: 6,
  PLANKS: 7,
  GLASS: 8,
  WATER: 9,
  COBBLE: 10,
  WOODEN_CHAIR: 11,
  WATER_FLOW_0: 12,
  WATER_FLOW_1: 13,
  WATER_FLOW_2: 14,
  WATER_FLOW_3: 15,
  WATER_FLOW_4: 16,
  WATER_FLOW_5: 17,
  WATER_FLOW_6: 18,
  WATER_FLOW_7: 19,
  REDSTONE_DUST_0: 20,
  REDSTONE_DUST_15: 35,
  REPEATER_START: 36,
  REPEATER_END: 43,
  COMPARATOR_START: 44,
  COMPARATOR_END: 171,
  PISTON_START: 172,
  PISTON_END: 179,
  PISTON_HEAD_START: 180,
  PISTON_HEAD_END: 183,
  REDSTONE_BLOCK: 184,
};

export const BLOCK = Object.freeze({
  ...BLOCK_IDS,
  REDSTONE_DUST: BLOCK_IDS.REDSTONE_DUST_0,
  REPEATER: BLOCK_IDS.REPEATER_START,
  COMPARATOR: BLOCK_IDS.COMPARATOR_START,
  PISTON: BLOCK_IDS.PISTON_START,
  PISTON_HEAD: BLOCK_IDS.PISTON_HEAD_START,
});

export const HORIZONTAL_DIRECTIONS = Object.freeze([
  Object.freeze({ index: 0, key: "north", dx: 0, dz: -1 }),
  Object.freeze({ index: 1, key: "east", dx: 1, dz: 0 }),
  Object.freeze({ index: 2, key: "south", dx: 0, dz: 1 }),
  Object.freeze({ index: 3, key: "west", dx: -1, dz: 0 }),
]);

const HORIZONTAL_DIR_LOOKUP = Object.freeze([
  Object.freeze({ dx: 0, dz: -1 }),
  Object.freeze({ dx: 1, dz: 0 }),
  Object.freeze({ dx: 0, dz: 1 }),
  Object.freeze({ dx: -1, dz: 0 }),
]);

function normalizeHorizontalDir(dir) {
  const d = Math.floor(dir);
  return ((d % 4) + 4) % 4;
}

export function getHorizontalDirVector(dir) {
  return HORIZONTAL_DIR_LOOKUP[normalizeHorizontalDir(dir)];
}

export function getOppositeHorizontalDir(dir) {
  return normalizeHorizontalDir(dir + 2);
}

export function getLeftHorizontalDir(dir) {
  return normalizeHorizontalDir(dir + 3);
}

export function getRightHorizontalDir(dir) {
  return normalizeHorizontalDir(dir + 1);
}

const WATER_FLOW_IDS = Object.freeze([
  BLOCK.WATER_FLOW_0,
  BLOCK.WATER_FLOW_1,
  BLOCK.WATER_FLOW_2,
  BLOCK.WATER_FLOW_3,
  BLOCK.WATER_FLOW_4,
  BLOCK.WATER_FLOW_5,
  BLOCK.WATER_FLOW_6,
  BLOCK.WATER_FLOW_7,
]);

function isWaterFlowId(id) {
  return id >= BLOCK.WATER_FLOW_0 && id <= BLOCK.WATER_FLOW_7;
}

export function isWater(id) {
  return id === BLOCK.WATER || isWaterFlowId(id);
}

export function isWaterSource(id) {
  return id === BLOCK.WATER;
}

export function isFlowingWater(id) {
  return isWaterFlowId(id);
}

export function getWaterLevel(id) {
  if (id === BLOCK.WATER || id === BLOCK.WATER_FLOW_0) {
    return 0;
  }
  if (isWaterFlowId(id)) {
    return id - BLOCK.WATER_FLOW_0;
  }
  return null;
}

export function getFlowingWaterId(level) {
  const clamped = Math.max(0, Math.min(7, Math.floor(level)));
  return WATER_FLOW_IDS[clamped];
}

export function isRedstoneDust(id) {
  return id >= BLOCK.REDSTONE_DUST_0 && id <= BLOCK.REDSTONE_DUST_15;
}

export function getDustPower(id) {
  if (!isRedstoneDust(id)) {
    return 0;
  }
  return id - BLOCK.REDSTONE_DUST_0;
}

export function makeDustId(power) {
  const clamped = Math.max(0, Math.min(15, Math.floor(power)));
  return BLOCK.REDSTONE_DUST_0 + clamped;
}

export function isRepeater(id) {
  return id >= BLOCK.REPEATER_START && id <= BLOCK.REPEATER_END;
}

export function getRepeaterDir(id) {
  if (!isRepeater(id)) {
    return 0;
  }
  return Math.floor((id - BLOCK.REPEATER_START) / 2);
}

export function isRepeaterPowered(id) {
  if (!isRepeater(id)) {
    return false;
  }
  return ((id - BLOCK.REPEATER_START) & 1) === 1;
}

export function makeRepeaterId(dir, powered) {
  return BLOCK.REPEATER_START + normalizeHorizontalDir(dir) * 2 + (powered ? 1 : 0);
}

export function isComparator(id) {
  return id >= BLOCK.COMPARATOR_START && id <= BLOCK.COMPARATOR_END;
}

export function getComparatorDir(id) {
  if (!isComparator(id)) {
    return 0;
  }
  return Math.floor((id - BLOCK.COMPARATOR_START) / 32);
}

export function isComparatorSubtract(id) {
  if (!isComparator(id)) {
    return false;
  }
  return ((id - BLOCK.COMPARATOR_START) % 32) >= 16;
}

export function getComparatorOutput(id) {
  if (!isComparator(id)) {
    return 0;
  }
  return (id - BLOCK.COMPARATOR_START) % 16;
}

export function makeComparatorId(dir, subtract, output) {
  const d = normalizeHorizontalDir(dir);
  const out = Math.max(0, Math.min(15, Math.floor(output)));
  const subtractBit = subtract ? 16 : 0;
  return BLOCK.COMPARATOR_START + d * 32 + subtractBit + out;
}

export function isPiston(id) {
  return id >= BLOCK.PISTON_START && id <= BLOCK.PISTON_END;
}

export function getPistonDir(id) {
  if (!isPiston(id)) {
    return 0;
  }
  return Math.floor((id - BLOCK.PISTON_START) / 2);
}

export function isPistonExtended(id) {
  if (!isPiston(id)) {
    return false;
  }
  return ((id - BLOCK.PISTON_START) & 1) === 1;
}

export function makePistonId(dir, extended) {
  return BLOCK.PISTON_START + normalizeHorizontalDir(dir) * 2 + (extended ? 1 : 0);
}

export function isPistonHead(id) {
  return id >= BLOCK.PISTON_HEAD_START && id <= BLOCK.PISTON_HEAD_END;
}

export function getPistonHeadDir(id) {
  if (!isPistonHead(id)) {
    return 0;
  }
  return id - BLOCK.PISTON_HEAD_START;
}

export function makePistonHeadId(dir) {
  return BLOCK.PISTON_HEAD_START + normalizeHorizontalDir(dir);
}

export function isRedstoneComponent(id) {
  return isRedstoneDust(id) || isRepeater(id) || isComparator(id) || id === BLOCK.REDSTONE_BLOCK;
}

export const BLOCK_DEFS = {};

function defineBlock(id, def) {
  BLOCK_DEFS[id] = {
    id,
    ...def,
  };
}

defineBlock(BLOCK.AIR, {
  name: "Air",
  solid: false,
  transparent: true,
  liquid: false,
  layer: "empty",
  textures: { all: "air" },
});

defineBlock(BLOCK.GRASS, {
  name: "Grass Block",
  solid: true,
  transparent: false,
  liquid: false,
  layer: "opaque",
  textures: { top: "grass_top", bottom: "dirt", side: "grass_side" },
});

defineBlock(BLOCK.DIRT, {
  name: "Dirt",
  solid: true,
  transparent: false,
  liquid: false,
  layer: "opaque",
  textures: { all: "dirt" },
});

defineBlock(BLOCK.STONE, {
  name: "Stone",
  solid: true,
  transparent: false,
  liquid: false,
  layer: "opaque",
  textures: { all: "stone" },
});

defineBlock(BLOCK.SAND, {
  name: "Sand",
  solid: true,
  transparent: false,
  liquid: false,
  layer: "opaque",
  textures: { all: "sand" },
});

defineBlock(BLOCK.LOG, {
  name: "Oak Log",
  solid: true,
  transparent: false,
  liquid: false,
  layer: "opaque",
  textures: { top: "log_top", bottom: "log_top", side: "log_side" },
});

defineBlock(BLOCK.LEAVES, {
  name: "Leaves",
  solid: true,
  transparent: true,
  liquid: false,
  layer: "cutout",
  textures: { all: "leaves" },
});

defineBlock(BLOCK.PLANKS, {
  name: "Planks",
  solid: true,
  transparent: false,
  liquid: false,
  layer: "opaque",
  textures: { all: "planks" },
});

defineBlock(BLOCK.GLASS, {
  name: "Glass",
  solid: true,
  transparent: true,
  liquid: false,
  layer: "cutout",
  textures: { all: "glass" },
});

defineBlock(BLOCK.WATER, {
  name: "Water",
  solid: false,
  transparent: true,
  liquid: true,
  layer: "translucent",
  textures: { all: "water" },
});

for (let i = 0; i < WATER_FLOW_IDS.length; i += 1) {
  defineBlock(WATER_FLOW_IDS[i], {
    name: "Flowing Water",
    solid: false,
    transparent: true,
    liquid: true,
    layer: "translucent",
    textures: { all: "water" },
  });
}

defineBlock(BLOCK.COBBLE, {
  name: "Cobblestone",
  solid: true,
  transparent: false,
  liquid: false,
  layer: "opaque",
  textures: { all: "cobble" },
});

defineBlock(BLOCK.WOODEN_CHAIR, {
  name: "Wooden Chair",
  solid: true,
  transparent: true,
  liquid: false,
  layer: "opaque",
  textures: { all: "chair_wood" },
  modelParts: CHAIR_MODEL_PARTS,
});

for (let power = 0; power <= 15; power += 1) {
  const id = makeDustId(power);
  defineBlock(id, {
    name: "Redstone Dust",
    solid: false,
    transparent: true,
    liquid: false,
    layer: "cutout",
    textures: {
      top: power > 0 ? "redstone_dust_on" : "redstone_dust_off",
      bottom: "stone",
      side: power > 0 ? "redstone_dust_on" : "redstone_dust_off",
    },
    modelParts: DUST_MODEL_PARTS,
  });
}

for (let dir = 0; dir < 4; dir += 1) {
  for (let powered = 0; powered <= 1; powered += 1) {
    defineBlock(makeRepeaterId(dir, powered === 1), {
      name: powered === 1 ? "Repeater (On)" : "Repeater",
      solid: false,
      transparent: true,
      liquid: false,
      layer: "cutout",
      textures: {
        top: powered === 1 ? "repeater_on" : "repeater_off",
        bottom: "stone",
        side: "stone",
      },
      modelParts: FLAT_COMPONENT_PARTS,
    });
  }
}

for (let dir = 0; dir < 4; dir += 1) {
  for (let subtract = 0; subtract <= 1; subtract += 1) {
    for (let output = 0; output <= 15; output += 1) {
      defineBlock(makeComparatorId(dir, subtract === 1, output), {
        name: subtract === 1 ? "Comparator (Subtract)" : "Comparator",
        solid: false,
        transparent: true,
        liquid: false,
        layer: "cutout",
        textures: {
          top: output > 0 ? "comparator_on" : "comparator_off",
          bottom: "stone",
          side: "stone",
        },
        modelParts: FLAT_COMPONENT_PARTS,
      });
    }
  }
}

for (let dir = 0; dir < 4; dir += 1) {
  for (let extended = 0; extended <= 1; extended += 1) {
    defineBlock(makePistonId(dir, extended === 1), {
      name: extended === 1 ? "Piston (Extended)" : "Piston",
      solid: true,
      transparent: false,
      liquid: false,
      layer: "opaque",
      textures: {
        top: extended === 1 ? "piston_head" : "piston_top",
        bottom: "piston_side",
        side: "piston_side",
      },
    });
  }
}

for (let dir = 0; dir < 4; dir += 1) {
  defineBlock(makePistonHeadId(dir), {
    name: "Piston Head",
    solid: true,
    transparent: false,
    liquid: false,
    layer: "opaque",
    textures: { all: "piston_head" },
  });
}

defineBlock(BLOCK.REDSTONE_BLOCK, {
  name: "Redstone Block",
  solid: true,
  transparent: false,
  liquid: false,
  layer: "opaque",
  textures: { all: "redstone_block" },
});

export const HOTBAR_BLOCKS = [
  BLOCK.STONE,
  BLOCK.REDSTONE_BLOCK,
  BLOCK.REDSTONE_DUST,
  BLOCK.REPEATER,
  BLOCK.COMPARATOR,
  BLOCK.PISTON,
  BLOCK.PLANKS,
  BLOCK.WATER,
  BLOCK.WOODEN_CHAIR,
];

export const FACES = [
  {
    key: "px",
    dir: [1, 0, 0],
    shade: 0.82,
    uvFace: "side",
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    normal: [1, 0, 0],
  },
  {
    key: "nx",
    dir: [-1, 0, 0],
    shade: 0.82,
    uvFace: "side",
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    normal: [-1, 0, 0],
  },
  {
    key: "py",
    dir: [0, 1, 0],
    shade: 1.0,
    uvFace: "top",
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    normal: [0, 1, 0],
  },
  {
    key: "ny",
    dir: [0, -1, 0],
    shade: 0.6,
    uvFace: "bottom",
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    normal: [0, -1, 0],
  },
  {
    key: "pz",
    dir: [0, 0, 1],
    shade: 0.9,
    uvFace: "side",
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    normal: [0, 0, 1],
  },
  {
    key: "nz",
    dir: [0, 0, -1],
    shade: 0.9,
    uvFace: "side",
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    normal: [0, 0, -1],
  },
];

export function getBlockDef(id) {
  return BLOCK_DEFS[id] ?? BLOCK_DEFS[BLOCK.AIR];
}

export function isOpaqueSolid(id) {
  const def = getBlockDef(id);
  return def.solid && !def.transparent && !def.liquid;
}

export function isSolidForCollision(id) {
  const def = getBlockDef(id);
  return def.solid && !def.liquid;
}

export function getFaceTextureName(blockId, faceKey) {
  const def = getBlockDef(blockId);
  const textures = def.textures;
  if (textures.all) {
    return textures.all;
  }
  if (faceKey === "top" && textures.top) {
    return textures.top;
  }
  if (faceKey === "bottom" && textures.bottom) {
    return textures.bottom;
  }
  return textures.side ?? textures.top ?? textures.bottom ?? "stone";
}
