export type RecruiterSection = 'overview' | 'jobs' | 'candidates' | 'profile'
export const jobTabs = ['content', 'applicants', 'ai', 'history'] as const
export const applicationTabs = [
  'cv',
  'jd',
  'clarifications',
  'github',
  'scorecard',
  'workflow',
  'notes',
  'ai',
  'email',
  'history',
] as const
const sectionPaths: Record<RecruiterSection, string> = {
  overview: '/recruiter',
  jobs: '/recruiter/jobs',
  candidates: '/recruiter/applications',
  profile: '/recruiter/profile',
}

export function recruiterUrl(path: string, values: Record<string, string> = {}) {
  const params = new URLSearchParams(values)
  params.delete('data')
  const query = params.toString()
  return `${path}${query ? `?${query}` : ''}`
}
export const recruiterSectionUrl = (section: RecruiterSection) =>
  recruiterUrl(sectionPaths[section])
export const recruiterJobUrl = (id: string, tab = 'content') =>
  recruiterUrl(`/recruiter/jobs/${encodeURIComponent(id)}`, tab === 'content' ? {} : { tab })

export function recruiterLoginDestination(value: string | undefined) {
  if (!value?.startsWith('/recruiter') || value.includes('#')) return null
  const [pathname, search = ''] = value.split('?')
  return parseRecruiterRoute(pathname, search).kind === 'missing' ? null : value
}

export function parseRecruiterRoute(pathname: string, search = '') {
  const path = pathname.replace(/\/$/, '')
  const params = new URLSearchParams(search)
  let section: RecruiterSection = 'overview'
  let kind: 'section' | 'job' | 'application' | 'missing' = 'section'
  let id = ''
  const job = path.match(/^\/recruiter\/jobs\/([^/]+)$/)
  const application = path.match(/^\/recruiter\/applications\/([^/]+)$/)
  if (job || application) {
    try {
      id = decodeURIComponent((job ?? application)![1])
    } catch {
      kind = 'missing'
    }
    if (!id || /[/\\]/.test(id) || id === '.' || id === '..') kind = 'missing'
    else kind = job ? 'job' : 'application'
    section = job ? 'jobs' : 'candidates'
  } else {
    const found = Object.entries(sectionPaths).find(([, value]) => value === path)
    if (found) section = found[0] as RecruiterSection
    else kind = 'missing'
  }
  const allowedTabs = kind === 'job' ? jobTabs : applicationTabs
  const defaultTab = kind === 'job' ? 'content' : 'cv'
  const tab = allowedTabs.find((value) => value === params.get('tab')) ?? defaultTab
  return { section, kind, id, tab, filterJobId: params.get('jobId') ?? '' }
}

// Return links only target HR lists or job details, never an arbitrary URL or another application.
export function recruiterReturnUrl(value: string | null) {
  if (value?.startsWith('/recruiter') && !value.includes('#')) {
    const [pathname, search = ''] = value.split('?')
    const route = parseRecruiterRoute(pathname, search)
    if (route.kind === 'job' || (route.kind === 'section' && route.section !== 'profile')) {
      const params = new URLSearchParams(search)
      params.delete('from')
      return recruiterUrl(pathname, Object.fromEntries(params))
    }
  }
  return recruiterSectionUrl('candidates')
}
