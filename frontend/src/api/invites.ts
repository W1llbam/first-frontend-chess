export type ColorChoice = 'white' | 'black' | 'random'
export type TimeControl = 'unlimited' | '10-minutes' | '5-minutes'
export type PlayerColor = 'white' | 'black'
export type PromotionPiece = 'q' | 'r' | 'b' | 'n'
export type GameStatus = 'active' | 'check' | 'checkmate' | 'stalemate' | 'draw'
export type DrawReason = 'stalemate' | 'insufficient-material' | 'fivefold-repetition' | 'seventy-five-move'

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
  fen: string
  turn: PlayerColor
  moveCount: number
  lastMove: LastMove | null
  gameStatus: GameStatus
  winner: PlayerColor | null
  drawReason: DrawReason | null
}

export interface LastMove {
  from: string
  to: string
  promotion: PromotionPiece | null
  san: string
}

export interface SubmitMoveRequest {
  from: string
  to: string
  promotion: PromotionPiece | null
}

export class InviteApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail = 'Unable to load the match invite.') {
    super(detail)
    this.name = 'InviteApiError'
    this.status = status
    this.detail = detail
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
    throw await getApiError(response)
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
    throw await getApiError(response)
  }

  return response.json() as Promise<JoinMatch>
}

export async function getMatchStatus(matchId: string, playerToken: string): Promise<MatchStatus> {
  const response = await fetch(`/api/matches/${encodeURIComponent(matchId)}`, {
    headers: { 'X-Player-Token': playerToken },
  })

  if (!response.ok) {
    throw await getApiError(response)
  }

  return response.json() as Promise<MatchStatus>
}

export async function submitMove(
  matchId: string,
  playerToken: string,
  request: SubmitMoveRequest,
): Promise<MatchStatus> {
  const response = await fetch(`/api/matches/${encodeURIComponent(matchId)}/moves`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Player-Token': playerToken,
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw await getApiError(response)
  }

  return response.json() as Promise<MatchStatus>
}

async function getApiError(response: Response): Promise<InviteApiError> {
  try {
    const body = await response.json() as { detail?: unknown }
    if (typeof body.detail === 'string') return new InviteApiError(response.status, body.detail)
  } catch {
    // Use the generic message when the server does not return JSON.
  }

  return new InviteApiError(response.status)
}
