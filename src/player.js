import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

import { CONFIG } from "./config.js";

const UP = new THREE.Vector3(0, 1, 0);
const EPS = 1e-4;

function moveToward(current, target, maxDelta) {
  if (current < target) {
    return Math.min(current + maxDelta, target);
  }
  if (current > target) {
    return Math.max(current - maxDelta, target);
  }
  return target;
}

export class PlayerController {
  constructor(camera, domElement, world) {
    this.world = world;
    this.controls = new PointerLockControls(camera, domElement);

    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.jumpQueued = false;

    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
    };

    this.tmpForward = new THREE.Vector3();
    this.tmpRight = new THREE.Vector3();
    this.tmpWish = new THREE.Vector3();
    this.tmpMin = new THREE.Vector3();
    this.tmpMax = new THREE.Vector3();

    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);

    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
  }

  dispose() {
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
  }

  onKeyDown(event) {
    switch (event.code) {
      case "KeyW":
        this.keys.forward = true;
        break;
      case "KeyS":
        this.keys.backward = true;
        break;
      case "KeyA":
        this.keys.left = true;
        break;
      case "KeyD":
        this.keys.right = true;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.keys.sprint = true;
        break;
      case "Space":
        this.jumpQueued = true;
        break;
      default:
        break;
    }
  }

  onKeyUp(event) {
    switch (event.code) {
      case "KeyW":
        this.keys.forward = false;
        break;
      case "KeyS":
        this.keys.backward = false;
        break;
      case "KeyA":
        this.keys.left = false;
        break;
      case "KeyD":
        this.keys.right = false;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.keys.sprint = false;
        break;
      default:
        break;
    }
  }

  lock() {
    this.controls.lock();
  }

  unlock() {
    this.controls.unlock();
  }

  isLocked() {
    return this.controls.isLocked;
  }

  getObject() {
    return this.controls.getObject();
  }

  getEyePosition(target = new THREE.Vector3()) {
    return target.copy(this.getObject().position);
  }

  getFeetPosition(target = new THREE.Vector3()) {
    target.copy(this.getObject().position);
    target.y -= CONFIG.CAMERA_EYE_OFFSET;
    return target;
  }

  setEyePosition(x, y, z) {
    this.getObject().position.set(x, y, z);
  }

  respawn(x, z) {
    const top = this.world.getSurfaceHeight(Math.floor(x), Math.floor(z));
    this.setEyePosition(x + 0.5, top + CONFIG.CAMERA_EYE_OFFSET + 2.2, z + 0.5);
    this.velocity.set(0, 0, 0);
    this.onGround = false;
  }

  update(dt) {
    if (!this.isLocked()) {
      return;
    }

    const speed = this.keys.sprint ? CONFIG.SPRINT_SPEED : CONFIG.WALK_SPEED;

    this.controls.getDirection(this.tmpForward);
    this.tmpForward.y = 0;
    if (this.tmpForward.lengthSq() > 0) {
      this.tmpForward.normalize();
    }

    this.tmpRight.crossVectors(this.tmpForward, UP);
    if (this.tmpRight.lengthSq() > 0) {
      this.tmpRight.normalize();
    }

    this.tmpWish.set(0, 0, 0);
    if (this.keys.forward) this.tmpWish.add(this.tmpForward);
    if (this.keys.backward) this.tmpWish.addScaledVector(this.tmpForward, -1);
    if (this.keys.right) this.tmpWish.add(this.tmpRight);
    if (this.keys.left) this.tmpWish.addScaledVector(this.tmpRight, -1);

    if (this.tmpWish.lengthSq() > 0) {
      this.tmpWish.normalize().multiplyScalar(speed);
    }

    const accel = this.onGround ? CONFIG.ACCELERATION : CONFIG.AIR_CONTROL;
    this.velocity.x = moveToward(this.velocity.x, this.tmpWish.x, accel * dt);
    this.velocity.z = moveToward(this.velocity.z, this.tmpWish.z, accel * dt);

    if (this.onGround && this.tmpWish.lengthSq() === 0) {
      this.velocity.x = moveToward(this.velocity.x, 0, CONFIG.FRICTION * dt);
      this.velocity.z = moveToward(this.velocity.z, 0, CONFIG.FRICTION * dt);
    }

    if (this.jumpQueued && this.onGround) {
      this.velocity.y = CONFIG.JUMP_VELOCITY;
      this.onGround = false;
    }
    this.jumpQueued = false;

    this.velocity.y -= CONFIG.GRAVITY * dt;
    this.velocity.y = Math.max(this.velocity.y, -CONFIG.MAX_FALL_SPEED);

    this.moveAxis("x", this.velocity.x * dt);
    this.moveAxis("z", this.velocity.z * dt);

    this.onGround = false;
    this.moveAxis("y", this.velocity.y * dt);

    const obj = this.getObject();
    if (obj.position.y < -30) {
      this.respawn(0, 0);
    }
  }

  computeAABB(position, min, max) {
    min.set(
      position.x - CONFIG.PLAYER_RADIUS,
      position.y - CONFIG.CAMERA_EYE_OFFSET,
      position.z - CONFIG.PLAYER_RADIUS,
    );
    max.set(
      position.x + CONFIG.PLAYER_RADIUS,
      position.y - CONFIG.CAMERA_EYE_OFFSET + CONFIG.PLAYER_HEIGHT,
      position.z + CONFIG.PLAYER_RADIUS,
    );
  }

  moveAxis(axis, amount) {
    if (amount === 0) {
      return;
    }

    const obj = this.getObject();
    obj.position[axis] += amount;

    this.computeAABB(obj.position, this.tmpMin, this.tmpMax);

    const minX = Math.floor(this.tmpMin.x);
    const maxX = Math.floor(this.tmpMax.x - EPS);
    const minY = Math.floor(this.tmpMin.y);
    const maxY = Math.floor(this.tmpMax.y - EPS);
    const minZ = Math.floor(this.tmpMin.z);
    const maxZ = Math.floor(this.tmpMax.z - EPS);

    let collided = false;

    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          if (!this.world.isSolidAt(x, y, z)) {
            continue;
          }

          collided = true;

          if (axis === "x") {
            if (amount > 0) {
              obj.position.x = Math.min(obj.position.x, x - CONFIG.PLAYER_RADIUS - EPS);
            } else {
              obj.position.x = Math.max(obj.position.x, x + 1 + CONFIG.PLAYER_RADIUS + EPS);
            }
          } else if (axis === "z") {
            if (amount > 0) {
              obj.position.z = Math.min(obj.position.z, z - CONFIG.PLAYER_RADIUS - EPS);
            } else {
              obj.position.z = Math.max(obj.position.z, z + 1 + CONFIG.PLAYER_RADIUS + EPS);
            }
          } else if (axis === "y") {
            const headOffset = CONFIG.PLAYER_HEIGHT - CONFIG.CAMERA_EYE_OFFSET;
            if (amount > 0) {
              obj.position.y = Math.min(obj.position.y, y - headOffset - EPS);
            } else {
              obj.position.y = Math.max(obj.position.y, y + 1 + CONFIG.CAMERA_EYE_OFFSET + EPS);
              this.onGround = true;
            }
          }

          this.computeAABB(obj.position, this.tmpMin, this.tmpMax);
        }
      }
    }

    if (collided) {
      this.velocity[axis] = 0;
    }
  }

  intersectsBlock(x, y, z) {
    const obj = this.getObject();
    this.computeAABB(obj.position, this.tmpMin, this.tmpMax);

    const blockMinX = x;
    const blockMinY = y;
    const blockMinZ = z;
    const blockMaxX = x + 1;
    const blockMaxY = y + 1;
    const blockMaxZ = z + 1;

    return !(
      this.tmpMax.x <= blockMinX ||
      this.tmpMin.x >= blockMaxX ||
      this.tmpMax.y <= blockMinY ||
      this.tmpMin.y >= blockMaxY ||
      this.tmpMax.z <= blockMinZ ||
      this.tmpMin.z >= blockMaxZ
    );
  }
}
