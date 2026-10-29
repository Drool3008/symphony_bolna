import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { identityHeaders } from '../api/identity.js'
import { connectLive, sessionKey, type SessionState } from '../api/live.js'
import { LiveStream, type StreamStatus } from '../api/stream.js'

const StatusContext = createContext<StreamStatus>('connecting')

/**
 * The app's one stream connection, fed into the query cache (src/api/live.ts).
 * It sends X-Member-Id: the server will make /events per member, and until it
 * does, screens keep only this member's share (docs/decisions.md).
 */
export function LiveProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<StreamStatus>('connecting')
  useEffect(() => {
    const stream = new LiveStream({ headers: identityHeaders })
    const offFeed = connectLive(stream, queryClient)
    const offStatus = stream.onStatus(setStatus)
    stream.start()
    return () => {
      offFeed()
      offStatus()
      stream.stop()
    }
  }, [queryClient])
  return <StatusContext.Provider value={status}>{children}</StatusContext.Provider>
}

export function useStreamStatus(): StreamStatus {
  return useContext(StatusContext)
}

/** The sim clock, stage and run, as the stream last said. */
export function useSession(): SessionState | undefined {
  return (
    useQuery<SessionState | null>({
      queryKey: sessionKey,
      queryFn: () => null,
      enabled: false,
      staleTime: Infinity,
    }).data ?? undefined
  )
}
