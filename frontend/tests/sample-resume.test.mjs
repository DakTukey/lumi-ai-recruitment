import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(
  new URL('./fixtures/sample-resume.ts', import.meta.url),
  'utf8',
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
})
const { sampleResume } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)
const application = {
  name: 'Ứng viên mẫu',
  role: 'Developer',
  email: 'sample@example.test',
  phone: '0900000000',
  skills: ['Java', 'SQL'],
  summary: 'Giới thiệu',
  experience: 'Developer · Thực tập\nXây dựng API.',
  education: 'Cử nhân CNTT · 2022–2026',
  project: 'Dự án A\nJava, SQL',
}

test('sample CV preserves every original text without inventing structured details', () => {
  const cv = sampleResume(application)
  assert.equal(cv.fullName, application.name)
  assert.equal(cv.desiredPosition, application.role)
  assert.equal(cv.email, application.email)
  assert.equal(cv.phone, application.phone)
  assert.equal(cv.summary, application.summary)
  assert.deepEqual(cv.skills, application.skills)
  assert.equal(cv.experiences[0].description, application.experience)
  assert.equal(cv.educations[0].description, application.education)
  assert.equal(cv.projects[0].description, application.project)
  assert.equal(cv.experiences[0].company, '')
  assert.equal(cv.experiences[0].startDate, '')
  assert.equal(cv.educations[0].school, '')
  assert.equal(cv.location, null)
  for (const section of ['certifications', 'languages', 'awards', 'activities'])
    assert.deepEqual(cv[section], [])
})

test('sample CV omits blank sections rather than showing empty headings', () => {
  const cv = sampleResume({ ...application, experience: ' ', education: '', project: '\n' })
  assert.deepEqual(cv.experiences, [])
  assert.deepEqual(cv.educations, [])
  assert.deepEqual(cv.projects, [])
})
