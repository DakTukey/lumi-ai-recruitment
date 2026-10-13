export const JOB_PAGE_SIZE = 12

// Keep the existing order while refreshing jobs repeated across adjacent pages.
export function appendJobPage<T extends { id: string | number }>(existing: T[], incoming: T[]) {
  const jobs = new Map(existing.map((job) => [job.id, job]))
  incoming.forEach((job) => jobs.set(job.id, job))
  return [...jobs.values()]
}
