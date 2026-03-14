package main

import (
	"encoding/json"
	"log"
	"sync"
)

// hub maintains the set of active clients and broadcasts messages.
type hub struct {
	// Registered clients.
	clients map[*client]bool

	// Latest known position of each player (keyed by playerID).
	positions map[string]PlayerState

	// Inbound messages from clients to broadcast.
	broadcast chan broadcastMsg

	// Register requests from new clients.
	register chan *client

	// Unregister requests from disconnecting clients.
	unregister chan *client

	// Shared world state (block edits).
	world *WorldState

	mu sync.RWMutex
}

type broadcastMsg struct {
	sender  *client
	payload []byte
}

func newHub(world *WorldState) *hub {
	return &hub{
		clients:    make(map[*client]bool),
		positions:  make(map[string]PlayerState),
		broadcast:  make(chan broadcastMsg, 256),
		register:   make(chan *client),
		unregister: make(chan *client),
		world:      world,
	}
}

func (h *hub) run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			h.clients[c] = true
			h.mu.Unlock()

			// Build init payload: existing players + all world block edits.
			h.mu.RLock()
			players := make([]PlayerState, 0, len(h.positions))
			for _, ps := range h.positions {
				players = append(players, ps)
			}
			h.mu.RUnlock()

			init := InitMsg{
				Type:       MsgInit,
				PlayerID:   c.id,
				Players:    players,
				BlockEdits: h.world.All(),
			}
			data, err := json.Marshal(init)
			if err == nil {
				select {
				case c.send <- data:
				default:
				}
			}

		case c := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[c]; ok {
				delete(h.clients, c)
				delete(h.positions, c.id)
				close(c.send)
			}
			h.mu.Unlock()

			// Notify remaining clients.
			leave := PlayerLeaveMsg{Type: MsgPlayerLeave, PlayerID: c.id}
			data, err := json.Marshal(leave)
			if err == nil {
				h.fanout(nil, data)
			}
			log.Printf("player disconnected: %s", c.id)

		case msg := <-h.broadcast:
			// Decode the message to update server state.
			var in IncomingMessage
			if err := json.Unmarshal(msg.payload, &in); err != nil {
				continue
			}

			switch in.Type {
			case MsgPlayerMove:
				h.mu.Lock()
				h.positions[msg.sender.id] = PlayerState{
					PlayerID: msg.sender.id,
					X:        in.X,
					Y:        in.Y,
					Z:        in.Z,
					Yaw:      in.Yaw,
					Pitch:    in.Pitch,
				}
				h.mu.Unlock()

				// Re-serialize with the server-assigned playerID.
				out := PlayerMoveMsg{
					Type:     MsgPlayerMove,
					PlayerID: msg.sender.id,
					X:        in.X,
					Y:        in.Y,
					Z:        in.Z,
					Yaw:      in.Yaw,
					Pitch:    in.Pitch,
				}
				data, err := json.Marshal(out)
				if err == nil {
					h.fanout(msg.sender, data)
				}

			case MsgBlockChange:
				edit := BlockEdit{X: int(in.X), Y: int(in.Y), Z: int(in.Z), BlockID: in.BlockID}
				h.world.Apply(edit)

				out := BlockChangeMsg{
					Type:     MsgBlockChange,
					PlayerID: msg.sender.id,
					X:        int(in.X),
					Y:        int(in.Y),
					Z:        int(in.Z),
					BlockID:  in.BlockID,
				}
				data, err := json.Marshal(out)
				if err == nil {
					h.fanout(msg.sender, data)
				}
			}
		}
	}
}

// fanout sends data to all clients except the optional sender.
func (h *hub) fanout(sender *client, data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		if c == sender {
			continue
		}
		select {
		case c.send <- data:
		default:
			// Slow client — drop the message rather than blocking.
		}
	}
}
