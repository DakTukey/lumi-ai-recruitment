import type { ResumeInput } from '../../services/resume.service'
import type { CvReviewContext, CvReviewTarget } from '../../services/cv-review.service'

export const cvReviewContext = (draft: ResumeInput): CvReviewContext => ({
  desiredPosition: draft.desiredPosition ?? '',
  summary: draft.summary ?? '',
  skills: draft.skills,
  experiences: draft.experiences,
  educations: draft.educations,
  projects: draft.projects,
  certifications: draft.certifications,
  languages: draft.languages ?? [],
  awards: draft.awards ?? [],
  activities: draft.activities ?? [],
})
export const reviewFingerprint = (resume: CvReviewContext, jobId: string | null) =>
  JSON.stringify({ resume, jobId })
export const reviewKey = (target: CvReviewTarget) => `${target.section}:${target.index}`
export function reviewText(cv: CvReviewContext, target: CvReviewTarget): string | undefined {
  if (target.section === 'summary') return target.index === -1 ? (cv.summary ?? '') : undefined
  const row = (target.section === 'experience' ? cv.experiences : cv.projects)[target.index]
  return row ? (row.description ?? '') : undefined
}
export function withReviewText<T extends CvReviewContext>(
  cv: T,
  target: CvReviewTarget,
  text: string,
): T {
  if (reviewText(cv, target) === undefined) return cv
  if (target.section === 'summary') return { ...cv, summary: text }
  const key = target.section === 'experience' ? 'experiences' : 'projects'
  return {
    ...cv,
    [key]: cv[key].map((row, index) =>
      index === target.index ? { ...row, description: text } : row,
    ),
  }
}
export function reviewLabel(cv: CvReviewContext, target: CvReviewTarget): string {
  if (target.section === 'summary') return 'Giới thiệu / Mục tiêu nghề nghiệp'
  if (target.section === 'experience') {
    const item = cv.experiences[target.index]
    return `Kinh nghiệm ${target.index + 1}${item?.company ? ` · ${item.company}` : ''}`
  }
  return `Dự án ${target.index + 1}${cv.projects[target.index]?.name ? ` · ${cv.projects[target.index].name}` : ''}`
}

/** Ask for facts rather than asking the candidate to author a polished summary themselves. */
export function reviewQuestion(item: { section: string; kind: string; question: string }): string {
  if (
    item.section === 'summary' &&
    item.kind === 'ADD' &&
    /đoạn|tóm tắt|[34].*câu/i.test(item.question)
  )
    return 'Bạn đang học hoặc làm gì, đã trực tiếp tham gia dự án/công việc nào và muốn phát triển gì ở vị trí này?'
  return item.question
}
