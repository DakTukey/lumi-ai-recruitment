import type { JobDraft } from './recruiter-model'

export const suggestedJobTitle = (position: string, level: string) =>
  position ? `${level} ${position}`.trim() : ''

// Preserve a title edited by HR when the position or level changes.
export function selectJobPosition(
  draft: JobDraft,
  positionId: string,
  positionName: string,
): JobDraft {
  const auto =
    !draft.title.trim() || draft.title === suggestedJobTitle(draft.positionName ?? '', draft.level)
  return {
    ...draft,
    positionId,
    positionName,
    title: auto ? suggestedJobTitle(positionName, draft.level) : draft.title,
  }
}
export function selectJobLevel(draft: JobDraft, level: string): JobDraft {
  const auto =
    !draft.title.trim() || draft.title === suggestedJobTitle(draft.positionName ?? '', draft.level)
  return {
    ...draft,
    level,
    title: auto ? suggestedJobTitle(draft.positionName ?? '', level) : draft.title,
  }
}

export const samplePositionNames: Record<string, string[]> = {
  'Công nghệ': [
    'Frontend Developer',
    'Backend Developer',
    'Fullstack Developer',
    'Mobile Developer',
    'QA Engineer',
    'DevOps Engineer',
    'Business Analyst',
  ],
  'Thiết kế': ['UI/UX Designer', 'Product Designer'],
  'Dữ liệu & AI': ['Data Analyst', 'Data Engineer', 'AI Engineer'],
  Marketing: ['Content Marketing', 'Digital Marketing'],
  'Kinh doanh': ['Sales Executive', 'Account Manager'],
}
