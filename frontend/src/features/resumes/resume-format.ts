export function hasResumeEntryContent(entry: object): boolean {
  return Object.values(entry).some(
    (value) =>
      (typeof value === 'string' && !!value.trim()) ||
      (typeof value === 'number' && Number.isFinite(value)) ||
      (Array.isArray(value) && value.some((item) => typeof item === 'string' && !!item.trim())),
  )
}

type DatedEntry = {
  startDate?: string
  endDate?: string
  issuedDate?: string
  awardedDate?: string
  current?: boolean
}

export function sortResumeEntries<T extends DatedEntry>(entries: T[]): T[] {
  const date = (entry: T) =>
    entry.current
      ? '9999-12'
      : entry.endDate || entry.awardedDate || entry.issuedDate || entry.startDate || ''
  return [...entries].sort((a, b) => date(b).localeCompare(date(a)))
}

export function resumeBulletLines(description: string | null | undefined): string[] {
  return (description ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[•*-]\s+/, ''))
    .filter(Boolean)
}

export function resumeMonth(value: string | null | undefined): string {
  if (!value) return ''
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  return match ? `${match[2]}/${match[1]}` : value
}
