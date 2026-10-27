import type { Role } from '@family-health/shared'
import type { Request } from 'express'
import { HttpError } from './http.js'
import type { Runtime } from './runtime.js'

/** Who is making a request. */
export interface Actor {
  memberId: string
  role: Role
}

export interface Need {
  /** Refuse anybody without this role. */
  role?: Role
  /** What the request does, for the refusal. */
  to?: string
}

/**
 * The one place a request is tied to a person (owner's answer, Checkpoint 1).
 *
 * In this pass the request names its member in X-Member-Id, checked against
 * onboarding: missing or unknown is a 400, the wrong role a 403. The header
 * identifies a member; it does not prove who is holding the phone. Real auth
 * replaces the inside of this function and no route changes.
 */
export function actor(rt: Runtime, req: Request, need: Need = {}): Actor {
  const id = req.get('X-Member-Id')
  if (!id) throw new HttpError(400, 'X-Member-Id is required: say which family member is asking')
  const member = rt.onboarding().family.members.find((m) => m.id === id)
  if (!member) throw new HttpError(400, `X-Member-Id ${id} is not a member of this family`)
  if (need.role && member.role !== need.role) {
    const doing = need.to ? ` to ${need.to}` : ''
    throw new HttpError(403, `only the ${need.role.replace('_', ' ')} may ask${doing}`)
  }
  return { memberId: member.id, role: member.role }
}
