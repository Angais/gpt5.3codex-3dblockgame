import * as THREE from "three";

const TILE_SIZE = 16;
const TILE_COLUMNS = 4;
const TILE_NAMES = [
  "air",
  "grass_top",
  "grass_side",
  "dirt",
  "stone",
  "sand",
  "log_side",
  "log_top",
  "leaves",
  "planks",
  "chair_wood",
  "bucket_water",
  "glass",
  "water",
  "cobble",
  "redstone_block",
  "redstone_dust_off",
  "redstone_dust_on",
  "repeater_off",
  "repeater_on",
  "comparator_off",
  "comparator_on",
  "piston_side",
  "piston_top",
  "piston_head",
];

function rand2(x, y, seed) {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, value | 0));
}

function tint(base, variation, noise) {
  return [
    clampByte(base[0] + (noise - 0.5) * variation[0]),
    clampByte(base[1] + (noise - 0.5) * variation[1]),
    clampByte(base[2] + (noise - 0.5) * variation[2]),
  ];
}

function putPixel(data, x, y, color, alpha = 255) {
  const idx = (y * TILE_SIZE + x) * 4;
  data[idx] = color[0];
  data[idx + 1] = color[1];
  data[idx + 2] = color[2];
  data[idx + 3] = alpha;
}

function paintTile(ctx, tileIndex, painter) {
  const ox = (tileIndex % TILE_COLUMNS) * TILE_SIZE;
  const oy = Math.floor(tileIndex / TILE_COLUMNS) * TILE_SIZE;
  const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  painter(img.data, tileIndex);
  ctx.putImageData(img, ox, oy);
}

function paintDirt(data, seed) {
  const base = [124, 87, 57];
  const variation = [70, 46, 35];
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const n = rand2(x, y, seed * 911);
      putPixel(data, x, y, tint(base, variation, n));
    }
  }
}

function paintStone(data, seed) {
  const base = [126, 128, 132];
  const variation = [56, 56, 56];
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const n = rand2(x, y, seed * 1733);
      const color = tint(base, variation, n);
      if (rand2(x + 37, y + 17, seed) > 0.87) {
        color[0] -= 14;
        color[1] -= 14;
        color[2] -= 14;
      }
      putPixel(data, x, y, color);
    }
  }
}

function paintSand(data, seed) {
  const base = [220, 206, 149];
  const variation = [42, 34, 24];
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const n = rand2(x, y, seed * 2153);
      const color = tint(base, variation, n);
      if (rand2(x + 19, y + 31, seed * 13) > 0.94) {
        color[0] += 12;
        color[1] += 11;
      }
      putPixel(data, x, y, color);
    }
  }
}

function paintGrassTop(data, seed) {
  const base = [108, 171, 65];
  const variation = [65, 76, 40];
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const n = rand2(x, y, seed * 317);
      const color = tint(base, variation, n);
      if (rand2(x + 5, y + 91, seed * 3) > 0.92) {
        color[0] += 12;
        color[1] += 18;
      }
      putPixel(data, x, y, color);
    }
  }
}

function paintGrassSide(data, seed) {
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      if (y < 4) {
        const n = rand2(x, y, seed * 733);
        const color = tint([102, 165, 62], [54, 68, 31], n);
        putPixel(data, x, y, color);
      } else {
        const n = rand2(x, y, seed * 911);
        const color = tint([124, 87, 57], [70, 46, 35], n);
        if (y < 7 && rand2(x + 9, y + 11, seed * 17) > 0.83) {
          color[0] = clampByte(color[0] - 35);
          color[1] = clampByte(color[1] + 20);
          color[2] = clampByte(color[2] - 18);
        }
        putPixel(data, x, y, color);
      }
    }
  }
}

function paintLogSide(data, seed) {
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const stripe = Math.floor((x + rand2(y, x, seed) * 2) / 3) % 2;
      const base = stripe === 0 ? [152, 117, 76] : [128, 95, 61];
      const color = tint(base, [30, 22, 18], rand2(x, y, seed * 457));
      putPixel(data, x, y, color);
    }
  }
}

function paintLogTop(data, seed) {
  const cx = TILE_SIZE / 2;
  const cy = TILE_SIZE / 2;
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const ring = Math.sin(d * 1.7 + rand2(x, y, seed) * 0.4) * 0.5 + 0.5;
      const base = [153, 119, 81];
      const color = tint(base, [48, 36, 24], ring);
      if (d > 7) {
        color[0] -= 16;
        color[1] -= 12;
        color[2] -= 10;
      }
      putPixel(data, x, y, color);
    }
  }
}

