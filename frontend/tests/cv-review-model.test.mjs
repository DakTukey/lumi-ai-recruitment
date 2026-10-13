import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const source = await readFile(
  new URL('../src/features/resumes/cv-review-model.ts', import.meta.url),
  'utf8',
)
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText
const { cvReviewContext, reviewFingerprint, withReviewText, reviewText, reviewQuestion } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const draft = {
  title: 'CV',
  fullName: 'Private name',
  email: 'private@example.test',
  phone: '0900000000',
  location: 'Private address',
  githubUrl: 'private link',
  summary: 'Original summary',
  desiredPosition: 'Developer',
  skills: ['Java'],
  experiences: [],
  educations: [],
  projects: [
    { name: 'A', description: 'Original A' },
    { name: 'B', description: 'Original B' },
  ],
  certifications: [],
  languages: [],
  awards: [],
  activities: [],
}
test('review context excludes identity/contact fields and supports no job', () => {
  const context = cvReviewContext(draft),
    json = JSON.stringify(context)
  for (const value of [
    'Private name',
    'private@example.test',
    '0900000000',
    'Private address',
    'private link',
  ])
    assert.ok(!json.includes(value))
  assert.ok(reviewFingerprint(context, null).includes('"jobId":null'))
})
test('apply/undo change exactly one target without mutating the source', () => {
  const context = cvReviewContext(draft),
    before = JSON.stringify(context),
    target = { section: 'project', index: 1 }
  const applied = withReviewText(context, target, 'Improved B')
  assert.equal(reviewText(applied, target), 'Improved B')
  assert.equal(applied.projects[0].description, 'Original A')
  assert.equal(JSON.stringify(context), before)
  assert.equal(
    reviewFingerprint(withReviewText(applied, target, 'Original B'), null),
    reviewFingerprint(context, null),
  )
  assert.equal(withReviewText(context, { section: 'project', index: 9 }, 'Oops'), context)
})
test('manual edits, reordering/removal and changed jobs invalidate old proposals', () => {
  const context = cvReviewContext(draft),
    fingerprint = reviewFingerprint(context, 'job-a')
  for (const changed of [
    { ...context, summary: 'Manual edit' },
    { ...context, projects: [...context.projects].reverse() },
    { ...context, projects: context.projects.slice(1) },
  ])
    assert.notEqual(reviewFingerprint(changed, 'job-a'), fingerprint)
  assert.notEqual(reviewFingerprint(context, 'job-b'), fingerprint)
  assert.equal(reviewText(context, { section: 'summary', index: 0 }), undefined)
})

test('summary clarification asks for facts instead of a finished paragraph', () => {
  assert.ok(
    !reviewQuestion({
      section: 'summary',
      kind: 'ADD',
      question: 'Bạn viết một đoạn tóm tắt 3-4 câu?',
    }).includes('tóm tắt'),
  )
  assert.equal(
    reviewQuestion({ section: 'project', kind: 'CLARIFY', question: 'Bạn làm phần nào?' }),
    'Bạn làm phần nào?',
  )
})
