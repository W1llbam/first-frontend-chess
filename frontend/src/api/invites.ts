export type ColorChoice = 'white' | 'black' | 'random'
export type TimeControl = 'unlimited' | '10-minutes' | '5-minutes'

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

export class InviteApiError extends Error {
  status: number

  constructor(status: number) {
    super('Unable to load the match invite.')
    this.name = 'InviteApiError'
    this.status = status
  }
}

export async function createInvite(request: CreateInviteRequest): Promise<Invite> {
  const response = await fetch('/api/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error('Unable to create the match invite. Please try again.')
  }

  return response.json() as Promise<Invite>
}

export async function getInvite(inviteId: string): Promise<Invite> {
  const response = await fetch(`/api/invites/${encodeURIComponent(inviteId)}`)

  if (!response.ok) {
    throw new InviteApiError(response.status)
  }

  return response.json() as Promise<Invite>
}
