import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { getMatchStatus } from '../../../frontend/src/api/invites'
import MatchPage from '../../../frontend/src/pages/MatchPage'
import { renderWithRouter } from '../render'

vi.mock('../../../frontend/src/api/invites', async () => {
    const actual = await vi.importActual<typeof import('../../../frontend/src/api/invites')>('../../../frontend/src/api/invites')
    return { ...actual, getMatchStatus: vi.fn() }
})

const mockedGetMatchStatus = vi.mocked(getMatchStatus)

describe('MatchPage', () => {
    function renderMatch() {
        localStorage.clear()
        localStorage.setItem('chess.match.match-123', JSON.stringify({
            inviteId: 'invite-123', playerToken: 'creator-token', color: 'white',
        }))
        mockedGetMatchStatus.mockResolvedValue({ matchId: 'match-123', color: 'white', status: 'ready' })
        return renderWithRouter(
            <Routes>
                <Route path="/match/:matchId" element={<MatchPage />} />
            </Routes>,
            '/match/match-123',
        )
    }

    it('shows the player color, match status, and starting board', () => {
        localStorage.clear()
        localStorage.setItem('chess.match.match-123', JSON.stringify({
            inviteId: 'invite-123', playerToken: 'creator-token', color: 'black',
        }))
        mockedGetMatchStatus.mockResolvedValue({ matchId: 'match-123', color: 'black', status: 'ready' })
        renderWithRouter(
            <Routes>
                <Route path="/match/:matchId" element={<MatchPage />} />
            </Routes>,
            '/match/match-123',
        )

        expect(screen.getByRole('heading', { name: 'Your chessboard' })).toBeInTheDocument()
        expect(screen.getByText(/You are playing black/)).toBeInTheDocument()
        expect(screen.getByText('Match: match-123')).toBeInTheDocument()
        expect(screen.getByRole('grid', { name: 'Chessboard' })).toBeInTheDocument()
        expect(screen.getByRole('gridcell', { name: 'e2, White pawn' })).toBeInTheDocument()
        expect(screen.getByText(/White to move/)).toBeInTheDocument()
    })

    it('highlights legal destinations and moves a pawn locally', async () => {
        const user = userEvent.setup()
        renderMatch()

        await user.click(screen.getByRole('gridcell', { name: 'e2, White pawn' }))

        expect(screen.getByRole('gridcell', { name: 'e3, empty' })).toHaveClass('legal-target')
        expect(screen.getByRole('gridcell', { name: 'e4, empty' })).toHaveClass('legal-target')

        await user.click(screen.getByRole('gridcell', { name: 'e4, empty' }))

        expect(screen.getByRole('gridcell', { name: 'e4, White pawn' })).toBeInTheDocument()
        expect(screen.getByRole('gridcell', { name: 'e2, empty' })).toBeInTheDocument()
        expect(screen.getByText(/Black to move/)).toBeInTheDocument()
    })

    it('ignores illegal destinations and supports captures', async () => {
        const user = userEvent.setup()
        renderMatch()

        await user.click(screen.getByRole('gridcell', { name: 'e2, White pawn' }))
        await user.click(screen.getByRole('gridcell', { name: 'e5, empty' }))
        expect(screen.getByRole('gridcell', { name: 'e2, White pawn' })).toBeInTheDocument()

        await user.click(screen.getByRole('gridcell', { name: 'e2, White pawn' }))
        await user.click(screen.getByRole('gridcell', { name: 'e4, empty' }))
        await user.click(screen.getByRole('gridcell', { name: 'd7, Black pawn' }))
        await user.click(screen.getByRole('gridcell', { name: 'd5, empty' }))
        await user.click(screen.getByRole('gridcell', { name: 'e4, White pawn' }))
        await user.click(screen.getByRole('gridcell', { name: 'd5, Black pawn' }))

        expect(screen.getByRole('gridcell', { name: 'd5, White pawn' })).toBeInTheDocument()
        expect(screen.getByText(/Black to move/)).toBeInTheDocument()
    })

    it('resets the local board to the starting position', async () => {
        const user = userEvent.setup()
        renderMatch()

        await user.click(screen.getByRole('gridcell', { name: 'e2, White pawn' }))
        await user.click(screen.getByRole('gridcell', { name: 'e4, empty' }))
        await user.click(screen.getByRole('button', { name: 'Reset board' }))

        expect(screen.getByRole('gridcell', { name: 'e2, White pawn' })).toBeInTheDocument()
        expect(screen.getByRole('gridcell', { name: 'e4, empty' })).toBeInTheDocument()
        expect(screen.getByText(/White to move/)).toBeInTheDocument()
    })
})
