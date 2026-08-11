import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { getInvite, InviteApiError } from '../../../frontend/src/api/invites'
import InvitePage from '../../../frontend/src/pages/InvitePage'
import { renderWithRouter } from '../render'

vi.mock('../../../frontend/src/api/invites', async () => {
    const actual = await vi.importActual<typeof import('../../../frontend/src/api/invites')>('../../../frontend/src/api/invites')
    return { ...actual, getInvite: vi.fn() }
})

const mockedGetInvite = vi.mocked(getInvite)

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
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
        })
    })

    it('loads and displays a valid invite', async () => {
        mockedGetInvite.mockResolvedValue(invite)
        renderInvitePage()

        expect(await screen.findByRole('heading', { name: 'Your invite link is ready' })).toBeInTheDocument()
        expect(screen.getByLabelText('Invite link')).toHaveValue('http://localhost:3000/invite/invite-123')
    })

    it('copies the invite link', async () => {
        const user = userEvent.setup()
        const writeText = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
        mockedGetInvite.mockResolvedValue(invite)
        renderInvitePage()

        await user.click(await screen.findByRole('button', { name: 'Copy link' }))

        expect(writeText).toHaveBeenCalledWith('http://localhost:3000/invite/invite-123')
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
