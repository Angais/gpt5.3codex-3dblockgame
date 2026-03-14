package main

// MsgType constants for all WebSocket message kinds.
const (
	MsgInit        = "init"
	MsgPlayerMove  = "player_move"
	MsgBlockChange = "block_change"
	MsgPlayerLeave = "player_leave"
)

// IncomingMessage is the envelope used to decode any message from a client.
type IncomingMessage struct {
	Type     string  `json:"type"`
	PlayerID string  `json:"playerId"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Z        float64 `json:"z"`
	Yaw      float64 `json:"yaw"`
	Pitch    float64 `json:"pitch"`
	BlockID  int     `json:"blockId"`
}

// InitMsg is sent once to a new client when they connect.
type InitMsg struct {
	Type       string        `json:"type"`
	PlayerID   string        `json:"playerId"`
	Players    []PlayerState `json:"players"`
	BlockEdits []BlockEdit   `json:"blockEdits"`
}

// PlayerMoveMsg broadcasts a player's position/orientation.
type PlayerMoveMsg struct {
	Type     string  `json:"type"`
	PlayerID string  `json:"playerId"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Z        float64 `json:"z"`
	Yaw      float64 `json:"yaw"`
	Pitch    float64 `json:"pitch"`
}

// BlockChangeMsg broadcasts a single block edit.
type BlockChangeMsg struct {
	Type     string `json:"type"`
	PlayerID string `json:"playerId"`
	X        int    `json:"x"`
	Y        int    `json:"y"`
	Z        int    `json:"z"`
	BlockID  int    `json:"blockId"`
}

// PlayerLeaveMsg notifies remaining clients that someone disconnected.
type PlayerLeaveMsg struct {
	Type     string `json:"type"`
	PlayerID string `json:"playerId"`
}

// PlayerState is a snapshot of a player used in InitMsg.
type PlayerState struct {
	PlayerID string  `json:"playerId"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Z        float64 `json:"z"`
	Yaw      float64 `json:"yaw"`
	Pitch    float64 `json:"pitch"`
}
