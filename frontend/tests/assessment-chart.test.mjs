import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const code = ts.transpileModule(
  await readFile(
    new URL('../src/features/applications/assessment-chart-model.ts', import.meta.url),
    'utf8',
  ),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } },
).outputText
const { assessmentChartData } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
)
const radarCode = ts.transpileModule(
  await readFile(
    new URL('../src/features/applications/assessment-radar-model.ts', import.meta.url),
    'utf8',
  ),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } },
).outputText
const { radarGroups, radarPoint, radarLabel } = await import(
  `data:text/javascript;base64,${Buffer.from(radarCode).toString('base64')}`
)
const criterion = (points, weight, status = 'MATCHED') => ({
  skill: 'React',
  points,
  weight,
  status,
  evidence: 'CV',
  reason: 'Reason',
  source: 'CV snapshot',
})

test('real fit values become weighted contributions on a 100-point scale', () => {
  const input = [criterion(90, 2), criterion(60, 1, 'PARTIAL')]
  const original = structuredClone(input)
  const { rows, groups } = assessmentChartData(input, false)
  assert.ok(Math.abs(rows[0].maximum - 200 / 3) < 1e-10)
  assert.ok(Math.abs(rows[0].earned - 60) < 1e-10)
  assert.ok(Math.abs(rows[1].earned - 20) < 1e-10)
  assert.equal(rows[0].fit, 90)
  assert.deepEqual(groups, { MATCHED: 1, CLARIFY: 1, NO_EVIDENCE: 0 })
  assert.deepEqual(input, original)
})

test('sample points are already earned contributions and must not be weighted twice', () => {
  const { rows, groups } = assessmentChartData(
    [
      criterion(40, 40),
      criterion(30, 30),
      criterion(0, 20, 'NO_EVIDENCE'),
      criterion(8, 10, 'CLARIFY'),
    ],
    true,
  )
  assert.equal(
    rows.reduce((sum, row) => sum + row.earned, 0),
    78,
  )
  assert.deepEqual(
    rows.map((row) => row.maximum),
    [40, 30, 20, 10],
  )
  assert.deepEqual(
    rows.map((row) => row.fit),
    [100, 100, 0, 80],
  )
  assert.deepEqual(groups, { MATCHED: 2, CLARIFY: 1, NO_EVIDENCE: 1 })
})

test('zero-weight criteria contribute no points but remain in the evidence count', () => {
  const { rows, groups } = assessmentChartData(
    [criterion(100, 0), criterion(0, 0, 'NO_EVIDENCE')],
    false,
  )
  assert.ok(rows.every((row) => row.earned === 0 && row.maximum === 0))
  assert.deepEqual(groups, { MATCHED: 1, CLARIFY: 0, NO_EVIDENCE: 1 })
  assert.equal(assessmentChartData([criterion(0, 0)], true).rows[0].fit, 0)
})

test('empty assessments do not manufacture a score or evidence', () => {
  assert.deepEqual(assessmentChartData([], false), {
    rows: [],
    groups: { MATCHED: 0, CLARIFY: 0, NO_EVIDENCE: 0 },
  })
})

test('radar groups preserve every criterion and avoid degenerate or overcrowded charts', () => {
  for (const count of [0, 1, 2]) assert.deepEqual(radarGroups(count), [])
  for (let count = 3; count <= 200; count++) {
    const groups = radarGroups(count)
    assert.deepEqual(
      groups.flat(),
      Array.from({ length: count }, (_, index) => index),
    )
    assert.ok(groups.every((group) => group.length >= 3 && group.length <= 8))
  }
})

test('radar has a fixed 0–100 scale and zero values stay at the center', () => {
  for (let axis = 0; axis < 8; axis++) {
    assert.deepEqual(radarPoint(axis, 8, 0), { x: 180, y: 170 })
    const outer = radarPoint(axis, 8, 100)
    assert.ok(Math.abs(Math.hypot(outer.x - 180, outer.y - 170) - 100) < 1e-10)
    const middle = radarPoint(axis, 8, 50)
    assert.ok(Math.abs(Math.hypot(middle.x - 180, middle.y - 170) - 50) < 1e-10)
  }
  assert.deepEqual(radarPoint(0, 4, 100), { x: 180, y: 70 })
  assert.deepEqual(radarPoint(0, 4, -10), radarPoint(0, 4, 0))
  assert.deepEqual(radarPoint(0, 4, 110), radarPoint(0, 4, 100))
})

test('radar labels fit two short lines without changing the full criterion name', () => {
  const name = 'Kinh nghiệm thực tế phát triển hệ thống phân tán và triển khai production'
  const lines = radarLabel(name)
  assert.ok(lines.length <= 2 && lines.every((line) => line.length <= 18))
  assert.ok(lines.at(-1).endsWith('…'))
  assert.deepEqual(radarLabel('React'), ['React'])
})
