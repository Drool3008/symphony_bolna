import { useQuery } from '@tanstack/react-query'
import { api } from '../api/index.js'

export const homeKey = (memberId: string) => ['home', memberId] as const

/**
 * A member's home as the asking member may see it (GET /api/members/:id/home).
 * The server computes days of cover and due dates against the sim clock and
 * filters by consent; the stream refetches it when the clock moves
 * (src/api/live.ts).
 */
export function useHome(memberId: string) {
  return useQuery({ queryKey: homeKey(memberId), queryFn: () => api.home(memberId) })
}
