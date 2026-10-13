import { post } from './api'

export type CvWritingSection = 'summary' | 'experience' | 'project'
export type CvWritingAction = 'polish' | 'shorten' | 'bullets'
export type CvWritingRequest = {
  section: CvWritingSection
  action: CvWritingAction
  text: string
  context: string
}
export type CvWritingResult = {
  suggestion: string
  questions: string[]
  model_name: string
  prompt_version: string
}
export async function rewriteCvSection(input: CvWritingRequest) {
  return (await post<CvWritingResult>('/candidate/cv-writing', input, { timeoutMs: 45000 })).data
}
