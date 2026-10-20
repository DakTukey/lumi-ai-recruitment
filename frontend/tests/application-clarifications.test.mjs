import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const urlFor = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText
const api = urlFor((await compile('../src/services/api.ts')).replace('import.meta.env.VITE_API_BASE_URL', 'undefined'))
const service = await import(urlFor((await compile('../src/services/application-clarification.service.ts')).replace("'./api'", `'${api}'`)))

test('clarification reads never invoke generation; writes carry CSRF, version and explicit action', async () => {
  const previous = globalThis.fetch
  const calls = []
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options })
      return Response.json({ data: url.endsWith('/auth/csrf') ? { headerName: 'X-CSRF-TOKEN', token: 'csrf' } : { state: 'READY', questions: [] } })
    }
    await service.getClarifications('app')
    await service.getClarifications('app', true)
    assert.equal(calls.length, 2)
    assert.equal(calls[0].options.method, 'GET')
    assert.match(calls[1].url, /\/recruiter\/applications\/app\/clarifications$/)
    await service.generateClarifications('app')
    assert.match(calls[3].url, /\/generate$/)
    assert.equal(calls[3].options.headers.get('X-CSRF-TOKEN'), 'csrf')
    await service.saveClarification('app', { id: 'q', version: 4 }, 'ANSWER', '  Example  ')
    assert.deepEqual(JSON.parse(calls[5].options.body), { version: 4, action: 'ANSWER', answer: 'Example' })
    await service.saveClarification('app', { id: 'q', version: 5 }, 'SKIP', 'Must not send this')
    assert.deepEqual(JSON.parse(calls[7].options.body), { version: 5, action: 'SKIP', answer: '' })
  } finally { globalThis.fetch = previous }
})

test('concurrent saves arriving out of order cannot erase a newer saved answer', () => {
  const current = { state: 'READY', questions: [{ id: 'a', version: 2, answer: 'Saved A' }, { id: 'b', version: 0, answer: '' }] }
  const incoming = { state: 'READY', questions: [{ id: 'a', version: 1, answer: 'Old A' }, { id: 'b', version: 1, answer: 'Saved B' }] }
  const merged = service.mergeClarifications(current, incoming)
  assert.deepEqual(merged.questions.map(q => q.answer), ['Saved A', 'Saved B'])
  assert.equal(service.mergeClarifications(null, incoming), incoming)
})
