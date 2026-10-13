import { useState } from 'react'
import type { ReactNode } from 'react'
import { initialJobs } from '../../features/jobs/data/jobs'
import type { Application, Job } from '../../types/domain'
import type { CandidatePreferences } from './demo-context'
import { DemoContext } from './demo-context'

export function DemoProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState(initialJobs)
  const [saved, setSaved] = useState<(string | number)[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [preferences, setPreferences] = useState<CandidatePreferences>({
    desiredTitle: 'Frontend Developer',
    category: 'Công nghệ',
    skills: 'React, TypeScript, JavaScript, HTML/CSS, Git',
    modes: ['Hybrid'],
  })
  const toggleSaved = (id: string | number) =>
    setSaved((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const apply = (job: Job, name: string) =>
    setApplications((prev) =>
      prev.some((x) => x.jobId === job.id)
        ? prev
        : [...prev, { jobId: job.id, job, name, status: 'Đã tiếp nhận' }],
    )
  return (
    <DemoContext.Provider
      value={{
        jobs,
        saved,
        applications,
        toggleSaved,
        apply,
        withdraw: (id) => setApplications((prev) => prev.filter((x) => x.jobId !== id)),
        addJob: (job) => setJobs((prev) => [job, ...prev]),
        preferences,
        updatePreferences: setPreferences,
      }}
    >
      {children}
    </DemoContext.Provider>
  )
}