function paintLeaves(data, seed) {
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const n = rand2(x, y, seed * 211);
      const alpha = n > 0.14 ? 255 : 0;
      const color = tint([73, 131, 54], [46, 74, 30], rand2(y, x, seed * 541));
      putPixel(data, x, y, color, alpha);
    }
  }
}

function paintPlanks(data, seed) {
  for (let y = 0; y < TILE_SIZE; y += 1) {
    const board = Math.floor(y / 4) % 2;
    const base = board === 0 ? [168, 136, 88] : [154, 120, 76];
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const n = rand2(x, y, seed * 787);
      const color = tint(base, [24, 20, 16], n);
      if (y % 4 === 0) {
        color[0] = clampByte(color[0] - 18);
        color[1] = clampByte(color[1] - 16);
        color[2] = clampByte(color[2] - 12);
      }
      if (x % 8 === 0 && rand2(x, y + 111, seed * 43) > 0.55) {
        color[0] = clampByte(color[0] - 8);
        color[1] = clampByte(color[1] - 8);
      }
      putPixel(data, x, y, color);
    }
  }
}

function paintChairWood(data, seed) {
  for (let y = 0; y < TILE_SIZE; y += 1) {
    const board = Math.floor(y / 4) % 2;
    const base = board === 0 ? [177, 136, 85] : [160, 121, 72];
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const n = rand2(x + 17, y + 23, seed * 1033);
      const color = tint(base, [28, 22, 16], n);

      if (y % 4 === 0) {
        color[0] = clampByte(color[0] - 20);
        color[1] = clampByte(color[1] - 16);
        color[2] = clampByte(color[2] - 13);
      }

      if ((x === 3 || x === 12) && y > 2 && y < 13) {
        color[0] = clampByte(color[0] - 24);
        color[1] = clampByte(color[1] - 20);
        color[2] = clampByte(color[2] - 16);
      }

      if (rand2(x + 71, y + 41, seed * 41) > 0.95) {
        color[0] = clampByte(color[0] + 10);
        color[1] = clampByte(color[1] + 8);
      }

      putPixel(data, x, y, color);
    }
  }
}

function paintGlass(data, seed) {
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const edge = x === 0 || y === 0 || x === TILE_SIZE - 1 || y === TILE_SIZE - 1;
      const diagonal = x === y || x + y === TILE_SIZE - 1;
      const sparkle = rand2(x + 7, y + 13, seed * 659) > 0.96;
      let alpha = 24;
      if (edge) alpha = 190;
      if (diagonal) alpha = Math.max(alpha, 92);
      if (sparkle) alpha = 220;
      const blue = 220 + Math.floor(rand2(x, y, seed) * 30);
      putPixel(data, x, y, [206, 230, blue], alpha);
    }
  }
}

function paintWater(data, seed) {
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const wave = Math.sin((x + seed) * 0.6) * 0.5 + Math.cos((y - seed) * 0.55) * 0.5;
      const n = rand2(x, y, seed * 997) * 0.35 + wave * 0.12 + 0.55;
      const color = [
        clampByte(40 + n * 26),
        clampByte(112 + n * 52),
        clampByte(170 + n * 72),
      ];
      const alpha = clampByte(148 + n * 44);
      putPixel(data, x, y, color, alpha);
    }
  }
}

function paintWaterBucket(data, seed) {
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      putPixel(data, x, y, [0, 0, 0], 0);
    }
  }

  const handleColor = [144, 144, 150];
  const metalBase = [162, 164, 169];
  const waterBase = [62, 134, 208];

  for (let y = 2; y <= 12; y += 1) {
    for (let x = 1; x <= 14; x += 1) {
      const isHandle = (x <= 2 || x >= 13) && y >= 4 && y <= 8;
      if (!isHandle) {
        continue;
      }
      const n = rand2(x + 41, y + 83, seed * 127);
      const color = tint(handleColor, [24, 24, 24], n);
      putPixel(data, x, y, color, 255);
    }
  }

  for (let y = 4; y <= 13; y += 1) {
    for (let x = 3; x <= 12; x += 1) {
      const edge = x === 3 || x === 12 || y === 4 || y === 13;
      const n = rand2(x + 13, y + 17, seed * 353);
      const color = tint(metalBase, [30, 30, 30], n);
      if (edge) {
        color[0] = clampByte(color[0] - 28);
        color[1] = clampByte(color[1] - 28);
        color[2] = clampByte(color[2] - 28);
      }
      putPixel(data, x, y, color, 255);
    }
  }

  for (let y = 5; y <= 8; y += 1) {
    for (let x = 4; x <= 11; x += 1) {
      const wave = Math.sin((x + seed) * 0.8 + y * 0.5) * 0.5 + 0.5;
      const n = rand2(x + 5, y + 9, seed * 1009) * 0.35 + wave * 0.65;
      const color = [
        clampByte(waterBase[0] + n * 20),
        clampByte(waterBase[1] + n * 24),
        clampByte(waterBase[2] + n * 28),
      ];
      putPixel(data, x, y, color, 255);
    }
  }
}

