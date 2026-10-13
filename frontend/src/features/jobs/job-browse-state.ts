import type { Job } from '../../types/domain'
import type { Department } from '../../services/job.service'

export type JobListResult = {
  key: string
  scope: string
  jobs: Job[]
  total: number
  pages: number
  error: string
}
export type JobBrowseSnapshot = {
  query: string
  category: string
  levels: string[]
  modes: string[]
  salary: boolean
  sort: string
  filtersOpen: boolean
  page: number
  retry: number
  filterKey: string
  result: JobListResult | null
  departments: Department[]
  scrollY: number
}

// Public job data only, kept in memory for Back navigation. Separate history entries and users.
const snapshots = new Map<string, JobBrowseSnapshot>()
const snapshotKey = (key: string, userId?: string) => JSON.stringify([key, userId ?? 'guest'])
export function readJobBrowseSnapshot(key: string, userId?: string) {
  return snapshots.get(snapshotKey(key, userId))
}
export function saveJobBrowseSnapshot(key: string, snapshot: JobBrowseSnapshot, userId?: string) {
  const id = snapshotKey(key, userId)
  snapshots.delete(id)
  snapshots.set(id, snapshot)
  if (snapshots.size > 8) snapshots.delete(snapshots.keys().next().value!)
}
