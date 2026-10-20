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
const api = urlFor(
  (await compile('../src/services/api.ts')).replace(
    'import.meta.env.VITE_API_BASE_URL',
    'undefined',
  ),
)
const model = urlFor(await compile('../src/features/jobs/recruiter-model.ts'))
const { validateDraft, jobWorkLocation } = await import(model)
const { parseJobDraft, generateJobDraft } = await import(
  urlFor(
    (await compile('../src/services/recruiter-job.service.ts'))
      .replace("'./api'", `'${api}'`)
      .replace("'../features/jobs/recruiter-model'", `'${model}'`),
  )
)

test('JD import waits for local processing and keeps missing facts empty for HR review', async () => {
  const originalFetch = globalThis.fetch
  const originalTimeout = AbortSignal.timeout
  const durations = []
  const calls = []
  try {
    AbortSignal.timeout = (ms) => {
      durations.push(ms)
      return originalTimeout(ms)
    }
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options })
      return Response.json(
        url.endsWith('/auth/csrf')
          ? { data: { headerName: 'X-CSRF-TOKEN', token: 'csrf' } }
          : { data: { title: 'Java developer', criteria: [{ description: 'Java', weight: 0 }] } },
      )
    }
    const draft = await parseJobDraft({ text: 'Java developer' })
    assert.equal(calls[1].url, '/api/recruiter/jobs/ai-parse-jd')
    assert.equal(calls[1].options.body.get('text'), 'Java developer')
    assert.equal(calls[1].options.headers.get('X-CSRF-TOKEN'), 'csrf')
    assert.ok(durations.includes(285000))
    for (const field of [
      'location',
      'headcount',
      'level',
      'mode',
      'employmentType',
      'departmentId',
    ]) {
      assert.equal(draft[field], '', field)
    }
    assert.equal(draft.criteria[0].weight, 0)
    assert.equal(jobWorkLocation(draft.mode), '')
    for (const field of ['level', 'mode', 'employmentType']) assert.ok(validateDraft(draft)[field])
  } finally {
    globalThis.fetch = originalFetch
    AbortSignal.timeout = originalTimeout
  }
})

test('JD generation retains its existing defaults and request path', async () => {
  const previous = globalThis.fetch
  try {
    globalThis.fetch = async (url) =>
      Response.json(
        url.endsWith('/auth/csrf')
          ? { data: { headerName: 'X-CSRF-TOKEN', token: 'csrf' } }
          : { data: { title: 'Generated JD' } },
      )
    const draft = await generateJobDraft({ title: 'Generated JD' })
    assert.equal(draft.level, 'Middle')
    assert.equal(draft.mode, 'Hybrid')
    assert.equal(draft.headcount, '1')
  } finally {
    globalThis.fetch = previous
  }
})
