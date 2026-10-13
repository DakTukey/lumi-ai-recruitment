import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

async function moduleUrl(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  })
  for (const [name, url] of Object.entries(dependencies)) outputText = outputText.replace(name, url)
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
}
const jobsUrl = await moduleUrl('../src/features/jobs/data/jobs.ts')
const {
  emptyDraft,
  validateDraft,
  salaryLabel,
  expired,
  jobFromDraft,
  seedJobs,
  seedApplications,
} = await import(
  await moduleUrl('../src/features/jobs/recruiter-model.ts', { './data/jobs': jobsUrl })
)
const { jobApplicationSummary } = await import(
  await moduleUrl('../src/features/jobs/job-candidates-model.ts')
)
const valid = () => ({
  ...emptyDraft(),
  title: 'Developer',
  skills: [{ name: 'Java', required: true }],
  description: 'Build API',
  requirements: 'Understand Java',
})

test('job AI summary scopes applicants, ranks completed active results and keeps all other records visible', () => {
  const [first, pending, otherJob] = seedApplications()
  const scored = (id, stage, score) => ({
    ...first,
    id,
    stage,
    assessment: { ...first.assessment, score },
  })
  const entries = [
    first,
    pending,
    otherJob,
    scored('high', 'REVIEWING', 92),
    scored('rejected', 'REJECTED', 99),
    scored('withdrawn', 'WITHDRAWN', 98),
    scored('hired', 'HIRED', 97),
    scored('offer', 'OFFER', 96),
  ]
  const result = jobApplicationSummary(entries, first.jobId)
  assert.equal(result.scoped.length, 7)
  assert.equal(result.assessed.length, 6)
  assert.deepEqual(
    result.ranked.map((item) => item.id),
    ['high', first.id],
  )
  assert.equal(entries[0].id, first.id)
  assert.deepEqual(jobApplicationSummary(entries, 'job-without-applicants'), {
    scoped: [],
    assessed: [],
    ranked: [],
  })
  assert.equal(jobApplicationSummary(entries, otherJob.jobId).ranked.length, 0)
})

test('salary modes preserve full VND amounts and reject inverted or invalid bounds', () => {
  const draft = { ...valid(), salaryMode: 'RANGE', salaryMin: '25000000', salaryMax: '15000000' }
  assert.ok(validateDraft(draft).salaryMax)
  draft.salaryMax = '35000000'
  assert.deepEqual(validateDraft(draft), {})
  assert.equal(salaryLabel(draft), '25.000.000 – 35.000.000 ₫/tháng')
  assert.ok(validateDraft({ ...draft, salaryMin: '-1' }).salaryMin)
  assert.ok(validateDraft({ ...draft, salaryMax: 'Infinity' }).salaryMax)
  assert.deepEqual(
    validateDraft({ ...draft, salaryMode: 'NEGOTIABLE', salaryMin: '', salaryMax: '' }),
    {},
  )
})

test('draft with past deadline can be saved but cannot be published', () => {
  const draft = { ...valid(), deadline: '2000-01-01' }
  assert.deepEqual(validateDraft(draft), {})
  assert.ok(validateDraft(draft, true).deadline)
  assert.equal(expired('2000-01-01'), true)
  assert.equal(expired('2999-01-01'), false)
  assert.equal(expired(''), false)
})

test('headcount is required, positive, integral and fits a PostgreSQL integer; editing preserves it', () => {
  assert.equal(emptyDraft().headcount, '1')
  for (const value of ['', '0', '-1', '1.5', 'NaN', 'Infinity', '2147483648']) {
    assert.ok(validateDraft({ ...valid(), headcount: value }).headcount, value)
  }
  for (const value of ['1', '7', '2147483647']) {
    assert.deepEqual(validateDraft({ ...valid(), headcount: value }), {})
  }
  const created = jobFromDraft({ ...valid(), headcount: '7' })
  assert.equal(created.headcount, 7)
  assert.equal(jobFromDraft({ ...created.draft, title: 'Edited' }, created).headcount, 7)
})

test('Vietnam deadline is valid through the end of its calendar day', () => {
  const actualNow = Date.now
  try {
    Date.now = () => Date.parse('2026-10-09T23:59:58+07:00')
    assert.equal(expired('2026-10-09'), false)
    Date.now = () => Date.parse('2026-10-10T00:00:00+07:00')
    assert.equal(expired('2026-10-09'), true)
  } finally {
    Date.now = actualNow
  }
})

