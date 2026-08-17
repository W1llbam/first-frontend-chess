import { screen } from '@testing-library/react'
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
    })
})