function paintRedstoneBlock(data, seed) {
  const base = [174, 34, 34];
  const variation = [70, 28, 28];
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const n = rand2(x + 11, y + 17, seed * 911);
      const color = tint(base, variation, n);
      if ((x + y) % 5 === 0 && rand2(x + 91, y + 41, seed * 37) > 0.5) {
        color[0] = clampByte(color[0] + 14);
      }
      putPixel(data, x, y, color);
    }
  }
}

function paintRedstoneDust(data, seed, lit) {
  const base = lit ? [248, 48, 46] : [110, 26, 24];
  const variation = lit ? [70, 26, 24] : [38, 12, 12];
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const n = rand2(x + 23, y + 53, seed * 419);
      const color = tint(base, variation, n);
      const centerLine = x >= 6 && x <= 9;
      const sideLine = y >= 6 && y <= 9;
      if (centerLine || sideLine) {
        color[0] = clampByte(color[0] + (lit ? 30 : 18));
        color[1] = clampByte(color[1] + (lit ? 12 : 4));
      } else {
        color[0] = clampByte(color[0] - (lit ? 10 : 16));
        color[1] = clampByte(color[1] - (lit ? 6 : 10));
        color[2] = clampByte(color[2] - 6);
      }
      putPixel(data, x, y, color);
    }
  }
}

function paintRepeater(data, seed, lit) {
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const n = rand2(x + 7, y + 29, seed * 223);
      const base = tint([168, 170, 176], [28, 28, 28], n);
      putPixel(data, x, y, base);
    }
  }

  for (let y = 3; y <= 12; y += 1) {
    const rail = lit ? [236, 38, 38] : [134, 42, 42];
    putPixel(data, 7, y, rail);
    putPixel(data, 8, y, rail);
  }

  for (let y = 2; y <= 4; y += 1) {
    for (let x = 5; x <= 10; x += 1) {
      putPixel(data, x, y, lit ? [248, 72, 66] : [160, 52, 48]);
    }
  }

  for (let y = 9; y <= 11; y += 1) {
    for (let x = 5; x <= 10; x += 1) {
      putPixel(data, x, y, lit ? [248, 72, 66] : [160, 52, 48]);
    }
  }
}

function paintComparator(data, seed, lit) {
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const n = rand2(x + 37, y + 61, seed * 389);
      const base = tint([164, 167, 173], [26, 26, 26], n);
      putPixel(data, x, y, base);
    }
  }

  const red = lit ? [246, 56, 52] : [146, 44, 44];

  for (let y = 4; y <= 11; y += 1) {
    putPixel(data, 7, y, red);
    putPixel(data, 8, y, red);
  }

  for (let y = 2; y <= 4; y += 1) {
    for (let x = 3; x <= 5; x += 1) putPixel(data, x, y, red);
    for (let x = 10; x <= 12; x += 1) putPixel(data, x, y, red);
  }

  for (let y = 9; y <= 11; y += 1) {
    for (let x = 6; x <= 9; x += 1) {
      putPixel(data, x, y, red);
    }
  }
}

function paintPistonSide(data, seed) {
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const n = rand2(x + 13, y + 17, seed * 503);
      const base = tint([137, 124, 92], [38, 30, 24], n);
      if (x < 2 || x > 13 || y < 2 || y > 13) {
        base[0] = clampByte(base[0] - 22);
        base[1] = clampByte(base[1] - 20);
        base[2] = clampByte(base[2] - 16);
      }
      putPixel(data, x, y, base);
    }
  }
}

function paintPistonTop(data, seed) {
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const n = rand2(x + 19, y + 23, seed * 719);
      const wood = tint([170, 138, 84], [34, 26, 18], n);
      putPixel(data, x, y, wood);
    }
  }

  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      if (x < 2 || x > 13 || y < 2 || y > 13) {
        putPixel(data, x, y, [111, 111, 116]);
      }
    }
  }
}

