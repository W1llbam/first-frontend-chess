import { act, screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    getMatchStatus,
    InviteApiError,
    type MatchStatus,
} from '../../../frontend/src/api/invites'
import MatchPage from '../../../frontend/src/pages/MatchPage'
import { STARTING_FEN } from '../../../frontend/src/chess/board'
import { renderWithRouter } from '../render'

type ConnectionHandlers = {
    onState: (state: 'connected' | 'reconnecting' | 'polling-fallback') => void
    onSnapshot: (match: MatchStatus) => void
    onReconnect: () => void | Promise<void>
}

const connectionMock = vi.hoisted(() => ({
    handlers: null as ConnectionHandlers | null,
}))

vi.mock('../../../frontend/src/api/matchConnection', () => ({
    MatchConnection: class {
        constructor(_matchId: string, _playerToken: string, handlers: ConnectionHandlers) {
            connectionMock.handlers = handlers
        }

        start() {
            connectionMock.handlers?.onState('polling-fallback')
        }

        stop() {}
    },
}))

vi.mock('../../../frontend/src/api/invites', async () => {
    const actual = await vi.importActual<typeof import('../../../frontend/src/api/invites')>('../../../frontend/src/api/invites')
    return { ...actual, getMatchStatus: vi.fn() }
})

const mockedGetMatchStatus = vi.mocked(getMatchStatus)
const afterE4Fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

function matchState(overrides: Partial<MatchStatus> = {}): MatchStatus {
    return {
        matchId: 'match-123',
        color: 'white',
        status: 'ready',
        fen: STARTING_FEN,
        turn: 'white',
        moveCount: 0,
        lastMove: null,
        ...overrides,
    }
}

describe('MatchPage real-time fallback', () => {
    beforeEach(() => {
        vi.useRealTimers()
        vi.resetAllMocks()
        connectionMock.handlers = null
        localStorage.clear()
        localStorage.setItem('chess.match.match-123', JSON.stringify({
            inviteId: 'invite-123', playerToken: 'creator-token', color: 'white',
        }))
    })

    function renderMatch() {
        mockedGetMatchStatus.mockResolvedValueOnce(matchState())
        return renderWithRouter(
            <Routes>
                <Route path="/match/:matchId" element={<MatchPage />} />
            </Routes>,
            '/match/match-123',
        )
    }

    it('keeps polling when the reconnect refresh fails', async () => {
        vi.useFakeTimers()
        try {
            renderMatch()
            await act(async () => { await Promise.resolve() })
            expect(screen.getByRole('gridcell', { name: 'e2, White pawn' })).toBeInTheDocument()
            const handlers = connectionMock.handlers!
            handlers.onState('connected')
            mockedGetMatchStatus.mockRejectedValueOnce(new InviteApiError(503, 'Temporary failure'))

            await act(async () => { await handlers.onReconnect() })

            const refreshedState = matchState({ fen: afterE4Fen, turn: 'black', moveCount: 1 })
            mockedGetMatchStatus.mockResolvedValueOnce(refreshedState)
            await act(async () => { await vi.advanceTimersByTimeAsync(2000) })

            expect(mockedGetMatchStatus).toHaveBeenCalledTimes(3)
            expect(screen.getByRole('gridcell', { name: 'e4, White pawn' })).toBeInTheDocument()
        } finally {
            vi.useRealTimers()
        }
    })

    it('stops fallback polling after a successful reconnect refresh', async () => {
        vi.useFakeTimers()
        try {
            renderMatch()
            await act(async () => { await Promise.resolve() })
            expect(screen.getByRole('gridcell', { name: 'e2, White pawn' })).toBeInTheDocument()
            const handlers = connectionMock.handlers!
            handlers.onState('connected')
            mockedGetMatchStatus.mockResolvedValueOnce(matchState({
                fen: afterE4Fen, turn: 'black', moveCount: 1,
            }))

            await act(async () => { await handlers.onReconnect() })
            await act(async () => { await vi.advanceTimersByTimeAsync(2000) })

            expect(mockedGetMatchStatus).toHaveBeenCalledTimes(2)
            expect(screen.getByRole('gridcell', { name: 'e4, White pawn' })).toBeInTheDocument()
        } finally {
            vi.useRealTimers()
        }
    })
})
