import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const code = ts.transpileModule(
  await readFile(
    new URL('../src/features/jobs/candidate-job-match-model.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  },
).outputText
const { jobMatchOverview, isCurrentJobMatch } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
)
const fixture = ts.transpileModule(await readFile(new URL('./fixtures/candidate-job-match.ts', import.meta.url), 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
const {sampleJobMatch,sampleMatchResumes} = await import(`data:text/javascript;base64,${Buffer.from(fixture).toString('base64')}`)

test('empty or unweighted criteria do not invent an overall fit score', () => {
  assert.equal(jobMatchOverview([]).score, null)
  assert.equal(
    jobMatchOverview([{ weight: 0, score: 100, status: 'MATCHED', required: true }]).score,
    null,
  )
})
test('score is a weighted fit, with unknown evidence kept distinct from a known zero', () => {
  const result = jobMatchOverview([
    { weight: 3, score: 90, status: 'MATCHED', required: true },
    { weight: 1, score: null, status: 'NO_EVIDENCE', required: true },
    { weight: 1, score: 0, status: 'PARTIAL', required: false },
  ])
  assert.deepEqual(result, { score: 54, matched: 1, partial: 1, unknown: 1, requiredUnknown: 1 })
})
test('sample profiles retain their source and CV/job identity without mutating input', () => {
  const job = { id: 'job-one', tags: ['React', 'TypeScript', 'React', 'UI/UX'] }
  const original = structuredClone(job)
  const experienced = sampleJobMatch(job, sampleMatchResumes[0].id)
  const graduate = sampleJobMatch(job, sampleMatchResumes[1].id)
  assert.equal(experienced.source, 'sample')
  assert.equal(experienced.jobId, 'job-one')
  assert.notEqual(experienced.resumeId, graduate.resumeId)
  assert.ok(
    jobMatchOverview(experienced.criteria).score > jobMatchOverview(graduate.criteria).score,
  )
  assert.equal(new Set(experienced.criteria.map((r) => r.id)).size, experienced.criteria.length)
  assert.ok(experienced.criteria.every((r) => r.score === null || (r.score >= 0 && r.score <= 100)))
  assert.ok(
    experienced.criteria
      .filter((r) => r.status === 'NO_EVIDENCE')
      .every((r) => r.score === null && r.evidence === null),
  )
  assert.deepEqual(job, original)
})

test('results belong to exactly the selected CV version and job', () => {
  const match = { jobId: 'a', resumeId: 'b', resumeVersion: 3 }
  assert.equal(isCurrentJobMatch(match, 'a', { id: 'b', version: 3 }), true)
  assert.equal(isCurrentJobMatch(match, 'c', { id: 'b', version: 3 }), false)
  assert.equal(isCurrentJobMatch(match, 'a', { id: 'other', version: 3 }), false)
  assert.equal(isCurrentJobMatch(match, 'a', { id: 'b', version: 4 }), false)
})
