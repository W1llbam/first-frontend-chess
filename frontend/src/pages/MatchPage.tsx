import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Square } from 'chess.js'
import { getMatchStatus, InviteApiError, type MatchStatus } from '../api/invites'
import ChessBoard from '../components/ChessBoard'
import { applyMove, getLegalTargets, getTurn, STARTING_FEN } from '../chess/board'
import './MatchPage.css'

type MatchSession = { inviteId: string; playerToken: string; color: 'white' | 'black' }

function MatchPage() {
    const { matchId } = useParams<{ matchId: string }>()
    const [match, setMatch] = useState<MatchStatus | null>(null)
    const [errorStatus, setErrorStatus] = useState<number | null>(null)
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle')
    const [hasLoaded, setHasLoaded] = useState(false)
    const [fen, setFen] = useState(STARTING_FEN)
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
    const [legalTargets, setLegalTargets] = useState<Square[]>([])
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

    function handleSquareClick(square: Square) {
        if (legalTargets.includes(square) && selectedSquare) {
            setFen(applyMove(fen, selectedSquare, square))
            setSelectedSquare(null)
            setLegalTargets([])
            return
        }

        const nextTargets = getLegalTargets(fen, square)
        if (nextTargets.length > 0) {
            setSelectedSquare(square)
            setLegalTargets(nextTargets)
            return
        }

        setSelectedSquare(null)
        setLegalTargets([])
    }

    function handleResetBoard() {
        setFen(STARTING_FEN)
        setSelectedSquare(null)
        setLegalTargets([])
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
                <p className="turn-status" aria-live="polite">
                    {getTurn(fen) === 'w' ? 'White' : 'Black'} to move. Select a piece to move it.
                </p>
                <ChessBoard
                    fen={fen}
                    selectedSquare={selectedSquare}
                    legalTargets={legalTargets}
                    onSquareClick={handleSquareClick}
                />
                <button className="reset-board-button" type="button" onClick={handleResetBoard}>
                    Reset board
                </button>
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
