import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}
const {
  safeJobListPath,
  jobDetailPath,
  jobApplicationPath,
  candidateJobLoginDestination,
  jobMatchPath,
  improveCvPath,
} = await load('../src/features/jobs/candidate-job-route.ts')
const { readJobBrowseSnapshot, saveJobBrowseSnapshot } = await load(
  '../src/features/jobs/job-browse-state.ts',
)
const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
test('detail links discard retired sample mode and preserve a safe list source', () => {
  const url = new URL(
    jobDetailPath(1, '/saved?data=sample#opportunities'),
    'https://lumi.local',
  )
  assert.equal(url.pathname, '/jobs/1')
  assert.equal(url.searchParams.get('data'), null)
  assert.equal(url.searchParams.get('from'), '/saved#opportunities')
  assert.equal(jobDetailPath(id), `/jobs/${id}`)
})
test('return links cannot point outside the job list or forward arbitrary parameters', () => {
  for (const path of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/login',
    '/recruiter',
    '/jobs/1',
    null,
  ]) {
    assert.equal(safeJobListPath(path), '/#opportunities')
  }
  assert.equal(safeJobListPath('/saved?token=secret&data=sample#bad'), '/saved')
  assert.equal(safeJobListPath(null), '/#opportunities')
})
test('login resumes the application on the job page with only permitted destinations', () => {
  assert.equal(candidateJobLoginDestination(jobApplicationPath(id)), `/jobs/${id}?apply=1`)
  assert.equal(candidateJobLoginDestination(`/jobs/${id}`), `/jobs/${id}`)
  for (const path of [
    `/jobs/${id}?redirect=https://evil.test`,
    '/jobs/1?data=sample',
    '//evil.test',
    '/admin',
  ])
    assert.equal(candidateJobLoginDestination(path), null)
})
test('list history snapshots preserve loaded data and are isolated by history entry and account', () => {
  const snapshot = {
    query: 'React',
    category: 'Tất cả',
    levels: ['Junior'],
    modes: [],
    salary: false,
    sort: 'salary',
    filtersOpen: true,
    page: 1,
    retry: 0,
    filterKey: 'filters',
    departments: [],
    result: { key: 'request', scope: 'filters', jobs: [{ id }], total: 14, pages: 2, error: '' },
    scrollY: 2000,
  }
  saveJobBrowseSnapshot('entry-a', snapshot, 'candidate-a')
  assert.deepEqual(readJobBrowseSnapshot('entry-a', 'candidate-a'), snapshot)
  assert.equal(readJobBrowseSnapshot('entry-b', 'candidate-a'), undefined)
  assert.equal(readJobBrowseSnapshot('entry-a', 'candidate-b'), undefined)
  assert.equal(readJobBrowseSnapshot('entry-a'), undefined)
  for (let i = 0; i < 8; i++)
    saveJobBrowseSnapshot(`new-entry-${i}`, { ...snapshot, scrollY: i }, 'candidate-a')
  assert.equal(readJobBrowseSnapshot('entry-a', 'candidate-a'), undefined)
  assert.equal(readJobBrowseSnapshot('new-entry-7', 'candidate-a').scrollY, 7)
})

test('improve and return links preserve the selected CV and job without redirect URLs', () => {
  const improve = new URL(improveCvPath(id, 'cv-id'), 'https://lumi.local')
  assert.equal(improve.pathname, '/cv-builder')
  assert.equal(improve.searchParams.get('id'), 'cv-id')
  assert.equal(improve.searchParams.get('jobId'), id)
  assert.equal(improve.searchParams.get('returnTo'), 'match')
  const back = new URL(jobMatchPath(id, 'cv-id'), 'https://lumi.local')
  assert.equal(back.searchParams.get('match'), '1')
  assert.equal(back.searchParams.get('resumeId'), 'cv-id')
  assert.equal(back.hash, '#job-cv-match')
})
