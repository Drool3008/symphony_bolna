import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { chooseMember, chosenMember, forgetMember } from '../api/identity.js'

interface IdentityValue {
  memberId: string | null
  choose: (id: string) => void
  forget: () => void
}

const IdentityContext = createContext<IdentityValue | null>(null)

/** Makes the chosen member reactive for screens; storage stays in src/api/identity.ts. */
export function IdentityProvider({ children }: { children: ReactNode }) {
  const [memberId, setMemberId] = useState<string | null>(() => chosenMember())
  const choose = useCallback((id: string) => {
    chooseMember(id)
    setMemberId(id)
  }, [])
  const forget = useCallback(() => {
    forgetMember()
    setMemberId(null)
  }, [])
  const value = useMemo(() => ({ memberId, choose, forget }), [memberId, choose, forget])
  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>
}

export function useIdentity(): IdentityValue {
  const value = useContext(IdentityContext)
  if (!value) throw new Error('useIdentity needs an IdentityProvider')
  return value
}
