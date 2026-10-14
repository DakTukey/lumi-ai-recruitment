export function safeJobListPath(value: unknown) {
  const fallback = '/#opportunities'
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback
  try {
    const url = new URL(value, 'https://lumi.local')
    if (url.origin !== 'https://lumi.local' || !['/', '/saved'].includes(url.pathname))
      return fallback
    const search = ''
    return `${url.pathname}${search}${url.hash === '#opportunities' ? url.hash : ''}`
  } catch {
    return fallback
  }
}

export function jobDetailPath(id: string | number, from?: string) {
  const params = new URLSearchParams()
  if (from) params.set('from', safeJobListPath(from))
  return `/jobs/${encodeURIComponent(id)}${params.size ? `?${params}` : ''}`
}

export function jobApplicationPath(id: string) {
  return `${jobDetailPath(id)}?apply=1`
}

export function candidateJobLoginDestination(value: unknown) {
  return typeof value === 'string' && /^\/jobs\/[0-9a-f-]{36}(?:\?apply=1)?$/i.test(value)
    ? value
    : null
}

// These links carry identifiers only; the API still verifies ownership and current versions.
export function jobMatchPath(jobId: string | number, resumeId?: string) {
  const params = new URLSearchParams({ match: '1' })
  if (resumeId) params.set('resumeId', resumeId)
  return `${jobDetailPath(jobId)}?${params}#job-cv-match`
}
export function improveCvPath(jobId: string, resumeId: string) {
  return `/cv-builder?${new URLSearchParams({ id: resumeId, jobId, returnTo: 'match' })}`
}
