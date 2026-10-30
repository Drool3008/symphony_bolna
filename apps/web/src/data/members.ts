import type { MemberSummary } from '@family-health/shared'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/index.js'
import { useIdentity } from '../app/identity.js'
import { stringsFor, type Strings } from '../i18n/format.js'

export const membersKey = ['members'] as const

export function useMembers() {
  return useQuery({ queryKey: membersKey, queryFn: () => api.members(), staleTime: Infinity })
}

/** The member this phone belongs to, with their strings, once the family has loaded. */
export function useMe(): { me: MemberSummary; s: Strings } | null {
  const { memberId } = useIdentity()
  const { data } = useMembers()
  const me = data?.members.find((m) => m.id === memberId)
  return me ? { me, s: stringsFor(me.language) } : null
}
