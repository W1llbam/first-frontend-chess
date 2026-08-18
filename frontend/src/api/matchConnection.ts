import type { MatchStatus } from './invites'

export type MatchConnectionState = 'connected' | 'reconnecting' | 'polling-fallback'

export interface MatchConnectionHandlers {
  onState: (state: MatchConnectionState) => void
  onSnapshot: (match: MatchStatus) => void
  onReconnect: () => void | Promise<void>
}

type MatchEvent = { type: 'match.updated'; match: MatchStatus }

export class MatchConnection {
  private socket: WebSocket | null = null
  private reconnectTimer: number | null = null
  private reconnectAttempt = 0
  private isStopped = false
  private readonly matchId: string
  private readonly playerToken: string
  private readonly handlers: MatchConnectionHandlers

  constructor(
    matchId: string,
    playerToken: string,
    handlers: MatchConnectionHandlers,
  ) {
    this.matchId = matchId
    this.playerToken = playerToken
    this.handlers = handlers
  }

  start() {
    if (typeof WebSocket === 'undefined') {
      this.handlers.onState('polling-fallback')
      return
    }

    this.connect()
  }

  stop() {
    this.isStopped = true
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.socket?.close()
    this.socket = null
  }

  private connect() {
    if (this.isStopped) return
    this.handlers.onState(this.reconnectAttempt === 0 ? 'polling-fallback' : 'reconnecting')

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/api/matches/${encodeURIComponent(this.matchId)}/events?playerToken=${encodeURIComponent(this.playerToken)}`
    const socket = new WebSocket(url)
    this.socket = socket

    socket.onopen = () => {
      if (this.isStopped) return
      const wasReconnecting = this.reconnectAttempt > 0
      this.reconnectAttempt = 0
      this.handlers.onState('connected')
      if (wasReconnecting) void this.handlers.onReconnect()
    }

    socket.onmessage = (event) => {
      const parsed = this.parseEvent(event.data)
      if (parsed) this.handlers.onSnapshot(parsed.match)
    }

    socket.onerror = () => socket.close()
    socket.onclose = () => {
      if (this.isStopped || this.socket !== socket) return
      this.socket = null
      this.handlers.onState('polling-fallback')
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null || this.isStopped) return
    this.reconnectAttempt += 1
    const delay = Math.min(1000 * 2 ** (this.reconnectAttempt - 1), 10000)
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  private parseEvent(data: unknown): MatchEvent | null {
    if (typeof data !== 'string') return null
    try {
      const event = JSON.parse(data) as Partial<MatchEvent>
      if (
        event.type === 'match.updated'
        && event.match?.matchId === this.matchId
        && typeof event.match.fen === 'string'
        && typeof event.match.moveCount === 'number'
      ) {
        return event as MatchEvent
      }
    } catch {
      // Ignore malformed events; polling remains the recovery path.
    }
    return null
  }
}
