package main

import (
	"fmt"
	"sync"
)

// BlockEdit is a single voxel change persisted on the server.
type BlockEdit struct {
	X       int `json:"x"`
	Y       int `json:"y"`
	Z       int `json:"z"`
	BlockID int `json:"blockId"`
}

// WorldState holds the authoritative in-memory record of all block edits.
type WorldState struct {
	mu    sync.RWMutex
	edits map[string]BlockEdit
}

// NewWorldState creates an empty WorldState.
func NewWorldState() *WorldState {
	return &WorldState{
		edits: make(map[string]BlockEdit),
	}
}

// Apply records (or removes, if blockId == 0 / AIR) a block edit.
func (w *WorldState) Apply(edit BlockEdit) {
	key := fmt.Sprintf("%d,%d,%d", edit.X, edit.Y, edit.Z)
	w.mu.Lock()
	defer w.mu.Unlock()
	if edit.BlockID == 0 {
		delete(w.edits, key)
	} else {
		w.edits[key] = edit
	}
}

// All returns a snapshot of every non-air block edit.
func (w *WorldState) All() []BlockEdit {
	w.mu.RLock()
	defer w.mu.RUnlock()
	result := make([]BlockEdit, 0, len(w.edits))
	for _, e := range w.edits {
		result = append(result, e)
	}
	return result
}
