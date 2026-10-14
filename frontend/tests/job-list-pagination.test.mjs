import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

async function moduleUrl(path, replacements = {}) {
  let source = await readFile(new URL(path, import.meta.url), 'utf8')
  for (const [from, to] of Object.entries(replacements)) source = source.replace(from, to)
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  })
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
}
const paginationUrl = await moduleUrl('../src/features/jobs/job-list-pagination.ts')
const { appendJobPage, JOB_PAGE_SIZE } = await import(paginationUrl)
const jobsUrl = await moduleUrl('./fixtures/jobs.ts')
const { previewJobPage } = await import(
  await moduleUrl('./fixtures/candidate-job-preview.ts', {
    "'./jobs'": JSON.stringify(jobsUrl),
    "'../../src/features/jobs/job-list-pagination'": JSON.stringify(paginationUrl),
  })
)
const filters = {
  query: '',
  category: 'Tất cả',
  levels: [],
  modes: [],
  salary: false,
  sort: 'featured',
  savedOnly: false,
  saved: [],
}

test('overlapping or retried pages refresh repeated jobs without duplicates or reordering earlier cards', () => {
  const existing = [
    { id: 'a', title: 'Old' },
    { id: 'b', title: 'Second' },
  ]
  const incoming = [
    { id: 'a', title: 'Updated' },
    { id: 'c', title: 'Third' },
  ]
  const appended = appendJobPage(existing, incoming)
  assert.deepEqual(appended, [{ id: 'a', title: 'Updated' }, existing[1], incoming[1]])
  assert.deepEqual(appendJobPage(appended, incoming), appended)
  assert.equal(existing[0].title, 'Old')
})

test('sample browsing shows 12 initially then appends the remaining two in the same order', () => {
  const first = previewJobPage({ ...filters, page: 0, cumulative: true })
  const next = previewJobPage({ ...filters, page: 1 })
  const all = previewJobPage({ ...filters, page: 1, cumulative: true })
  assert.equal(first.content.length, JOB_PAGE_SIZE)
  assert.equal(all.content.length, 14)
  assert.equal(all.totalPages, 2)
  assert.deepEqual(all.content, appendJobPage(first.content, next.content))
  assert.equal(new Set(all.content.map((job) => job.id)).size, 14)
})

test('filtered cumulative results contain only matching jobs and retain the selected salary sort', () => {
  const result = previewJobPage({
    ...filters,
    modes: ['Remote'],
    salary: true,
    sort: 'salary',
    page: 0,
    cumulative: true,
  })
  assert.ok(result.content.length > 0)
  assert.ok(result.content.every((job) => job.mode === 'Remote' && job.minSalary >= 15))
  assert.ok(
    result.content.every(
      (job, index, jobs) => index === 0 || jobs[index - 1].minSalary >= job.minSalary,
    ),
  )
  const empty = previewJobPage({ ...filters, query: 'nonexistent-job', page: 0, cumulative: true })
  assert.equal(empty.content.length, 0)
  assert.equal(empty.totalElements, 0)
})
