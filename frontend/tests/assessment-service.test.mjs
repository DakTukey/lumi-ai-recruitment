import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const urlFor = (code) => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
async function compile(path) {
  return ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText
}
const apiUrl = urlFor(
  (await compile('../src/services/api.ts')).replace(
    'import.meta.env.VITE_API_BASE_URL',
    'undefined',
  ),
)
const { getAssessment, triggerAssessment } = await import(
  urlFor((await compile('../src/services/assessment.service.ts')).replace("'./api'", `'${apiUrl}'`))
)

test('assessment distinguishes an absent result from failed or expired requests', async () => {
  const previousFetch = globalThis.fetch
  const previousWindow = globalThis.window
  let expired = 0
  globalThis.window = {
    dispatchEvent: () => {
      expired += 1
    },
  }
  try {
    globalThis.fetch = async () => Response.json({ data: null })
    assert.equal(await getAssessment('app'), null)
    globalThis.fetch = async () => Response.json({ message: 'Server unavailable' }, { status: 503 })
    await assert.rejects(
      getAssessment('app'),
      (e) => e.status === 503 && e.message === 'Server unavailable',
    )
    globalThis.fetch = async () => Response.json({ message: 'Expired' }, { status: 401 })
    await assert.rejects(getAssessment('app'), (e) => e.status === 401)
    assert.equal(expired, 1)
  } finally {
    globalThis.fetch = previousFetch
    globalThis.window = previousWindow
  }
})

test('explicit reanalysis sends force, CSRF and waits beyond the AI service deadline', async () => {
  const previousFetch = globalThis.fetch
  const previousTimeout = AbortSignal.timeout
  const calls = []
  const deadlines = []
  AbortSignal.timeout = (ms) => {
    deadlines.push(ms)
    return previousTimeout(ms)
  }
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options })
      return Response.json(
        url.endsWith('/auth/csrf')
          ? { data: { headerName: 'X-CSRF-TOKEN', token: 'csrf-test' } }
          : { data: { id: 'saved', score: 80 } },
      )
    }
    assert.equal((await triggerAssessment('app', true)).id, 'saved')
    assert.deepEqual(JSON.parse(calls[1].options.body), { force: true })
    assert.equal(calls[1].options.headers.get('X-CSRF-TOKEN'), 'csrf-test')
    assert.equal(calls[1].options.credentials, 'include')
    assert.ok(
      deadlines.some((ms) => ms > 270000),
      'HR reanalysis must outlast the configured AI request deadline',
    )
  } finally {
    globalThis.fetch = previousFetch
    AbortSignal.timeout = previousTimeout
  }
})
