/**
 * NetworkClient — manages the WebSocket connection to the Go multiplayer server.
 *
 * Options (all optional callbacks):
 *   onInit(data)        – called once on connect with {playerId, players[], blockEdits[]}
 *   onPlayerMove(data)  – called when another player moves {playerId, x, y, z, yaw, pitch}
 *   onBlockChange(data) – called when another player edits a block {playerId, x, y, z, blockId}
 *   onPlayerLeave(data) – called when a player disconnects {playerId}
 *   onOpen()            – called when the socket is ready
 *   onClose()           – called when the socket closes
 */
export class NetworkClient {
  constructor(url = `ws://${location.host}/ws`, callbacks = {}) {
    this.url = url;
    this.callbacks = callbacks;
    this.ws = null;
    this.connected = false;
    this.playerId = null;

    // Throttle move sends: store latest pending move, flush on interval.
    this._pendingMove = null;
    this._moveInterval = setInterval(() => this._flushMove(), 50); // 20 Hz

    this._connect();
  }

  _connect() {
    this.ws = new WebSocket(this.url);

    this.ws.addEventListener("open", () => {
      this.connected = true;
      console.log("[Network] Connected to", this.url);
      this.callbacks.onOpen?.();
    });

    this.ws.addEventListener("close", () => {
      this.connected = false;
      console.log("[Network] Disconnected");
      this.callbacks.onClose?.();
    });

    this.ws.addEventListener("error", (e) => {
      console.warn("[Network] WebSocket error", e);
    });

    this.ws.addEventListener("message", (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      this._handleMessage(msg);
    });
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case "init":
        this.playerId = msg.playerId;
        console.log("[Network] My player ID:", this.playerId);
        this.callbacks.onInit?.(msg);
        break;
      case "player_move":
        // Ignore echoes of our own position (server never sends them back,
        // but safeguard anyway).
        if (msg.playerId !== this.playerId) {
          this.callbacks.onPlayerMove?.(msg);
        }
        break;
      case "block_change":
        if (msg.playerId !== this.playerId) {
          this.callbacks.onBlockChange?.(msg);
        }
        break;
      case "player_leave":
        this.callbacks.onPlayerLeave?.(msg);
        break;
      default:
        console.warn("[Network] Unknown message type:", msg.type);
    }
  }

  _send(obj) {
    if (this.connected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  _flushMove() {
    if (this._pendingMove) {
      this._send(this._pendingMove);
      this._pendingMove = null;
    }
  }

  /**
   * Queue a player position update. Sends at most 20 Hz.
   * @param {{x,y,z}} position  - eye position (THREE.Vector3 or plain object)
   * @param {number}  yaw       - camera horizontal rotation (radians)
   * @param {number}  pitch     - camera vertical rotation (radians)
   */
  sendMove(position, yaw, pitch) {
    this._pendingMove = {
      type: "player_move",
      x: position.x,
      y: position.y,
      z: position.z,
      yaw,
      pitch,
    };
  }

  /**
   * Notify the server (and all other clients) that a block was changed.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} blockId  - 0 = AIR (break)
   */
  sendBlockChange(x, y, z, blockId) {
    this._send({
      type: "block_change",
      x,
      y,
      z,
      blockId,
    });
  }

  dispose() {
    clearInterval(this._moveInterval);
    if (this.ws) {
      this.ws.close();
    }
  }
}
