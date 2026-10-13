import { createContext, useContext } from 'react'
import type { Application, Job } from '../../types/domain'

export type CandidatePreferences = {
  desiredTitle: string
  category: string
  skills: string
  modes: string[]
}
type DemoState = {
  jobs: Job[]
  saved: (string | number)[]
  applications: Application[]
  toggleSaved: (id: string | number) => void
  apply: (job: Job, name: string) => void
  withdraw: (id: string | number) => void
  addJob: (job: Job) => void
  preferences: CandidatePreferences
  updatePreferences: (preferences: CandidatePreferences) => void
}
export const DemoContext = createContext<DemoState | null>(null)
export function useDemo() {
  const context = useContext(DemoContext)
  if (!context) throw new Error('DemoProvider is required')
  return context
}
