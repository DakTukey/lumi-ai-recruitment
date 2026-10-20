import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const urlFor = (code) => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const compile = async (path) =>
  ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText

const api = urlFor(
  (await compile('../src/services/api.ts')).replace(
    'import.meta.env.VITE_API_BASE_URL',
    'undefined',
  ),
)
const service = await import(
  urlFor(
    (await compile('../src/services/github-verification.service.ts')).replace("'./api'", `'${api}'`),
  )
)

test('github verification service calls correct endpoints with proper CSRF and payload', async () => {
  const previous = globalThis.fetch
  const calls = []
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options })
      if (url.endsWith('/auth/csrf')) {
        return Response.json({ data: { headerName: 'X-CSRF-TOKEN', token: 'test-csrf-token' } })
      }
      return Response.json({
        data: {
          applicationId: 'app-123',
          githubUsername: 'octocat',
          verifiedSkills: [{ skill: 'Python', evidence: 'Repo uses Python' }],
          unverifiedSkills: [],
          matchedProjects: [],
          codeQualityScore: 8,
          technicalSummary: 'Good quality code',
          interviewSuggestions: [],
          vibeCodingFlags: [],
          hasTests: true,
          hasDocker: true,
          hasCi: false,
          topLanguages: { Python: 85.0 },
          modelName: 'groq/llama-3.3-70b-versatile',
          fetchedAt: '2026-10-20T00:00:00Z',
        },
      })
    }

    const fetched = await service.getGithubVerification('app-123')
    assert.equal(fetched.githubUsername, 'octocat')
    assert.equal(fetched.codeQualityScore, 8)
    assert.match(calls[0].url, /\/recruiter\/applications\/app-123\/github-verification$/)
    assert.equal(calls[0].options.method, 'GET')

    const triggered = await service.triggerGithubVerification('app-123', true)
    assert.equal(triggered.githubUsername, 'octocat')
    // Check CSRF call + POST call
    const postCall = calls.find((c) => c.options?.method === 'POST')
    assert.ok(postCall)
    assert.match(postCall.url, /\/recruiter\/applications\/app-123\/github-verification$/)
    assert.deepEqual(JSON.parse(postCall.options.body), { force: true })
    assert.equal(postCall.options.headers.get('X-CSRF-TOKEN'), 'test-csrf-token')
  } finally {
    globalThis.fetch = previous
  }
})

