import { get, post, put } from './api'

export interface ClarificationQuestion {
  id: string
  criterionKey: string
  requirement: string
  evidence: string
  matchLevel: 'PARTIAL' | 'NO_EVIDENCE'
  required: boolean
  question: string
  responseStatus: 'UNANSWERED' | 'ANSWERED' | 'SKIPPED'
  answer: string
  version: number
  answeredAt: string | null
}
export interface ApplicationClarificationsData {
  state:
    | 'WAITING'
    | 'NEEDS_ANALYSIS'
    | 'NOT_REQUESTED'
    | 'GENERATING'
    | 'READY'
    | 'NOT_NEEDED'
    | 'FAILED'
  canEdit: boolean
  canGenerate: boolean
  retryAt: string | null
  assessedAt: string | null
  questions: ClarificationQuestion[]
}
// Two question saves can finish out of order. Never replace a newer saved answer with an older response.
export function mergeClarifications(
  current: ApplicationClarificationsData | null,
  incoming: ApplicationClarificationsData,
) {
  if (!current) return incoming
  return {
    ...incoming,
    questions: incoming.questions.map((question) => {
      const previous = current.questions.find((q) => q.id === question.id)
      return previous && previous.version > question.version ? previous : question
    }),
  }
}
const path = (id: string, staff = false) =>
  `/${staff ? 'recruiter' : 'candidate'}/applications/${encodeURIComponent(id)}/clarifications`
export const getClarifications = async (id: string, staff = false) =>
  (await get<ApplicationClarificationsData>(path(id, staff))).data
export const generateClarifications = async (id: string) =>
  (await post<ApplicationClarificationsData>(`${path(id)}/generate`, {}, { timeoutMs: 90000 })).data
export const saveClarification = async (
  id: string,
  question: ClarificationQuestion,
  action: 'ANSWER' | 'SKIP',
  answer: string,
) =>
  (
    await put<ApplicationClarificationsData>(`${path(id)}/${encodeURIComponent(question.id)}`, {
      version: question.version,
      action,
      answer: action === 'SKIP' ? '' : answer.trim(),
    })
  ).data
