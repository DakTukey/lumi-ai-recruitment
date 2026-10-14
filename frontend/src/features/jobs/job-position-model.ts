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
