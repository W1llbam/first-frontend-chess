import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    getMatchStatus,
    InviteApiError,
    submitMove,
    type MatchStatus,
} from '../../../frontend/src/api/invites'
import MatchPage from '../../../frontend/src/pages/MatchPage'
import { STARTING_FEN } from '../../../frontend/src/chess/board'
import { renderWithRouter } from '../render'

vi.mock('../../../frontend/src/api/invites', async () => {
    const actual = await vi.importActual<typeof import('../../../frontend/src/api/invites')>('../../../frontend/src/api/invites')
    return { ...actual, getMatchStatus: vi.fn(), submitMove: vi.fn() }
})

const mockedGetMatchStatus = vi.mocked(getMatchStatus)
const mockedSubmitMove = vi.mocked(submitMove)

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
        gameStatus: 'active',
        winner: null,
        drawReason: null,
        ...overrides,
    }
}

describe('MatchPage', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    function renderMatch(state = matchState(), polledStates: MatchStatus[] = []) {
        localStorage.clear()
        localStorage.setItem('chess.match.match-123', JSON.stringify({
            inviteId: 'invite-123', playerToken: 'creator-token', color: 'white',
        }))
        mockedGetMatchStatus.mockResolvedValueOnce(state)
        for (const polledState of polledStates) mockedGetMatchStatus.mockResolvedValueOnce(polledState)
        return renderWithRouter(
            <Routes>
                <Route path="/match/:matchId" element={<MatchPage />} />
            </Routes>,
            '/match/match-123',
        )
    }

    it('renders the board from the server-provided FEN', async () => {
        renderMatch(matchState({ fen: afterE4Fen, turn: 'black', moveCount: 1 }))

        expect(await screen.findByRole('gridcell', { name: 'e4, White pawn' })).toBeInTheDocument()
        expect(screen.getByRole('gridcell', { name: 'e2, empty' })).toBeInTheDocument()
        expect(screen.getByText(/Black to move/)).toBeInTheDocument()
    })

    it('shows the player color, match status, and accessible chessboard', async () => {
        renderMatch(matchState({ color: 'black' }))

        expect(screen.getByRole('heading', { name: 'Your chessboard' })).toBeInTheDocument()
        expect(await screen.findByText(/You are playing black/)).toBeInTheDocument()
        expect(screen.getByText('Match: match-123')).toBeInTheDocument()
        expect(screen.getByRole('grid', { name: 'Chessboard' })).toBeInTheDocument()
        expect(await screen.findByRole('gridcell', { name: 'e2, White pawn' })).toBeInTheDocument()
        expect(screen.getByText(/White to move/)).toBeInTheDocument()
    })

    it('highlights the checked king while keeping interaction enabled', async () => {
        const checkFen = '4k3/4R3/8/8/8/8/8/4K3 b - - 1 1'
        renderMatch(matchState({
            fen: checkFen,
            turn: 'black',
            gameStatus: 'check',
        }))

        const king = await screen.findByRole('gridcell', { name: 'e8, Black king' })
        expect(king).toHaveClass('in-check')
        expect(king).not.toBeDisabled()
        expect(screen.getByRole('status')).toHaveTextContent('Black is in check.')
    })

    it('does not highlight a king in an active position', async () => {
        renderMatch(matchState())

        const king = await screen.findByRole('gridcell', { name: 'e8, Black king' })
        expect(king).not.toHaveClass('in-check')
    })

    it('shows the winner and disables the final board after checkmate', async () => {
        const checkmateFen = '7k/6Q1/6K1/8/8/8/8/8 b - - 1 1'
        renderMatch(matchState({
            fen: checkmateFen,
            turn: 'black',
            gameStatus: 'checkmate',
            winner: 'white',
        }))

        expect(await screen.findByRole('status')).toHaveTextContent('Checkmate. White wins.')
        expect(screen.getByRole('grid')).toBeInTheDocument()
        expect(screen.getAllByRole('gridcell').every((square) => (square as HTMLButtonElement).disabled)).toBe(true)
    })

    it('shows the draw reason and preserves the final board', async () => {
        renderMatch(matchState({
            gameStatus: 'draw',
            drawReason: 'insufficient-material',
        }))

        expect(await screen.findByRole('status')).toHaveTextContent('Draw by insufficient material.')
        expect(screen.getByRole('grid')).toBeInTheDocument()
    })

    it('highlights legal destinations and submits the selected move', async () => {
        const user = userEvent.setup()
        const nextState = matchState({
            fen: afterE4Fen,
            turn: 'black',
            moveCount: 1,
            lastMove: { from: 'e2', to: 'e4', promotion: null, san: 'e4' },
        })
        mockedSubmitMove.mockResolvedValue(nextState)
        renderMatch()

        await user.click(await screen.findByRole('gridcell', { name: 'e2, White pawn' }))
        expect(screen.getByRole('gridcell', { name: 'e3, empty' })).toHaveClass('legal-target')
        expect(screen.getByRole('gridcell', { name: 'e4, empty' })).toHaveClass('legal-target')

        await user.click(screen.getByRole('gridcell', { name: 'e4, empty' }))

        expect(mockedSubmitMove).toHaveBeenCalledWith('match-123', 'creator-token', {
            from: 'e2', to: 'e4', promotion: null,
        })
        expect(await screen.findByRole('gridcell', { name: 'e4, White pawn' })).toBeInTheDocument()
        expect(screen.getByText(/Black to move/)).toBeInTheDocument()
    })

    it('does not update the board until the move succeeds', async () => {
        const user = userEvent.setup()
        let resolveMove!: (state: MatchStatus) => void
        mockedSubmitMove.mockReturnValue(new Promise((resolve) => { resolveMove = resolve }))
        renderMatch()

        await user.click(await screen.findByRole('gridcell', { name: 'e2, White pawn' }))
        await user.click(screen.getByRole('gridcell', { name: 'e4, empty' }))

        expect(screen.getByRole('gridcell', { name: 'e2, White pawn' })).toBeInTheDocument()
        expect(screen.getByText('Submitting move…')).toBeInTheDocument()

        resolveMove(matchState({ fen: afterE4Fen, turn: 'black', moveCount: 1 }))
        expect(await screen.findByRole('gridcell', { name: 'e4, White pawn' })).toBeInTheDocument()
    })

    it('prevents duplicate submissions while a move is pending', async () => {
        const user = userEvent.setup()
        let resolveMove!: (state: MatchStatus) => void
        mockedSubmitMove.mockReturnValue(new Promise((resolve) => { resolveMove = resolve }))
        renderMatch()

        await user.click(await screen.findByRole('gridcell', { name: 'e2, White pawn' }))
        await user.click(screen.getByRole('gridcell', { name: 'e4, empty' }))
        await user.click(screen.getByRole('gridcell', { name: 'e4, empty' }))

        expect(mockedSubmitMove).toHaveBeenCalledTimes(1)
        resolveMove(matchState({ fen: afterE4Fen, turn: 'black', moveCount: 1 }))
    })

    it('keeps the board unchanged and displays backend move errors', async () => {
        const user = userEvent.setup()
        mockedSubmitMove.mockRejectedValue(new InviteApiError(409, "It is black's turn."))
        renderMatch()

        await user.click(await screen.findByRole('gridcell', { name: 'e2, White pawn' }))
        await user.click(screen.getByRole('gridcell', { name: 'e4, empty' }))

        expect(await screen.findByRole('alert')).toHaveTextContent("It is black's turn.")
        expect(screen.getByRole('gridcell', { name: 'e2, White pawn' })).toBeInTheDocument()
    })

    it('updates when polling receives an opponent move', async () => {
        vi.useFakeTimers()
        try {
            renderMatch(matchState(), [matchState({
                fen: afterE4Fen, turn: 'black', moveCount: 1,
            })])

            await act(async () => { await vi.advanceTimersByTimeAsync(0) })
            expect(screen.getByRole('gridcell', { name: 'e2, White pawn' })).toBeInTheDocument()
            await act(async () => { await vi.advanceTimersByTimeAsync(2000) })

            expect(screen.getByRole('gridcell', { name: 'e4, White pawn' })).toBeInTheDocument()
        } finally {
            vi.useRealTimers()
        }
    })

    it('does not let an older poll overwrite a newer position', async () => {
        vi.useFakeTimers()
        try {
            renderMatch(matchState(), [
                matchState({ fen: afterE4Fen, turn: 'black', moveCount: 1 }),
                matchState(),
            ])

            await act(async () => { await vi.advanceTimersByTimeAsync(0) })
            await act(async () => { await vi.advanceTimersByTimeAsync(4000) })

            expect(screen.getByRole('gridcell', { name: 'e4, White pawn' })).toBeInTheDocument()
            expect(screen.getByRole('gridcell', { name: 'e2, empty' })).toBeInTheDocument()
        } finally {
            vi.useRealTimers()
        }
    })

    it('does not render a local reset control', async () => {
        renderMatch()
        await screen.findByRole('gridcell', { name: 'e2, White pawn' })
        expect(screen.queryByRole('button', { name: 'Reset board' })).not.toBeInTheDocument()
    })
})
