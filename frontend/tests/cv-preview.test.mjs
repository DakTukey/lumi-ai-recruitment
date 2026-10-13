import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

function transpile(source, jsx = false) {
  return ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      jsx: jsx ? ts.JsxEmit.ReactJSX : undefined,
    },
  }).outputText
}
const dataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const formatUrl = dataUrl(
  transpile(
    await readFile(new URL('../src/features/resumes/resume-format.ts', import.meta.url), 'utf8'),
  ),
)
const credentialUrl = dataUrl(
  transpile(
    await readFile(
      new URL('../src/features/resumes/credential-verification.ts', import.meta.url),
      'utf8',
    ),
  ),
)
const themeSource = (
  await readFile(new URL('../src/features/resumes/cv-preview-theme.ts', import.meta.url), 'utf8')
).replace("'react'", `'${import.meta.resolve('react')}'`)
const themeUrl = dataUrl(transpile(themeSource))
const source = (
  await readFile(new URL('../src/features/resumes/CvPreview.tsx', import.meta.url), 'utf8')
)
  .replace(/import '\.\/[^']+\.css'\n/g, '')
  .replace("'./cv-preview-theme'", `'${themeUrl}'`)
  .replace("'./resume-format'", `'${formatUrl}'`)
  .replace("'./credential-verification'", `'${credentialUrl}'`)
  .replace("'lucide-react'", `'${import.meta.resolve('lucide-react')}'`)
const compiled = transpile(source, true).replace(
  '"react/jsx-runtime"',
  JSON.stringify(import.meta.resolve('react/jsx-runtime')),
)
const { CvPreview } = await import(dataUrl(compiled))
const empty = {
  fullName: 'Candidate',
  desiredPosition: null,
  email: null,
  phone: null,
  location: null,
  summary: null,
  githubUrl: null,
  linkedinUrl: null,
  portfolioUrl: null,
  skills: [],
  experiences: [],
  educations: [],
  projects: [],
  certifications: [],
  languages: [],
  awards: [],
  activities: [],
  template: 'classic',
  title: 'Internal CV title',
  status: 'READY',
  version: 1,
}
const render = (draft, presentation = 'reviewer') =>
  renderToStaticMarkup(createElement(CvPreview, { draft, skills: draft.skills, presentation }))

test('HR CV reserves each content section and contact field without inventing values', () => {
  const html = render(empty)
  for (const label of [
    'Liên hệ',
    'Kỹ năng',
    'Ngoại ngữ',
    'Giới thiệu',
    'Kinh nghiệm làm việc',
    'Dự án',
    'Học vấn',
    'Chứng chỉ',
    'Giải thưởng',
    'Hoạt động',
  ])
    assert.equal(html.split(`<h3>${label}</h3>`).length - 1, 1, label)
  for (const label of [
    'Vị trí mong muốn',
    'Email',
    'Số điện thoại',
    'Địa điểm',
    'GitHub',
    'LinkedIn',
    'Portfolio / Website',
  ])
    assert.ok(html.includes(label), label)
  assert.ok(html.includes('Chưa cung cấp'))
  assert.ok(!html.includes('href='))
  assert.ok(!html.includes('Internal CV title'))
})

