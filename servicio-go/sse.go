package main

import "sync"

// HubSSE mantiene las conexiones SSE abiertas, agrupadas por usuario. Cuando
// se genera una alerta se empuja a todas las conexiones de ese usuario, sin
// que el navegador tenga que preguntar cada X segundos (polling).
type HubSSE struct {
	mu          sync.RWMutex
	conexiones  map[string]map[chan Notificacion]struct{}
}

func NuevoHubSSE() *HubSSE {
	return &HubSSE{conexiones: make(map[string]map[chan Notificacion]struct{})}
}

// Suscribir registra una conexión para el usuario y devuelve el canal por el
// que llegan las alertas y una función para cerrar la conexión.
func (h *HubSSE) Suscribir(usuarioID string) (<-chan Notificacion, func()) {
	ch := make(chan Notificacion, 16)
	h.mu.Lock()
	if h.conexiones[usuarioID] == nil {
		h.conexiones[usuarioID] = make(map[chan Notificacion]struct{})
	}
	h.conexiones[usuarioID][ch] = struct{}{}
	h.mu.Unlock()

	cerrar := func() {
		h.mu.Lock()
		if conjunto, ok := h.conexiones[usuarioID]; ok {
			delete(conjunto, ch)
			if len(conjunto) == 0 {
				delete(h.conexiones, usuarioID)
			}
		}
		h.mu.Unlock()
		close(ch)
	}
	return ch, cerrar
}

// Publicar entrega la notificación a las conexiones abiertas del usuario.
// Si un cliente va lento, se descarta el mensaje en vez de bloquear al
// productor (el aviso queda igual guardado en la lista de notificaciones).
func (h *HubSSE) Publicar(usuarioID string, n Notificacion) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for ch := range h.conexiones[usuarioID] {
		select {
		case ch <- n:
		default:
		}
	}
}

// Conexiones devuelve cuántas conexiones SSE tiene abiertas un usuario.
func (h *HubSSE) Conexiones(usuarioID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.conexiones[usuarioID])
}
