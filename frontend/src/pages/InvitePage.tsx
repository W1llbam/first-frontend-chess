import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getInvite, InviteApiError, joinInvite, type Invite } from '../api/invites'
import './InvitePage.css'

function InvitePage() {
    const { inviteId } = useParams<{ inviteId: string }>()
    const navigate = useNavigate()
    const [invite, setInvite] = useState<Invite | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [errorStatus, setErrorStatus] = useState<number | 'unknown' | null>(null)
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
    const [isJoining, setIsJoining] = useState(false)
    const copyResetTimeout = useRef<number | null>(null)

    useEffect(() => {
        if (!inviteId) {
            return
        }

        const creatorMatch = findStoredMatchForInvite(inviteId)
        if (creatorMatch) {
            navigate(`/match/${creatorMatch.matchId}`, { replace: true })
            return
        }

        getInvite(inviteId)
            .then((loadedInvite) => {
                setInvite(loadedInvite)
                setIsJoining(true)
                return joinInvite(inviteId)
            })
            .then((match) => {
                localStorage.setItem(`chess.match.${match.matchId}`, JSON.stringify({
                    inviteId,
                    playerToken: match.playerToken,
                    color: match.color,
                }))
                navigate(`/match/${match.matchId}`, { replace: true })
            })
            .catch((caughtError: unknown) => {
                setErrorStatus(caughtError instanceof InviteApiError ? caughtError.status : 'unknown')
            })
            .finally(() => {
                setIsLoading(false)
                setIsJoining(false)
            })
    }, [inviteId, navigate])

    useEffect(() => () => {
        if (copyResetTimeout.current !== null) {
            window.clearTimeout(copyResetTimeout.current)
        }
    }, [])

    async function handleCopyInvite() {
        if (!inviteId) return

        const inviteUrl = `${window.location.origin}/invite/${inviteId}`
        try {
            await navigator.clipboard.writeText(inviteUrl)
            setCopyStatus('copied')
            copyResetTimeout.current = window.setTimeout(() => setCopyStatus('idle'), 2000)
        } catch {
            setCopyStatus('error')
        }
    }

    if (!inviteId) {
        return <main className="invite-page"><p>Unable to load this invite. Please try again.</p></main>
    }

    if (isLoading || isJoining) {
        return <main className="invite-page"><p>{isJoining ? 'Joining match...' : 'Loading invite...'}</p></main>
    }

    if (errorStatus !== null || !invite) {
        const message = errorStatus === 404
            ? 'This invite could not be found.'
            : errorStatus === 410
                ? 'This invite has expired.'
                : 'Unable to load this invite. Please try again.'
        return (
            <main className="invite-page">
                <section className="invite-page-card" aria-labelledby="invite-error-title">
                    <h1 id="invite-error-title">Invite unavailable</h1>
                    <p>{message}</p>
                    <Link className="invite-page-link" to="/create-match">Create a new match</Link>
                </section>
            </main>
        )
    }

    const inviteUrl = `${window.location.origin}/invite/${invite.id}`
    return (
        <main className="invite-page">
            <section className="invite-page-card" aria-labelledby="invite-title">
                <p className="eyebrow">Match invite</p>
                <h1 id="invite-title">Your invite link is ready</h1>
                <p>Share this link with your friend.</p>
                <label className="invite-link-label" htmlFor="invite-link">Invite link</label>
                <div className="invite-link-actions">
                    <input id="invite-link" readOnly type="text" value={inviteUrl} />
                    <button type="button" onClick={handleCopyInvite}>
                        {copyStatus === 'copied' ? 'Copied!' : 'Copy link'}
                    </button>
                </div>
                <p className="copy-status" aria-live="polite">
                    {copyStatus === 'error' && 'Could not copy the link. Select it manually.'}
                </p>
                <Link className="invite-page-link" to="/create-match">Create another match</Link>
            </section>
        </main>
    )
}

function findStoredMatchForInvite(inviteId: string): { matchId: string } | null {
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index)
        if (!key?.startsWith('chess.match.')) continue

        const value = localStorage.getItem(key)
        if (!value) continue

        try {
            const session = JSON.parse(value) as { inviteId?: string; color?: string }
            if (session.inviteId === inviteId && (session.color === 'white' || session.color === 'black')) {
                return { matchId: key.slice('chess.match.'.length) }
            }
        } catch {
            localStorage.removeItem(key)
        }
    }

    return null
}

export default InvitePage
