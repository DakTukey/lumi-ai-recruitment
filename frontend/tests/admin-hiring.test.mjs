import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(
  new URL('../src/features/admin/admin-hiring.ts', import.meta.url),
  'utf8',
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
})
const { jobHiringProgress, validateHiringPlan, recruiterHasOpenJobs } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)
const job = {
  id: 'job1',
  headcount: 3,
  quotaStatus: 'APPROVED',
  recruiterId: 'hr',
  status: 'PUBLISHED',
}
const accounts = [
  { id: 'hr', role: 'RECRUITER', status: 'ACTIVE' },
  { id: 'locked', role: 'RECRUITER', status: 'INACTIVE' },
  { id: 'candidate', role: 'CANDIDATE', status: 'ACTIVE' },
  { id: 'admin', role: 'COMPANY_ADMIN', status: 'ACTIVE' },
]
const applications = [
  { id: '1', jobId: 'job1', candidateId: 'one', status: 'HIRED' },
  { id: '2', jobId: 'job1', candidateId: 'two', status: 'OFFER' },
  { id: '3', jobId: 'other', candidateId: 'three', status: 'HIRED' },
  { id: '4', jobId: 'job1', candidateId: 'four', status: 'REJECTED' },
]

test('progress counts distinct hires in this job, excludes offers and other jobs, never gives negative remaining', () => {
  assert.deepEqual(jobHiringProgress(job, applications), { hired: 1, remaining: 2, filled: false })
  assert.deepEqual(jobHiringProgress({ ...job, headcount: 1 }, applications), {
    hired: 1,
    remaining: 0,
    filled: true,
  })
  const repeated = [...applications, { ...applications[0], id: 'duplicate' }]
  assert.equal(jobHiringProgress(job, repeated).hired, 1)
  assert.deepEqual(
    jobHiringProgress({ ...job, headcount: 1 }, [
      ...applications,
      { jobId: 'job1', candidateId: 'five', status: 'HIRED' },
    ]),
    { hired: 2, remaining: 0, filled: true },
  )
})

test('quota must fit a positive PostgreSQL integer and cannot go below already hired people', () => {
  for (const headcount of [0, -1, 1.5, NaN, Infinity, 2147483648]) {
    assert.match(
      validateHiringPlan({ ...job, headcount }, applications, accounts),
      /số nguyên dương/,
    )
  }
  const hiredTwice = [...applications, { jobId: 'job1', candidateId: 'five', status: 'HIRED' }]
  assert.match(
    validateHiringPlan({ ...job, headcount: 1 }, hiredTwice, accounts),
    /nhỏ hơn số người đã tuyển/,
  )
  assert.equal(validateHiringPlan({ ...job, headcount: 2147483647 }, applications, accounts), '')
})

test('assign only active HR; publishing or reopening requires approved quota and assignee', () => {
  for (const recruiterId of ['locked', 'candidate', 'admin', 'unknown']) {
    assert.match(
      validateHiringPlan({ ...job, recruiterId }, applications, accounts),
      /HR đang hoạt động/,
    )
  }
  assert.match(
    validateHiringPlan({ ...job, quotaStatus: 'PENDING' }, applications, accounts),
    /duyệt chỉ tiêu/,
  )
  assert.match(
    validateHiringPlan({ ...job, recruiterId: null }, applications, accounts),
    /phân công HR/,
  )
  assert.equal(
    validateHiringPlan(
      { ...job, status: 'DRAFT', quotaStatus: 'PENDING', recruiterId: null },
      applications,
      accounts,
    ),
    '',
  )
  assert.equal(validateHiringPlan(job, applications, accounts), '')
  assert.match(
    validateHiringPlan({ ...job, quotaStatus: 'invalid' }, applications, accounts),
    /hợp lệ/,
  )
})

test('HR with draft or published assignments must be reassigned before disabling or changing role', () => {
  assert.equal(recruiterHasOpenJobs('hr', [job]), true)
  assert.equal(recruiterHasOpenJobs('hr', [{ ...job, status: 'DRAFT' }]), true)
  assert.equal(recruiterHasOpenJobs('hr', [{ ...job, status: 'CLOSED' }]), false)
  assert.equal(recruiterHasOpenJobs('other', [job]), false)
})
