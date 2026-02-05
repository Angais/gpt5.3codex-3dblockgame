function imul(a, b) {
  return Math.imul(a, b);
}

export function stringToSeed(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = imul(h, 16777619);
  }
  return (h >>> 0) || 1337;
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export class ValueNoise {
  constructor(seed = 1337) {
    this.seed = seed >>> 0;
  }

  hash3(x, y, z = 0) {
    let h = this.seed;
    h ^= imul(x, 374761393);
    h ^= imul(y, 668265263);
    h ^= imul(z, 2147483647);
    h = imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }

  value2(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const tx = x - x0;
    const ty = y - y0;

    const v00 = this.hash3(x0, y0, 0);
    const v10 = this.hash3(x1, y0, 0);
    const v01 = this.hash3(x0, y1, 0);
    const v11 = this.hash3(x1, y1, 0);

    const u = fade(tx);
    const v = fade(ty);

    return lerp(lerp(v00, v10, u), lerp(v01, v11, u), v) * 2 - 1;
  }

  value3(x, y, z) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const z1 = z0 + 1;

    const tx = x - x0;
    const ty = y - y0;
    const tz = z - z0;

    const v000 = this.hash3(x0, y0, z0);
    const v100 = this.hash3(x1, y0, z0);
    const v010 = this.hash3(x0, y1, z0);
    const v110 = this.hash3(x1, y1, z0);
    const v001 = this.hash3(x0, y0, z1);
    const v101 = this.hash3(x1, y0, z1);
    const v011 = this.hash3(x0, y1, z1);
    const v111 = this.hash3(x1, y1, z1);

    const u = fade(tx);
    const v = fade(ty);
    const w = fade(tz);

    const x00 = lerp(v000, v100, u);
    const x10 = lerp(v010, v110, u);
    const x01 = lerp(v001, v101, u);
    const x11 = lerp(v011, v111, u);

    const y0v = lerp(x00, x10, v);
    const y1v = lerp(x01, x11, v);

    return lerp(y0v, y1v, w) * 2 - 1;
  }

  fbm2(x, y, {
    octaves = 5,
    frequency = 1,
    gain = 0.5,
    lacunarity = 2,
  } = {}) {
    let amp = 1;
    let freq = frequency;
    let sum = 0;
    let norm = 0;

    for (let i = 0; i < octaves; i += 1) {
      sum += this.value2(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }

    return norm > 0 ? sum / norm : 0;
  }

  fbm3(x, y, z, {
    octaves = 4,
    frequency = 1,
    gain = 0.5,
    lacunarity = 2,
  } = {}) {
    let amp = 1;
    let freq = frequency;
    let sum = 0;
    let norm = 0;

    for (let i = 0; i < octaves; i += 1) {
      sum += this.value3(x * freq, y * freq, z * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }

    return norm > 0 ? sum / norm : 0;
  }
}
