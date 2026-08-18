import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatchConnection, type MatchConnectionState } from '../../../frontend/src/api/matchConnection'
import type { MatchStatus } from '../../../frontend/src/api/invites'
import { STARTING_FEN } from '../../../frontend/src/chess/board'

class FakeWebSocket {
    static instances: FakeWebSocket[] = []
    onopen: (() => void) | null = null
    onmessage: ((event: { data: string }) => void) | null = null
    onerror: (() => void) | null = null
    onclose: (() => void) | null = null
    readonly url: string

    constructor(url: string) {
        this.url = url
        FakeWebSocket.instances.push(this)
    }

    close() {
        this.onclose?.()
    }
}

const snapshot: MatchStatus = {
    matchId: 'match-123',
    color: 'white',
    status: 'ready',
    fen: STARTING_FEN,
    turn: 'white',
    moveCount: 0,
    lastMove: null,
}

describe('MatchConnection', () => {
    beforeEach(() => {
        FakeWebSocket.instances = []
        vi.stubGlobal('WebSocket', FakeWebSocket)
        vi.useRealTimers()
    })

    it('connects with the match token and forwards snapshots', () => {
        const states: MatchConnectionState[] = []
        const onSnapshot = vi.fn()
        const connection = new MatchConnection('match-123', 'creator token', {
            onState: (state) => states.push(state),
            onSnapshot,
            onReconnect: vi.fn(),
        })

        connection.start()
        const socket = FakeWebSocket.instances[0]
        expect(socket.url).toContain('/api/matches/match-123/events?playerToken=creator%20token')

        socket.onopen?.()
        socket.onmessage?.({ data: JSON.stringify({ type: 'match.updated', match: snapshot }) })

        expect(states).toEqual(['polling-fallback', 'connected'])
        expect(onSnapshot).toHaveBeenCalledWith(snapshot)
        connection.stop()
    })

    it('falls back after disconnect and refreshes after reconnecting', () => {
        vi.useFakeTimers()
        const states: MatchConnectionState[] = []
        const onReconnect = vi.fn()
        const connection = new MatchConnection('match-123', 'token', {
            onState: (state) => states.push(state),
            onSnapshot: vi.fn(),
            onReconnect,
        })

        connection.start()
        const firstSocket = FakeWebSocket.instances[0]
        firstSocket.onopen?.()
        firstSocket.onclose?.()
        expect(states).toContain('polling-fallback')

        vi.advanceTimersByTime(1000)
        const secondSocket = FakeWebSocket.instances[1]
        secondSocket.onopen?.()

        expect(states).toContain('reconnecting')
        expect(onReconnect).toHaveBeenCalledOnce()
        connection.stop()
    })
})