function paintPistonHead(data, seed) {
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const n = rand2(x + 29, y + 43, seed * 887);
      const metal = tint([145, 146, 151], [28, 28, 28], n);
      putPixel(data, x, y, metal);
    }
  }

  for (let y = 2; y <= 13; y += 1) {
    for (let x = 2; x <= 13; x += 1) {
      const n = rand2(x + 71, y + 89, seed * 97);
      const wood = tint([164, 128, 77], [26, 20, 16], n);
      putPixel(data, x, y, wood);
    }
  }
}

function paintCobble(data, seed) {
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const cell = `${Math.floor(x / 4)}_${Math.floor(y / 4)}`;
      const cellSeed = cell.length * 131 + seed * 17;
      const n = rand2(x, y, seed * 1249);
      const base = tint([124, 124, 126], [62, 62, 62], n);
      if (rand2(x + cellSeed, y + cellSeed * 2, cellSeed) > 0.8) {
        base[0] -= 16;
        base[1] -= 14;
        base[2] -= 14;
      }
      if ((x % 4 === 0 || y % 4 === 0) && rand2(y, x, seed * 17) > 0.35) {
        base[0] -= 10;
        base[1] -= 10;
        base[2] -= 10;
      }
      putPixel(data, x, y, base);
    }
  }
}

function paintAir(data) {
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      putPixel(data, x, y, [0, 0, 0], 0);
    }
  }
}

export function createTextureAtlas(seed = 1337) {
  const rows = Math.ceil(TILE_NAMES.length / TILE_COLUMNS);
  const canvas = document.createElement("canvas");
  canvas.width = TILE_COLUMNS * TILE_SIZE;
  canvas.height = rows * TILE_SIZE;
  const ctx = canvas.getContext("2d", { alpha: true });

  const tilePainters = {
    air: paintAir,
    grass_top: paintGrassTop,
    grass_side: paintGrassSide,
    dirt: paintDirt,
    stone: paintStone,
    sand: paintSand,
    log_side: paintLogSide,
    log_top: paintLogTop,
    leaves: paintLeaves,
    planks: paintPlanks,
    chair_wood: paintChairWood,
    bucket_water: paintWaterBucket,
    glass: paintGlass,
    water: paintWater,
    cobble: paintCobble,
    redstone_block: paintRedstoneBlock,
    redstone_dust_off: (data, noiseSeed) => paintRedstoneDust(data, noiseSeed, false),
    redstone_dust_on: (data, noiseSeed) => paintRedstoneDust(data, noiseSeed, true),
    repeater_off: (data, noiseSeed) => paintRepeater(data, noiseSeed, false),
    repeater_on: (data, noiseSeed) => paintRepeater(data, noiseSeed, true),
    comparator_off: (data, noiseSeed) => paintComparator(data, noiseSeed, false),
    comparator_on: (data, noiseSeed) => paintComparator(data, noiseSeed, true),
    piston_side: paintPistonSide,
    piston_top: paintPistonTop,
    piston_head: paintPistonHead,
  };

  for (let i = 0; i < TILE_NAMES.length; i += 1) {
    const name = TILE_NAMES[i];
    const painter = tilePainters[name] ?? paintStone;
    paintTile(ctx, i, (data) => painter(data, seed + i * 101));
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const nameToIndex = new Map(TILE_NAMES.map((name, idx) => [name, idx]));

  const getUV = (tileName) => {
    const index = nameToIndex.get(tileName) ?? nameToIndex.get("stone");
    const x = (index % TILE_COLUMNS) * TILE_SIZE;
    const y = Math.floor(index / TILE_COLUMNS) * TILE_SIZE;
    const pad = 0.01;

    const u0 = (x + pad) / canvas.width;
    const u1 = (x + TILE_SIZE - pad) / canvas.width;
    const v0 = 1 - (y + TILE_SIZE - pad) / canvas.height;
    const v1 = 1 - (y + pad) / canvas.height;

    return { u0, v0, u1, v1 };
  };

  const createIcon = (tileName, scale = 3) => {
    const index = nameToIndex.get(tileName) ?? nameToIndex.get("stone");
    const x = (index % TILE_COLUMNS) * TILE_SIZE;
    const y = Math.floor(index / TILE_COLUMNS) * TILE_SIZE;

    const icon = document.createElement("canvas");
    icon.width = TILE_SIZE * scale;
    icon.height = TILE_SIZE * scale;
    const ictx = icon.getContext("2d", { alpha: true });
    ictx.imageSmoothingEnabled = false;
    ictx.drawImage(
      canvas,
      x,
      y,
      TILE_SIZE,
      TILE_SIZE,
      0,
      0,
      icon.width,
      icon.height,
    );
    return icon.toDataURL("image/png");
  };

  return {
    canvas,
    texture,
    tileSize: TILE_SIZE,
    getUV,
    createIcon,
  };
}
