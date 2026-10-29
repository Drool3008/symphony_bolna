import { useEffect, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useMe, useMembers } from '../data/members.js'
import { useIdentity } from './identity.js'

/**
 * Everything after the pick. Sends anyone without a member to the picker,
 * and sets the page language to the member's, so Telugu gets its font and
 * leading from the tokens.
 */
export function MemberApp({
  children,
}: {
  children: (me: NonNullable<ReturnType<typeof useMe>>) => ReactNode
}) {
  const { memberId, forget } = useIdentity()
  const { data } = useMembers()
  const mine = useMe()
  const unknown = Boolean(data && memberId && !mine)

  useEffect(() => {
    if (unknown) forget()
  }, [unknown, forget])

  useEffect(() => {
    if (mine) document.documentElement.lang = mine.me.language
  }, [mine])

  if (!memberId || unknown) return <Navigate to="/pick" replace />
  if (!mine) return null
  return <>{children(mine)}</>
}
