import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getMatchStatus, InviteApiError, type MatchStatus } from '../api/invites'
import './MatchPage.css'

type MatchSession = { inviteId: string; playerToken: string; color: 'white' | 'black' }

const pieces = [
    ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
    ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
    ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖'],
]

function MatchPage() {
    const { matchId } = useParams<{ matchId: string }>()
    const [match, setMatch] = useState<MatchStatus | null>(null)
    const [errorStatus, setErrorStatus] = useState<number | null>(null)
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle')
    const [hasLoaded, setHasLoaded] = useState(false)
    const session = matchId ? readMatchSession(matchId) : null
    const playerToken = session?.playerToken

    useEffect(() => {
        if (!matchId || !playerToken) return

        let isActive = true
        async function refreshMatch() {
            try {
                const nextMatch = await getMatchStatus(matchId!, playerToken!)
                if (isActive) {
                    setMatch(nextMatch)
                    setErrorStatus(null)
                    setHasLoaded(true)
                }
            } catch (caughtError: unknown) {
                if (isActive && caughtError instanceof InviteApiError) setErrorStatus(caughtError.status)
            }
        }

        refreshMatch()
        const interval = window.setInterval(refreshMatch, 2000)
        return () => {
            isActive = false
            window.clearInterval(interval)
        }
    }, [matchId, playerToken])

    async function handleCopyInvite() {
        if (!session) return
        await navigator.clipboard.writeText(`${window.location.origin}/invite/${session.inviteId}`)
        setCopyStatus('copied')
    }

    if (!session || !matchId) {
        return <main className="match-page"><p>This match session is unavailable.</p></main>
    }

    if (errorStatus !== null && !hasLoaded) {
        return <main className="match-page"><p>Unable to load this match. Please try again.</p></main>
    }

    const color = match?.color ?? session.color
    const status = match?.status ?? 'waiting'

    return (
        <main className="match-page">
            <section className="match-card" aria-labelledby="match-title">
                <p className="eyebrow">Private match</p>
                <h1 id="match-title">Your chessboard</h1>
                <p>
                    You are playing {color}. {status === 'waiting'
                        ? 'Share the invite link and wait for your opponent.'
                        : 'Your opponent has joined.'}
                </p>
                <p>Match: {matchId}</p>
                {status === 'waiting' && (
                    <button type="button" onClick={handleCopyInvite}>
                        {copyStatus === 'copied' ? 'Invite copied!' : 'Copy invite link'}
                    </button>
                )}
                <div className="chessboard" aria-label="Chessboard" role="grid">
                    {pieces.flatMap((row, rowIndex) => row.map((piece, columnIndex) => (
                        <div
                            className={`square ${(rowIndex + columnIndex) % 2 === 0 ? 'light' : 'dark'}`}
                            key={`${rowIndex}-${columnIndex}`}
                        >
                            {piece}
                        </div>
                    )))}
                </div>
                <p className="match-note">Moves and multiplayer synchronization are coming next.</p>
                <Link className="match-link" to="/">Return home</Link>
            </section>
        </main>
    )
}

function readMatchSession(matchId: string): MatchSession | null {
    const value = localStorage.getItem(`chess.match.${matchId}`)
    if (!value) return null

    try {
        const session = JSON.parse(value) as Partial<MatchSession>
        if (
            typeof session.inviteId === 'string'
            && typeof session.playerToken === 'string'
            && (session.color === 'white' || session.color === 'black')
        ) {
            return session as MatchSession
        }
    } catch {
        localStorage.removeItem(`chess.match.${matchId}`)
    }

    return null
}

export default MatchPage