test('HR CV fills all saved sections and preserves the submitted snapshot', () => {
  const draft = {
    ...empty,
    desiredPosition: 'Engineer',
    email: 'cv@example.test',
    phone: '0900000000',
    location: 'Da Nang',
    summary: 'Summary detail',
    githubUrl: 'https://github.com/candidate',
    linkedinUrl: 'https://example.test/linkedin',
    portfolioUrl: 'https://example.test/portfolio',
    skills: ['Java'],
    experiences: [
      {
        position: 'Backend Engineer',
        company: 'Company Alpha',
        startDate: '2024-01',
        endDate: '',
        current: true,
        description: 'Experience detail',
      },
    ],
    educations: [
      {
        school: 'University Alpha',
        degree: 'Bachelor Alpha',
        field: 'Major Alpha',
        startDate: '2020-01',
        endDate: '2023-12',
        description: 'Education detail',
        gpa: 3.65,
        gpaScale: 4,
      },
    ],
    projects: [
      {
        name: 'Project Alpha',
        role: 'Project role',
        url: 'https://example.test/project',
        description: 'Project detail',
        startDate: '2025-01',
        endDate: '2025-06',
        technologies: ['React', 'PostgreSQL'],
      },
    ],
    certifications: [
      {
        name: 'Certificate Alpha',
        issuer: 'Certificate issuer',
        issuedDate: '2024-02',
        credentialUrl: 'https://example.test/certificate',
      },
    ],
    languages: [{ name: 'English', proficiency: 'B2', certification: 'IELTS Alpha' }],
    awards: [
      {
        title: 'Award Alpha',
        issuer: 'Award issuer',
        awardedDate: '2025-06',
        description: 'Award detail',
      },
    ],
    activities: [
      {
        name: 'Activity Alpha',
        role: 'Activity role',
        organization: 'Organization Alpha',
        startDate: '2022-01',
        endDate: '2023-06',
        current: false,
        description: 'Activity detail',
      },
    ],
  }
  const before = JSON.stringify(draft)
  const html = render(draft)
  for (const value of [
    'Engineer',
    'cv@example.test',
    '0900000000',
    'Da Nang',
    'Summary detail',
    'Java',
    'Company Alpha',
    'Experience detail',
    'University Alpha',
    'Bachelor Alpha',
    'Major Alpha',
    'Education detail',
    'Project Alpha',
    'Project role',
    'Project detail',
    '3.65 / 4',
    'React · PostgreSQL',
    'Certificate Alpha',
    'Certificate issuer',
    'English',
    'B2',
    'IELTS Alpha',
    'Award Alpha',
    'Award issuer',
    'Award detail',
    'Activity Alpha',
    'Activity role',
    'Organization Alpha',
    'Activity detail',
    'Hiện tại',
    '02/2024',
    '06/2025',
  ])
    assert.ok(html.includes(value), value)
  for (const url of [
    draft.githubUrl,
    draft.linkedinUrl,
    draft.portfolioUrl,
    draft.projects[0].url,
    draft.certifications[0].credentialUrl,
  ])
    assert.ok(html.includes(`href="${url}"`), url)
  for (const label of [
    'Công ty',
    'Bằng cấp',
    'Chuyên ngành',
    'Vai trò',
    'Đơn vị cấp',
    'Liên kết chứng chỉ',
    'Đơn vị trao',
    'Tổ chức',
  ])
    assert.ok(html.includes(label), label)
  assert.ok(!html.includes('Chưa cung cấp'))
  assert.equal(JSON.stringify(draft), before)
})

test('legacy templates hide missing sections when explicitly requested and old snapshots still render', () => {
  for (const template of ['classic', 'modern']) {
    const html = render({ ...empty, template }, 'template')
    assert.ok(html.includes(`cv-paper-${template}`))
    assert.ok(!html.includes('Chưa cung cấp'))
    assert.ok(!html.includes('<h3>Hoạt động</h3>'))
  }
  assert.ok(
    render({ ...empty, languages: undefined, awards: undefined, activities: undefined }).includes(
      '<h3>Hoạt động</h3>',
    ),
  )
})

test('candidate preview and HR viewer use identical document content by default, including older templates', () => {
  for (const template of ['classic', 'modern']) {
    const draft = { ...empty, template, summary: 'Live preview content', skills: ['React'] }
    const candidate = renderToStaticMarkup(
      createElement(CvPreview, { draft, skills: draft.skills }),
    )
    assert.equal(candidate, render(draft, 'reviewer'))
    assert.ok(candidate.includes('cv-document-view'))
    assert.ok(candidate.includes('Live preview content'))
    assert.ok(candidate.includes('<h3>Chứng chỉ</h3>'))
  }
})

test('shared preview offers accessible light and dark controls without submitting a parent form', () => {
  const html = render(empty)
  assert.ok(html.includes('data-cv-theme="light"'))
  assert.ok(html.includes('aria-label="Màu nền CV"'))
  assert.ok(html.includes('type="button" aria-pressed="true"'))
  assert.ok(html.includes('type="button" aria-pressed="false"'))
  assert.ok(html.includes('Sáng'))
  assert.ok(html.includes('Tối'))
})

test('credential verification badges display on trusted certificates in reviewer and template modes', () => {
  const certDraft = {
    ...empty,
    certifications: [
      {
        name: 'AWS Solutions Architect',
        issuer: 'Amazon Web Services',
        issuedDate: '2024-05',
        credentialUrl: 'https://www.credly.com/badges/aws-certified-sa-123',
      },
      {
        name: 'Google Cloud Engineer',
        issuer: 'Google',
        issuedDate: '2024-01',
        credentialUrl: 'https://google.accredible.com/cert-456',
      },
      {
        name: 'Python Certificate',
        issuer: 'Google Drive Upload',
        issuedDate: '2023-10',
        credentialUrl: 'https://drive.google.com/file/d/sample/view',
      },
    ],
  }

  const reviewerHtml = render(certDraft, 'reviewer')
  assert.ok(reviewerHtml.includes('Xác thực Credly'))
  assert.ok(reviewerHtml.includes('Xác thực Google Cloud / Accredible'))
  assert.ok(reviewerHtml.includes('Lưu trữ đám mây'))

  const templateHtml = render(certDraft, 'template')
  assert.ok(templateHtml.includes('Xác thực Credly'))
  assert.ok(templateHtml.includes('Bản lưu trữ đám mây'))
})

