import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const code = ts.transpileModule(
  await readFile(new URL('../src/features/resumes/pdf-review-model.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  },
).outputText
const { moveReviewEntry, reviewLabel, readablePdfWarnings } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
)

test('old model warnings hide empty bullets and preserve meaningful messages', () => {
  assert.deepEqual(
    readablePdfWarnings([
      '',
      ' ',
      '\u200b',
      '- • —',
      null,
      3,
      ' Kiểm tra ngày tháng ',
      'Kiểm tra ngày tháng',
      'Trang 2: khó đọc',
    ]),
    ['Kiểm tra ngày tháng', 'Trang 2: khó đọc'],
  )
  assert.deepEqual(readablePdfWarnings(null), [])
})

test('misclassified work can move to projects without mutating extraction', () => {
  const source = {
    experiences: [
      {
        company: 'Personal shop',
        position: 'Developer',
        description: 'Build API',
        startDate: '2025-01',
        endDate: '',
        current: true,
      },
    ],
    projects: [],
  }
  const copy = structuredClone(source)
  const moved = moveReviewEntry(source, 'experiences', 0)
  assert.deepEqual(source, copy)
  assert.equal(moved.experiences.length, 0)
  assert.equal(moved.projects[0].name, 'Personal shop')
  assert.equal(moved.projects[0].role, 'Developer')
  assert.equal(moved.projects[0].description, 'Build API')
  assert.equal(moved.projects[0].startDate, '2025-01')
})
test('moving project to work keeps source details and enforces section limit', () => {
  const source = {
    projects: [
      {
        name: 'Store',
        role: 'Backend',
        description: 'Build APIs',
        url: 'https://example.test',
        technologies: ['Java'],
      },
    ],
    experiences: [],
  }
  const moved = moveReviewEntry(source, 'projects', 0)
  assert.equal(moved.experiences[0].company, '')
  assert.match(moved.experiences[0].description, /Store/)
  assert.match(moved.experiences[0].description, /Java/)
  assert.match(moved.experiences[0].description, /https:\/\/example.test/)
  const full = { ...source, experiences: Array.from({ length: 30 }, () => ({})) }
  assert.equal(moveReviewEntry(full, 'projects', 0), full)
})
test('review issues and evidence use readable labels', () => {
  assert.equal(reviewLabel('experiences[0].company'), 'Kinh nghiệm 1 · Công ty')
  assert.equal(reviewLabel('email'), 'Email')
  assert.equal(reviewLabel('portfolioUrl'), 'Portfolio / Website')
})
