import type { CvDocument, ResumeInput } from '../../services/resume.service'
/** Start clean: never merge another CV/profile into an imported document. */
export function importedDraft(document: CvDocument): ResumeInput {
  const p = document.reviewed ?? document.parsed
  if (!p) throw new Error('PDF chưa có kết quả trích xuất.')
  return {
    title: p.title || 'CV từ PDF', fullName: p.fullName || '', email: p.email || '',
    phone: p.phone || '', location: p.location || '', desiredPosition: p.desiredPosition || '',
    summary: p.summary || '', githubUrl: p.githubUrl || '', linkedinUrl: p.linkedinUrl || '',
    portfolioUrl: p.portfolioUrl || '', skills: p.skills ?? [], experiences: p.experiences ?? [],
    educations: p.educations ?? [], projects: p.projects ?? [], certifications: p.certifications ?? [],
    languages: p.languages ?? [], awards: p.awards ?? [], activities: p.activities ?? [],
    extraSections: p.extraSections ?? [], sourceDocumentId: document.id,
    template: 'modern', status: 'DRAFT', version: null,
  }
}
