const WS_URL = 'ws://127.0.0.1:18789/'

class WSService {
  constructor() {
    this.ws = null
    this.listeners = new Map()
    this.reconnectInterval = 3000
    this.isConnecting = false
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return
    }

    this.isConnecting = true
    this.ws = new WebSocket(WS_URL)

    this.ws.onopen = () => {
      console.log('[WS] Connected to', WS_URL)
      this.isConnecting = false
      this.emit('open', null)
    }

    this.ws.onclose = () => {
      console.log('[WS] Disconnected')
      this.isConnecting = false
      this.emit('close', null)
      this.reconnect()
    }

    this.ws.onerror = (error) => {
      console.error('[WS] Error:', error)
      this.isConnecting = false
      this.emit('error', error)
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.emit('message', data)
      } catch (e) {
        this.emit('message', event.data)
      }
    }
  }

  reconnect() {
    setTimeout(() => {
      console.log('[WS] Reconnecting...')
      this.connect()
    }, this.reconnectInterval)
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return
    const callbacks = this.listeners.get(event)
    const index = callbacks.indexOf(callback)
    if (index > -1) {
      callbacks.splice(index, 1)
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return
    this.listeners.get(event).forEach(callback => callback(data))
  }
}

export const wsService = new WSService()
export default wsService
