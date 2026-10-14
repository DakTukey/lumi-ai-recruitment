import type { ResumeInput } from '../../services/resume.service'
import type { SampleApplication } from '../../src/features/jobs/recruiter-model'

// Keep the original sample text intact; dates, employers and qualifications are not inferred.
export function sampleResume(application: SampleApplication): ResumeInput {
  return {
    title: 'CV mẫu',
    fullName: application.name,
    desiredPosition: application.role,
    email: application.email,
    phone: application.phone,
    location: null,
    summary: application.summary,
    skills: application.skills,
    githubUrl: null,
    linkedinUrl: null,
    portfolioUrl: null,
    experiences: application.experience.trim()
      ? [
          {
            company: '',
            position: '',
            startDate: '',
            endDate: '',
            current: false,
            description: application.experience,
          },
        ]
      : [],
    educations: application.education.trim()
      ? [
          {
            school: '',
            degree: '',
            field: '',
            startDate: '',
            endDate: '',
            description: application.education,
          },
        ]
      : [],
    projects: application.project.trim()
      ? [{ name: '', role: '', url: '', description: application.project }]
      : [],
    certifications: [],
    languages: [],
    awards: [],
    activities: [],
    template: 'modern',
    status: 'READY',
    version: null,
  }
}