test('editing keeps identity, status and prior history without mutating earlier records', () => {
  const created = jobFromDraft({
    ...valid(),
    salaryMode: 'FROM',
    salaryMin: '15000000',
    salaryMax: '90000000',
  })
  assert.equal(created.draft.salaryMax, '')
  const published = jobFromDraft(
    { ...created.draft, title: 'Senior Developer' },
    created,
    true,
    'HR Demo',
  )
  assert.equal(published.id, created.id)
  assert.equal(published.status, 'PUBLISHED')
  assert.equal(created.status, 'DRAFT')
  assert.equal(created.title, 'Developer')
  assert.equal(created.history.length, 1)
  assert.equal(published.history.length, 2)
  assert.equal(published.history[1].actor, 'HR Demo')
  assert.equal(jobFromDraft(published.draft, published).status, 'PUBLISHED')
})

test('criteria reject blank descriptions and non-finite weights; sample applications link to existing jobs', () => {
  assert.ok(
    validateDraft({
      ...valid(),
      criteria: [{ id: '1', type: 'OTHER', description: ' ', required: false, weight: 1 }],
    }).criteria,
  )
  assert.ok(
    validateDraft({
      ...valid(),
      criteria: [
        { id: '1', type: 'OTHER', description: 'Experience', required: true, weight: NaN },
      ],
    }).criteria,
  )
  const jobs = seedJobs()
  for (const application of seedApplications()) {
    assert.ok(jobs.some((job) => String(job.id) === application.jobId))
  }
})

const modelUrl = await moduleUrl('../src/features/jobs/recruiter-model.ts', {
  './data/jobs': jobsUrl,
})
const apiStub =
  'data:text/javascript;base64,' +
  Buffer.from(
    'export const get = () => {}; export const post = () => {}; export const put = () => {};',
  ).toString('base64')
const { createJobPayload } = await import(
  await moduleUrl('../src/services/recruiter-job.service.ts', {
    './api': apiStub,
    '../features/jobs/recruiter-model': modelUrl,
  })
)
test('real job request uses department UUID, DB codes, monthly VND and calendar deadline without lifecycle fields', () => {
  const draft = {
    ...valid(),
    departmentId: 'a-real-uuid',
    positionId: 'position-uuid',
    headcount: '3',
    mode: 'Tại văn phòng',
    salaryMode: 'FROM',
    salaryMin: '15000000',
    salaryMax: '90000000',
    deadline: '2026-10-29',
    criteria: [
      { id: 'ui-only', type: 'LANGUAGE', description: 'English', required: false, weight: 25.5 },
    ],
  }
  const payload = createJobPayload(draft)
  assert.equal(payload.departmentId, 'a-real-uuid')
  assert.equal(payload.positionId, 'position-uuid')
  assert.equal(payload.headcount, 3)
  assert.equal(payload.workMode, 'ONSITE')
  assert.equal(payload.experienceLevel, 'JUNIOR')
  assert.equal(payload.salaryMin, 15000000)
  assert.equal(payload.salaryMax, null)
  assert.equal(payload.applicationDeadline, '2026-10-29')
  assert.equal(payload.skills[0].required, true)
  assert.equal(payload.criteria[0].required, false)
  assert.equal(payload.criteria[0].weight, 25.5)
  for (const field of ['status', 'createdBy', 'publishedAt', 'version', 'category'])
    assert.equal(field in payload, false)
  assert.equal('id' in payload.criteria[0], false)
  assert.equal(createJobPayload({ ...draft, salaryMode: 'NEGOTIABLE' }).salaryMin, null)
})
test('draft validation prevents salary precision/overflow and content exceeding the API limits', () => {
  assert.ok(validateDraft({ ...valid(), salaryMode: 'FROM', salaryMin: '15000000.123' }).salaryMin)
  assert.ok(
    validateDraft({ ...valid(), salaryMode: 'FROM', salaryMin: '10000000000000' }).salaryMin,
  )
  assert.ok(validateDraft({ ...valid(), description: 'x'.repeat(20001) }).description)
  assert.ok(validateDraft({ ...valid(), location: 'x'.repeat(256) }).location)
})
