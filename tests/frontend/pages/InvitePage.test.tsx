import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { getInvite, InviteApiError, joinInvite } from '../../../frontend/src/api/invites'
import InvitePage from '../../../frontend/src/pages/InvitePage'
import { renderWithRouter } from '../render'

vi.mock('../../../frontend/src/api/invites', async () => {
    const actual = await vi.importActual<typeof import('../../../frontend/src/api/invites')>('../../../frontend/src/api/invites')
    return { ...actual, getInvite: vi.fn(), joinInvite: vi.fn() }
})

const mockedGetInvite = vi.mocked(getInvite)
const mockedJoinInvite = vi.mocked(joinInvite)

const invite = {
    id: 'invite-123',
    status: 'pending' as const,
    color: 'random' as const,
    timeControl: 'unlimited' as const,
    expiresAt: '2026-08-09T12:00:00+00:00',
}

function renderInvitePage() {
    return renderWithRouter(
        <Routes><Route path="/invite/:inviteId" element={<InvitePage />} /></Routes>,
        '/invite/invite-123',
    )
}

describe('InvitePage', () => {
    beforeEach(() => {
        mockedGetInvite.mockReset()
        mockedJoinInvite.mockReset()
        localStorage.clear()
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
        })
    })

    it('automatically joins a valid invite and navigates to the match', async () => {
        mockedGetInvite.mockResolvedValue(invite)
        mockedJoinInvite.mockResolvedValue({
            matchId: 'match-123', playerToken: 'opponent-token', color: 'black', status: 'ready',
        })
        renderWithRouter(
            <Routes>
                <Route path="/invite/:inviteId" element={<InvitePage />} />
                <Route path="/match/:matchId" element={<p>Match page</p>} />
            </Routes>,
            '/invite/invite-123',
        )

        expect(await screen.findByText('Match page')).toBeInTheDocument()
        expect(mockedJoinInvite).toHaveBeenCalledWith('invite-123')
        expect(localStorage.getItem('chess.match.match-123')).toContain('opponent-token')
    })

    it('redirects the creator back to their existing match instead of joining', async () => {
        mockedGetInvite.mockResolvedValue(invite)
        localStorage.setItem('chess.match.match-123', JSON.stringify({
            inviteId: 'invite-123', playerToken: 'creator-token', color: 'white',
        }))
        renderWithRouter(
            <Routes>
                <Route path="/invite/:inviteId" element={<InvitePage />} />
                <Route path="/match/:matchId" element={<p>Creator match</p>} />
            </Routes>,
            '/invite/invite-123',
        )

        expect(await screen.findByText('Creator match')).toBeInTheDocument()
        expect(mockedJoinInvite).not.toHaveBeenCalled()
    })

    it.each([
        [404, 'This invite could not be found.'],
        [410, 'This invite has expired.'],
    ])('shows the appropriate message for status %s', async (status, message) => {
        mockedGetInvite.mockRejectedValue(new InviteApiError(status))
        renderInvitePage()

        expect(await screen.findByText(message)).toBeInTheDocument()
    })
})
