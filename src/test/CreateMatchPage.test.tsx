import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import CreateMatchPage from '../pages/CreateMatchPage'
import { renderWithRouter } from './render'

describe('CreateMatchPage', () => {
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

  it('shows that invite creation is not available yet', () => {
    renderWithRouter(<CreateMatchPage />)

    expect(
      screen.getByRole('button', { name: 'Create Match Invite' }),
    ).toBeDisabled()
    expect(
      screen.getByText('Invite creation will be connected next.'),
    ).toBeVisible()
  })
})
