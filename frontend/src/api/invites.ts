export type ColorChoice = 'white' | 'black' | 'random'
export type TimeControl = 'unlimited' | '10-minutes' | '5-minutes'
export type PlayerColor = 'white' | 'black'

export interface CreateInviteRequest {
  color: ColorChoice
  timeControl: TimeControl
}

export interface Invite {
  id: string
  status: 'pending'
  color: ColorChoice
  timeControl: TimeControl
  expiresAt: string
}

export interface CreateInviteResult extends Invite {
  matchId: string
  creatorToken: string
  creatorColor: PlayerColor
}

export interface JoinMatch {
  matchId: string
  playerToken: string
  color: PlayerColor
  status: 'waiting' | 'ready'
}

export interface MatchStatus {
  matchId: string
  color: PlayerColor
  status: 'waiting' | 'ready'
}

export class InviteApiError extends Error {
  status: number

  constructor(status: number) {
    super('Unable to load the match invite.')
    this.name = 'InviteApiError'
    this.status = status
  }
}

export async function createInvite(request: CreateInviteRequest): Promise<CreateInviteResult> {
  const response = await fetch('/api/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error('Unable to create the match invite. Please try again.')
  }

  return response.json() as Promise<CreateInviteResult>
}

export async function getInvite(inviteId: string): Promise<Invite> {
  const response = await fetch(`/api/invites/${encodeURIComponent(inviteId)}`)

  if (!response.ok) {
    throw new InviteApiError(response.status)
  }

  return response.json() as Promise<Invite>
}

export async function joinInvite(inviteId: string, playerToken?: string): Promise<JoinMatch> {
  const headers: HeadersInit = playerToken
    ? { 'X-Player-Token': playerToken }
    : {}
  const response = await fetch(`/api/invites/${encodeURIComponent(inviteId)}/join`, {
    method: 'POST',
    headers,
  })

  if (!response.ok) {
    throw new InviteApiError(response.status)
  }

  return response.json() as Promise<JoinMatch>
}

export async function getMatchStatus(matchId: string, playerToken: string): Promise<MatchStatus> {
  const response = await fetch(`/api/matches/${encodeURIComponent(matchId)}`, {
    headers: { 'X-Player-Token': playerToken },
  })

  if (!response.ok) {
    throw new InviteApiError(response.status)
  }

  return response.json() as Promise<MatchStatus>
}
