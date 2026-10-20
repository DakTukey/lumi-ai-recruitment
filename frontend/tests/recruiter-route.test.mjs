import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const code = ts.transpileModule(
  await readFile(new URL('../src/features/jobs/recruiter-route.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } },
).outputText
const {
  parseRecruiterRoute,
  recruiterJobUrl,
  recruiterLoginDestination,
  recruiterReturnUrl,
  recruiterSectionUrl,
  recruiterUrl,
} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('job and application deep links restore ID and tab without sample mode', () => {
  const job = new URL(recruiterJobUrl('job-123', 'ai'), 'http://localhost')
  assert.deepEqual(parseRecruiterRoute(job.pathname, job.search), {
    section: 'jobs',
    kind: 'job',
    id: 'job-123',
    tab: 'ai',
    filterJobId: '',
  })
  const application = new URL(
    recruiterUrl('/recruiter/applications/app-1', { tab: 'notes' }),
    'http://localhost',
  )
  assert.equal(parseRecruiterRoute(application.pathname, application.search).tab, 'notes')
  for (const tab of ['github', 'scorecard', 'clarifications']) assert.equal(parseRecruiterRoute('/recruiter/applications/app-1', '?tab=' + tab).tab, tab)
  assert.equal(parseRecruiterRoute('/recruiter/applications/app-1', '?tab=invalid').tab, 'cv')
  assert.equal(
    parseRecruiterRoute('/recruiter/applications/app-1', '?tab=workflow&data=sample').tab,
    'workflow',
  )
  assert.equal(parseRecruiterRoute('/recruiter/jobs/job-123', '?tab=notes').tab, 'content')
})

test('return link preserves job scope and filters through refresh and sharing', () => {
  const from =
    '/recruiter/jobs/123?tab=applicants&stage=SUBMITTED&search=Minh+Anh&page=2&data=sample'
  const detail = new URL(
    recruiterUrl('/recruiter/applications/app-1', { tab: 'ai', from }),
    'http://localhost',
  )
  const restored = new URL(
    recruiterReturnUrl(detail.searchParams.get('from')),
    'http://localhost',
  )
  assert.equal(restored.pathname, '/recruiter/jobs/123')
  for (const [key, value] of new URLSearchParams(from.split('?')[1]))
    assert.equal(restored.searchParams.get(key), key === 'data' ? null : value)
  const global = new URL(
    recruiterReturnUrl('/recruiter/applications?jobId=123&stage=REVIEWING&search=Huy'),
    'http://localhost',
  )
  assert.equal(parseRecruiterRoute(global.pathname, global.search).filterJobId, '123')
  assert.equal(global.searchParams.get('stage'), 'REVIEWING')
})

test('return destinations stay in HR lists and jobs and respect the current data mode', () => {
  for (const value of [
    null,
    'https://evil.test',
    '//evil.test',
    '/admin',
    '/recruiter/applications/app-2',
    '/recruiter/profile',
    '/recruiter/jobs/../admin',
    '/recruiter/jobs/a%2Fb',
    '/recruiter/jobs/%',
    '/recruiter.evil.test',
  ]) {
    assert.equal(recruiterReturnUrl(value), '/recruiter/applications')
  }
  assert.equal(
    recruiterReturnUrl('/recruiter/jobs/123?data=sample&tab=ai'),
    '/recruiter/jobs/123?tab=ai',
  )
  assert.equal(
    new URL(recruiterReturnUrl('/recruiter/jobs/123'), 'http://localhost').searchParams.get(
      'data',
    ),
    null,
  )
  assert.equal(recruiterSectionUrl('jobs'), '/recruiter/jobs')
  assert.equal(parseRecruiterRoute('/recruiter/').kind, 'section')
  assert.equal(parseRecruiterRoute('/recruiter/unknown').kind, 'missing')
})

test('staff can resume a valid HR deep link after login without accepting external destinations', () => {
  const path = '/recruiter/applications/app-1?tab=ai&data=sample&from=%2Frecruiter%2Fjobs%2F1'
  assert.equal(recruiterLoginDestination(path), path)
  for (const invalid of [
    undefined,
    '//evil.test',
    'https://evil.test',
    '/admin',
    '/recruiter-malicious',
    '/recruiter/jobs/%2Ffoo',
  ]) {
    assert.equal(recruiterLoginDestination(invalid), null)
  }
})
