import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(
  new URL('../src/features/jobs/job-position-model.ts', import.meta.url),
  'utf8',
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022 },
})
const { selectJobPosition, selectJobLevel } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)

test('auto title follows position/level, manual title survives changes and department reset clears the position', () => {
  const first = selectJobPosition({ title: '', level: 'Junior' }, 'backend', 'Backend Developer')
  assert.equal(first.title, 'Junior Backend Developer')
  const senior = selectJobLevel(first, 'Senior')
  assert.equal(senior.title, 'Senior Backend Developer')
  assert.equal(first.title, 'Junior Backend Developer')
  const manual = { ...senior, title: 'Java Developer — Payments' }
  assert.equal(selectJobLevel(manual, 'Middle').title, manual.title)
  assert.equal(selectJobPosition(manual, 'frontend', 'Frontend Developer').title, manual.title)
  const cleared = selectJobPosition(senior, '', '')
  assert.equal(cleared.positionId, '')
  assert.equal(cleared.positionName, '')
  assert.equal(cleared.title, '')
})
