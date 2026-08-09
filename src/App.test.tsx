import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { renderWithRouter } from './test/render'

describe('App routes', () => {
  it('shows the home page at the root route', () => {
    renderWithRouter(<App />)

    expect(
      screen.getByRole('heading', { name: 'Play chess with a friend' }),
    ).toBeInTheDocument()
  })

  it('navigates to match settings from the Create Match link', async () => {
    const user = userEvent.setup()
    renderWithRouter(<App />)

    await user.click(screen.getByRole('link', { name: 'Create Match' }))

    expect(
      screen.getByRole('heading', { name: 'Create a Match' }),
    ).toBeInTheDocument()
  })

  it('shows match settings when opened directly', () => {
    renderWithRouter(<App />, '/create-match')

    expect(
      screen.getByRole('heading', { name: 'Create a Match' }),
    ).toBeInTheDocument()
  })
})
