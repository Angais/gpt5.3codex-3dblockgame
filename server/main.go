package main

import (
	"fmt"
	"log"
	"math/rand"
	"net/http"

	"github.com/gorilla/websocket"
)

func serveWs(h *hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("upgrade error:", err)
		return
	}

	id := randomID()
	c := &client{
		id:   id,
		hub:  h,
		conn: conn,
		send: make(chan []byte, 256),
	}

	log.Printf("player connected: %s  (%s)", id, r.RemoteAddr)
	h.register <- c

	go c.writePump()
	go c.readPump()
}

// randomID generates a short random hex string to use as a player ID.
func randomID() string {
	b := make([]byte, 6)
	rand.Read(b)
	return fmt.Sprintf("%x", b)
}

func main() {
	world := NewWorldState()
	h := newHub(world)
	go h.run()

	// Serve static game files from the parent directory.
	fs := http.FileServer(http.Dir(".."))
	http.Handle("/", fs)

	// WebSocket endpoint.
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(h, w, r)
	})

	addr := ":8080"
	log.Printf("VoxelCraft server started on http://localhost%s", addr)

	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal("ListenAndServe:", err)
	}
}

// Ensure gorilla/websocket is used (avoids unused-import error in edge cases).
var _ = websocket.IsCloseError
