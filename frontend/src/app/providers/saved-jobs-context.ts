import { createContext, useContext } from 'react'
export const SavedJobsContext = createContext<{
  saved: (string | number)[]
  toggleSaved: (id: string | number) => void
} | null>(null)
export function useSavedJobs() {
  const state = useContext(SavedJobsContext)
  if (!state) throw new Error('SavedJobsProvider is required')
  return state
}
