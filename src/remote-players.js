import * as THREE from "three";

const BODY_COLOR = 0x4a90d9;
const HEAD_COLOR = 0xf5cba7;
const CAMERA_EYE_OFFSET = 1.62;

// Shared geometries.
const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const bodyGeo = new THREE.BoxGeometry(0.4, 0.7, 0.25);

// Shared materials.
const bodyMat = new THREE.MeshLambertMaterial({ color: BODY_COLOR });
const headMat = new THREE.MeshLambertMaterial({ color: HEAD_COLOR });

/**
 * @typedef {Object} RemotePlayerRecord
 * @property {THREE.Group} group
 * @property {THREE.Vector3} targetPosition
 * @property {number} targetYaw
 * @property {THREE.Sprite} nameSprite
 * @property {THREE.Texture} nameTexture
 * @property {string} label
 */

/**
 * RemotePlayers manages ghost meshes in the scene for every non-local player.
 */
export class RemotePlayers {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;

    /**
     * @type {Map<string, RemotePlayerRecord>}
     */
    this.players = new Map();

    this.positionLerpSpeed = 12;
    this.rotationLerpSpeed = 14;
  }

  /**
   * Ensure a ghost mesh exists for this player and update its target transform.
   * @param {string} playerId
   * @param {number} x eye-position X
   * @param {number} y eye-position Y
   * @param {number} z eye-position Z
   * @param {number} yaw horizontal angle in radians
   */
  update(playerId, x, y, z, yaw) {
    let record = this.players.get(playerId);

    if (!record) {
      record = this._createGhost(playerId);
      this.players.set(playerId, record);
      this.scene.add(record.group);
    }

    record.targetPosition.set(x, y - CAMERA_EYE_OFFSET, z);
    record.targetYaw = yaw;
  }

  /**
   * Call once per frame to smoothly interpolate remote players.
   * @param {number} deltaSeconds
   * @param {THREE.Camera} [camera]
   */
  tick(deltaSeconds, camera) {
    const posAlpha = 1 - Math.exp(-this.positionLerpSpeed * deltaSeconds);
    const rotAlpha = 1 - Math.exp(-this.rotationLerpSpeed * deltaSeconds);

    for (const record of this.players.values()) {
      record.group.position.lerp(record.targetPosition, posAlpha);
      record.group.rotation.y = lerpAngle(
        record.group.rotation.y,
        record.targetYaw,
        rotAlpha,
      );

      // Optional: keep nametags facing the camera.
      if (camera) {
        record.nameSprite.quaternion.copy(camera.quaternion);
      }
    }
  }

  /**
   * Remove the ghost mesh for a player who left.
   * @param {string} playerId
   */
  remove(playerId) {
    const record = this.players.get(playerId);
    if (!record) return;

    this.scene.remove(record.group);

    record.group.traverse((obj) => {
      if (!obj.isMesh && !obj.isSprite) return;

      if (obj.material) {
        if (Array.isArray(obj.material)) {
          for (const mat of obj.material) {
            this._disposeMaterial(mat, false);
          }
        } else {
          const ownsTexture = obj === record.nameSprite;
          this._disposeMaterial(obj.material, ownsTexture);
        }
      }
    });

    this.players.delete(playerId);
  }

  /**
   * Remove all ghost meshes.
   */
  clear() {
    for (const playerId of [...this.players.keys()]) {
      this.remove(playerId);
    }
  }

  /**
   * Optional full destroy when shutting down the whole system.
   * Disposes shared resources too.
   */
  dispose() {
    this.clear();

    headGeo.dispose();
    bodyGeo.dispose();
    headMat.dispose();
    bodyMat.dispose();
  }

  /**
   * Rename/update label if needed.
   * @param {string} playerId
   * @param {string} label
   */
  setLabel(playerId, label) {
    const record = this.players.get(playerId);
    if (!record || record.label === label) return;

    const { texture } = makeNameTexture(label);
    record.nameSprite.material.map.dispose();
    record.nameSprite.material.map = texture;
    record.nameSprite.material.needsUpdate = true;
    record.label = label;
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  /**
   * @param {string} playerId
   * @returns {RemotePlayerRecord}
   */
  _createGhost(playerId) {
    const group = new THREE.Group();

    // Body.
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.35;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Head.
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.95;
    head.castShadow = true;
    group.add(head);

    // Nametag.
    const label = playerId.slice(0, 6);
    const { texture, sprite } = this._makeNameSprite(label);
    sprite.position.y = 1.3;
    sprite.scale.set(1.2, 0.4, 1);
    group.add(sprite);

    return {
      group,
      targetPosition: group.position.clone(),
      targetYaw: 0,
      nameSprite: sprite,
      nameTexture: texture,
      label,
    };
  }

  /**
   * @param {string} label
   * @returns {{texture: THREE.Texture, sprite: THREE.Sprite}}
   */
  _makeNameSprite(label) {
    const { texture } = makeNameTexture(label);

    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });

    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 1000;

    return { texture, sprite };
  }

  /**
   * @param {THREE.Material} material
   * @param {boolean} disposeMap
   */
  _disposeMaterial(material, disposeMap) {
    if (disposeMap && material.map) {
      material.map.dispose();
    }

    // Only dispose non-shared materials.
    if (material !== bodyMat && material !== headMat) {
      material.dispose();
    }
  }
}

/**
 * @param {string} label
 * @returns {{canvas: HTMLCanvasElement, texture: THREE.CanvasTexture}}
 */
function makeNameTexture(label) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create 2D canvas context for nametag.");
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background.
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  roundRect(ctx, 4, 4, canvas.width - 8, canvas.height - 8, 8);
  ctx.fill();

  // Text.
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  return { canvas, texture };
}

/**
 * Robust rounded rect helper.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Smooth angle interpolation taking wrap-around into account.
 * @param {number} from
 * @param {number} to
 * @param {number} alpha
 */
function lerpAngle(from, to, alpha) {
  let diff = to - from;

  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  return from + diff * alpha;
}