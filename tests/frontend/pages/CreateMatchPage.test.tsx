import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInvite } from '../../../frontend/src/api/invites'
import CreateMatchPage from '../../../frontend/src/pages/CreateMatchPage'
import { renderWithRouter } from '../render'

vi.mock('../../../frontend/src/api/invites', () => ({
  createInvite: vi.fn(),
}))

const mockedCreateInvite = vi.mocked(createInvite)

describe('CreateMatchPage', () => {
  beforeEach(() => {
    mockedCreateInvite.mockReset()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('selects random color and unlimited time by default', () => {
    renderWithRouter(<CreateMatchPage />)

    expect(screen.getByRole('radio', { name: /random/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /unlimited/i })).toBeChecked()
  })

  it('updates the selected color and time format', async () => {
    const user = userEvent.setup()
    renderWithRouter(<CreateMatchPage />)

    await user.click(screen.getByRole('radio', { name: /white/i }))
    await user.click(screen.getByRole('radio', { name: /5 minutes/i }))

    expect(screen.getByRole('radio', { name: /white/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /random/i })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /5 minutes/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /unlimited/i })).not.toBeChecked()
  })

  it('creates an invite and shows its shareable URL', async () => {
    const user = userEvent.setup()
    mockedCreateInvite.mockResolvedValue({
      id: 'invite-123',
      status: 'pending',
      color: 'random',
      timeControl: 'unlimited',
      expiresAt: '2026-08-09T12:00:00+00:00',
      matchId: 'match-123',
      creatorToken: 'creator-token',
      creatorColor: 'white',
    })
    renderWithRouter(<CreateMatchPage />)

    await user.click(screen.getByRole('button', { name: 'Create Match Invite' }))

    expect(mockedCreateInvite).toHaveBeenCalledWith({
      color: 'random',
      timeControl: 'unlimited',
    })
  })

  it('shows an error and allows retrying when invite creation fails', async () => {
    const user = userEvent.setup()
    mockedCreateInvite.mockRejectedValue(
      new Error('Unable to create the match invite. Please try again.'),
    )
    renderWithRouter(<CreateMatchPage />)

    await user.click(screen.getByRole('button', { name: 'Create Match Invite' }))

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Unable to create the match invite. Please try again.')
    expect(screen.getByRole('button', { name: 'Create Match Invite' })).toBeEnabled()
  })
})
