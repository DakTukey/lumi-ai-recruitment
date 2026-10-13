import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const source = await readFile(
  new URL('../src/features/resumes/cv-builder-model.ts', import.meta.url),
  'utf8',
)
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText
const { mergeSkills, profileSkillNames, validateCv, cvQualityHints } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
)
const empty = {
  skills: [],
  educations: [],
  experiences: [],
  projects: [],
  languages: [],
  certifications: [],
  awards: [],
  activities: [],
}

test('profile merge preserves spelling, eliminates case/space duplicates and keeps C++ distinct from C#', () => {
  assert.deepEqual(
    mergeSkills(['Java', 'Spring Boot'], profileSkillNames('java, Spring   Boot\nReact, C++, C#'))
      .skills,
    ['Java', 'Spring Boot', 'React', 'C++', 'C#'],
  )
  const full = Array.from({ length: 100 }, (_, i) => `Skill ${i}`)
  const result = mergeSkills(full, ['skill 0', 'Extra', 'x'.repeat(101)])
  assert.deepEqual(result.skills, full)
  assert.equal(result.overflow, 1)
  assert.equal(result.tooLong, 1)
})

test('incomplete CV is allowed as a draft, but gets completion suggestions', () => {
  assert.deepEqual(validateCv(empty), [])
  assert.equal(cvQualityHints(empty).length, 3)
  const student = {
    ...empty,
    summary: 'Sinh viên CNTT.',
    skills: ['Java'],
    educations: [{ school: 'Đại học', description: '' }],
  }
  assert.deepEqual(cvQualityHints(student), [])
})

test('contact, unsafe links and reversed project dates point back to the correct fields', () => {
  const issues = validateCv({
    ...empty,
    email: 'bad',
    phone: 'abc',
    githubUrl: 'javascript:alert(1)',
    projects: [{ name: 'Project', startDate: '2026-03', endDate: '2025-01', url: 'example.com' }],
  })
  assert.deepEqual(
    issues.map((i) => i.field),
    ['email', 'phone', 'githubUrl', 'projects-0-endDate', 'projects-0-url'],
  )
  assert.equal(issues.at(-1).step, 2)
})

test('GPA supports zero and explicit scales, rejects mismatches and excessive precision', () => {
  for (const [gpa, gpaScale] of [
    [0, 4],
    [3.65, 4],
    [8.5, 10],
    [95.25, 100],
  ])
    assert.deepEqual(validateCv({ ...empty, educations: [{ gpa, gpaScale }] }), [])
  for (const [gpa, gpaScale] of [
    [5, 4],
    [-1, 4],
    [3.333, 4],
    [3.2, null],
    [null, 4],
    [1, 5],
  ])
    assert.ok(validateCv({ ...empty, educations: [{ gpa, gpaScale }] }).length)
  assert.deepEqual(
    validateCv({
      ...empty,
      educations: [{ school: 'Legacy' }],
      projects: [{ name: 'Legacy', description: 'Old CV' }],
    }),
    [],
  )
})

test('partially filled sections prompt the user without requiring invented experience', () => {
  const hints = cvQualityHints({ ...empty, projects: [{ name: '', description: 'Built an API' }] })
  assert.ok(hints.some((h) => h.field === 'projects-0-name'))
})
