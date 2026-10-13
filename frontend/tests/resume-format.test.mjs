import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(
  new URL('../src/features/resumes/resume-format.ts', import.meta.url),
  'utf8',
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
})
const { hasResumeEntryContent, resumeBulletLines, resumeMonth, sortResumeEntries } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)

test('empty optional entries are hidden, including unchecked/current-only entries', () => {
  assert.equal(hasResumeEntryContent({ name: '', description: ' \n ', current: true }), false)
  assert.equal(hasResumeEntryContent({ name: null, current: false }), false)
  assert.equal(hasResumeEntryContent({ name: '', proficiency: 'B2' }), true)
  assert.equal(hasResumeEntryContent({ awardedDate: '2026-09' }), true)
})

test('preview orders current and recent work first without reordering the editable CV', () => {
  const entries = [
    { company: 'Old', startDate: '2018-01', endDate: '2020-01' },
    { company: 'Recent', startDate: '2021-01', endDate: '2025-06' },
    { company: 'Current', startDate: '2024-01', current: true },
    { company: 'Undated' },
  ]
  assert.deepEqual(
    sortResumeEntries(entries).map((item) => item.company),
    ['Current', 'Recent', 'Old', 'Undated'],
  )
  assert.equal(entries[0].company, 'Old')
  assert.deepEqual(
    sortResumeEntries([{ issuedDate: '2021-01' }, { issuedDate: '2024-09' }]).map(
      (item) => item.issuedDate,
    ),
    ['2024-09', '2021-01'],
  )
  assert.deepEqual(
    sortResumeEntries([{ awardedDate: '2020-01' }, { awardedDate: '2026-01' }]).map(
      (item) => item.awardedDate,
    ),
    ['2026-01', '2020-01'],
  )
})

test('each nonblank description line is a bullet, without duplicated bullet markers', () => {
  assert.deepEqual(
    resumeBulletLines('Build API\r\n\n - Reduce latency\n• Ship product\n* Mentor team'),
    ['Build API', 'Reduce latency', 'Ship product', 'Mentor team'],
  )
  assert.deepEqual(resumeBulletLines('Existing single paragraph.'), ['Existing single paragraph.'])
  assert.deepEqual(resumeBulletLines(null), [])
  assert.deepEqual(resumeBulletLines('  \n\t'), [])
})

test('CV dates display month/year and preserve empty or legacy dates', () => {
  assert.equal(resumeMonth('2026-01'), '01/2026')
  assert.equal(resumeMonth(''), '')
  assert.equal(resumeMonth(null), '')
  assert.equal(resumeMonth('2021'), '2021')
})
