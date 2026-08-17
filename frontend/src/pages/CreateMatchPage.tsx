
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    createInvite,
    type ColorChoice,
    type TimeControl,
} from '../api/invites'
import './CreateMatchPage.css'

function CreateMatchPage() {
    const [color, setColor] = useState<ColorChoice>('random')
    const [timeControl, setTimeControl] = useState<TimeControl>('unlimited')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setIsSubmitting(true)
        setError(null)

        try {
            const invite = await createInvite({ color, timeControl })
            localStorage.setItem(`chess.match.${invite.matchId}`, JSON.stringify({
                inviteId: invite.id,
                playerToken: invite.creatorToken,
                color: invite.creatorColor,
            }))
            navigate(`/match/${invite.matchId}`)
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : 'Unable to create the match invite. Please try again.',
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main className="create-match-page">
            <section className="match-settings-card" aria-labelledby="create-match-title">
                <div className="match-settings-intro">
                    <p className="eyebrow">New game</p>
                    <h1 id="create-match-title">Create a Match</h1>
                    <p>Choose your settings, then invite a friend to play.</p>
                </div>

                <form className="match-settings-form" onSubmit={handleSubmit}>
                    <fieldset>
                        <legend>Choose your color</legend>
                        <div className="option-grid option-grid--colors">
                            <label className={`option-card ${color === 'white' ? 'option-card--selected' : ''}`}>
                                <input
                                    type="radio"
                                    name="color"
                                    value="white"
                                    checked={color === 'white'}
                                    onChange={() => setColor('white')}
                                />
                                <span className="option-card__icon option-card__icon--light" aria-hidden="true">♙</span>
                                <span className="option-card__content">
                                    <strong>White</strong>
                                    <small>Move first</small>
                                </span>
                            </label>

                            <label className={`option-card ${color === 'black' ? 'option-card--selected' : ''}`}>
                                <input
                                    type="radio"
                                    name="color"
                                    value="black"
                                    checked={color === 'black'}
                                    onChange={() => setColor('black')}
                                />
                                <span className="option-card__icon option-card__icon--dark" aria-hidden="true">♟</span>
                                <span className="option-card__content">
                                    <strong>Black</strong>
                                    <small>Move second</small>
                                </span>
                            </label>

                            <label className={`option-card ${color === 'random' ? 'option-card--selected' : ''}`}>
                                <input
                                    type="radio"
                                    name="color"
                                    value="random"
                                    checked={color === 'random'}
                                    onChange={() => setColor('random')}
                                />
                                <span className="option-card__icon option-card__icon--random" aria-hidden="true">?</span>
                                <span className="option-card__content">
                                    <strong>Random</strong>
                                    <small>Let fate decide</small>
                                </span>
                            </label>
                        </div>
                    </fieldset>

                    <fieldset>
                        <legend>Choose a time format</legend>
                        <div className="option-grid option-grid--time">
                            <label className={`option-card ${timeControl === 'unlimited' ? 'option-card--selected' : ''}`}>
                                <input
                                    type="radio"
                                    name="time-control"
                                    value="unlimited"
                                    checked={timeControl === 'unlimited'}
                                    onChange={() => setTimeControl('unlimited')}
                                />
                                <span className="option-card__content">
                                    <strong>Unlimited</strong>
                                    <small>Take your time</small>
                                </span>
                            </label>

                            <label className={`option-card ${timeControl === '10-minutes' ? 'option-card--selected' : ''}`}>
                                <input
                                    type="radio"
                                    name="time-control"
                                    value="10-minutes"
                                    checked={timeControl === '10-minutes'}
                                    onChange={() => setTimeControl('10-minutes')}
                                />
                                <span className="option-card__content">
                                    <strong>10 minutes</strong>
                                    <small>Casual pace</small>
                                </span>
                            </label>

                            <label className={`option-card ${timeControl === '5-minutes' ? 'option-card--selected' : ''}`}>
                                <input
                                    type="radio"
                                    name="time-control"
                                    value="5-minutes"
                                    checked={timeControl === '5-minutes'}
                                    onChange={() => setTimeControl('5-minutes')}
                                />
                                <span className="option-card__content">
                                    <strong>5 minutes</strong>
                                    <small>Quick game</small>
                                </span>
                            </label>
                        </div>
                    </fieldset>

                    <button className="create-invite-button" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Creating invite...' : 'Create Match Invite'}
                    </button>

                    {error && <p className="invite-error" role="alert">{error}</p>}

                </form>

                <Link className="back-home-link" to="/">← Back to home</Link>
            </section>
        </main>
    )
}

export default CreateMatchPage
