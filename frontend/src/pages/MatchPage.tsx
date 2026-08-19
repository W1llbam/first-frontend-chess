import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Square } from 'chess.js'
import { getMatchStatus, InviteApiError, submitMove, type MatchStatus } from '../api/invites'
import { MatchConnection, type MatchConnectionState } from '../api/matchConnection'
import ChessBoard from '../components/ChessBoard'
import { getLegalTargets, getPromotionForMove, STARTING_FEN } from '../chess/board'
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
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [moveError, setMoveError] = useState<string | null>(null)
    const [connectionState, setConnectionState] = useState<MatchConnectionState>('polling-fallback')
    const latestMoveCount = useRef(-1)
    const session = matchId ? readMatchSession(matchId) : null
    const playerToken = session?.playerToken

    useEffect(() => {
        if (!matchId || !playerToken) return

        latestMoveCount.current = -1
        let isActive = true
        let pollingInterval: number | null = null
        let connection: MatchConnection | null = null
        let socketConnected = false

        async function refreshMatch(): Promise<boolean> {
            try {
                const nextMatch = await getMatchStatus(matchId!, playerToken!)
                if (!isActive) return false

                applyServerState(nextMatch)
                setErrorStatus(null)
                setHasLoaded(true)
                if (socketConnected) stopPolling()
                return true
            } catch (caughtError: unknown) {
                if (isActive && caughtError instanceof InviteApiError) setErrorStatus(caughtError.status)
                return false
            }
        }

        function startPolling() {
            if (pollingInterval !== null) return
            pollingInterval = window.setInterval(refreshMatch, 2000)
        }

        function stopPolling() {
            if (pollingInterval === null) return
            window.clearInterval(pollingInterval)
            pollingInterval = null
        }

        refreshMatch()
        startPolling()
        connection = new MatchConnection(matchId, playerToken, {
            onState: (state) => {
                if (!isActive) return
                setConnectionState(state)
                socketConnected = state === 'connected'
                if (state !== 'connected') startPolling()
            },
            onSnapshot: (nextMatch) => {
                if (!isActive) return
                applyServerState(nextMatch)
                setErrorStatus(null)
                setHasLoaded(true)
            },
            onReconnect: async () => {
                const refreshed = await refreshMatch()
                if (refreshed && isActive) stopPolling()
            },
        })
        connection.start()

        return () => {
            isActive = false
            stopPolling()
            connection?.stop()
        }
    }, [matchId, playerToken])

    function applyServerState(nextMatch: MatchStatus) {
        if (nextMatch.moveCount < latestMoveCount.current) return

        latestMoveCount.current = nextMatch.moveCount
        setMatch(nextMatch)
        setFen(nextMatch.fen)
        setSelectedSquare(null)
        setLegalTargets([])
        setMoveError(null)
    }

    async function handleCopyInvite() {
        if (!session) return
        await navigator.clipboard.writeText(`${window.location.origin}/invite/${session.inviteId}`)
        setCopyStatus('copied')
    }

    async function handleSquareClick(square: Square) {
        if (isSubmitting || isTerminalGameStatus(match?.gameStatus)) return

        if (legalTargets.includes(square) && selectedSquare) {
            setIsSubmitting(true)
            setMoveError(null)
            try {
                const nextMatch = await submitMove(matchId!, playerToken!, {
                    from: selectedSquare,
                    to: square,
                    promotion: getPromotionForMove(fen, selectedSquare, square),
                })
                applyServerState(nextMatch)
            } catch (caughtError: unknown) {
                setMoveError(caughtError instanceof InviteApiError
                    ? caughtError.detail
                    : 'Unable to submit the move. Please try again.')
            } finally {
                setIsSubmitting(false)
            }
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

    if (!session || !matchId) {
        return <main className="match-page"><p>This match session is unavailable.</p></main>
    }

    if (errorStatus !== null && !hasLoaded) {
        return <main className="match-page"><p>Unable to load this match. Please try again.</p></main>
    }

    const color = match?.color ?? session.color
    const status = match?.status ?? 'waiting'
    const gameStatus = match?.gameStatus ?? 'active'
    const isGameOver = isTerminalGameStatus(gameStatus)
    const checkedColor = gameStatus === 'check' || gameStatus === 'checkmate'
        ? match?.turn ?? null
        : null

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
                    {match?.turn === 'black' ? 'Black' : 'White'} to move. Select a piece to move it.
                </p>
                <p className="connection-status" aria-live="polite">
                    {connectionState === 'connected' && 'Live updates connected.'}
                    {connectionState === 'reconnecting' && 'Reconnecting to live updates…'}
                    {connectionState === 'polling-fallback' && 'Live updates unavailable. Checking for updates…'}
                </p>
                {gameStatus !== 'active' && (
                    <div className={`game-result ${isGameOver ? 'game-result-terminal' : ''}`} role="status" aria-live="polite">
                        {getGameStatusMessage(gameStatus, match)}
                    </div>
                )}
                {isSubmitting && <p aria-live="polite">Submitting move…</p>}
                {moveError && <p role="alert">{moveError}</p>}
                <ChessBoard
                    fen={fen}
                    selectedSquare={selectedSquare}
                    legalTargets={legalTargets}
                    onSquareClick={handleSquareClick}
                    disabled={isGameOver}
                    checkedColor={checkedColor}
                />
                <Link className="match-link" to="/">Return home</Link>
            </section>
        </main>
    )
}

function isTerminalGameStatus(gameStatus: MatchStatus['gameStatus'] | undefined) {
    return gameStatus === 'checkmate' || gameStatus === 'stalemate' || gameStatus === 'draw'
}

function getGameStatusMessage(gameStatus: MatchStatus['gameStatus'], match: MatchStatus | null) {
    if (gameStatus === 'check') return `${match?.turn === 'white' ? 'White' : 'Black'} is in check.`
    if (gameStatus === 'checkmate') return `Checkmate. ${match?.winner === 'white' ? 'White' : 'Black'} wins.`
    if (gameStatus === 'stalemate') return 'Stalemate. The game is drawn.'

    const drawMessages: Record<NonNullable<MatchStatus['drawReason']>, string> = {
        stalemate: 'Stalemate. The game is drawn.',
        'insufficient-material': 'Draw by insufficient material.',
        'fivefold-repetition': 'Draw by fivefold repetition.',
        'seventy-five-move': 'Draw by the seventy-five-move rule.',
    }
    return drawMessages[match?.drawReason ?? 'insufficient-material']
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
