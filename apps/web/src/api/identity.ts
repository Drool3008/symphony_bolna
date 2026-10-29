/**
 * Who is asking, in one place (brief, Section 4; HANDOFF.md section 7).
 *
 * In this pass the member picks who they are and every request names them in
 * X-Member-Id, which the server checks against onboarding (server/src/auth.ts,
 * actor()). That identifies a member; it does not prove who is holding the
 * phone, so the picker is labelled as a development identity. Real sign-in
 * replaces the inside of this file and no screen changes.
 *
 * Only the chosen member id is kept in browser storage, never health data.
 * Storage can be missing or throw (a private window, blocked site data), so
 * every read and write is guarded and the choice also lives in memory.
 */
const KEY = 'member-id'

let current: string | null = null
let loaded = false

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** The member this phone belongs to, or null before anyone has been picked. */
export function chosenMember(): string | null {
  if (!loaded) {
    loaded = true
    try {
      current = storage()?.getItem(KEY) ?? null
    } catch {
      current = null
    }
  }
  return current
}

export function chooseMember(id: string): void {
  current = id
  loaded = true
  try {
    storage()?.setItem(KEY, id)
  } catch {
    // Kept in memory for this session; the picker asks again next time.
  }
}

export function forgetMember(): void {
  current = null
  loaded = true
  try {
    storage()?.removeItem(KEY)
  } catch {
    // Nothing stored to forget.
  }
}

/** The headers that tie a request to a person. The only reader of the chosen id for requests. */
export function identityHeaders(): Record<string, string> {
  const id = chosenMember()
  return id ? { 'X-Member-Id': id } : {}
}

/** For tests: forget what was loaded, so the next read goes back to storage. */
export function resetIdentityForTests(): void {
  current = null
  loaded = false
}
