import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const urlFor = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
async function compile(path) {
  return ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText
}
const apiUrl = urlFor((await compile('../src/services/api.ts')).replace('import.meta.env.VITE_API_BASE_URL', 'undefined'))
const { getRecruiterProfile, saveRecruiterProfile, profileDraft, validateProfile } = await import(
  urlFor((await compile('../src/services/recruiter-profile.service.ts')).replace("'./api'", `'${apiUrl}'`))
)

test('profile submission uses session identity, CSRF and an explicit version; empty fields clear stored values', async () => {
  const previous = globalThis.fetch
  const calls = []
  const draft = { ...profileDraft({ phone: null, employeeCode: ' HR-01 ', jobTitle: ' Recruiter ', departmentId: null, avatarUrl: null }), userId: 'other', role: 'COMPANY_ADMIN', email: 'other@example.test' }
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options })
      return Response.json(url.endsWith('/auth/csrf')
        ? { data: { headerName: 'X-CSRF-TOKEN', token: 'test-csrf' } }
        : { data: { version: 8, userId: 'self' } })
    }
    assert.equal((await saveRecruiterProfile(draft, 7)).version, 8)
    assert.equal(calls[1].url, '/api/recruiter/profile')
    assert.equal(calls[1].options.method, 'PUT')
    assert.equal(calls[1].options.credentials, 'include')
    assert.equal(calls[1].options.headers.get('X-CSRF-TOKEN'), 'test-csrf')
    assert.deepEqual(JSON.parse(calls[1].options.body), {
      version: 7, phone: null, employeeCode: 'HR-01', jobTitle: 'Recruiter', departmentId: null, avatarUrl: null,
    })
  } finally { globalThis.fetch = previous }
})

test('failed loads, stale updates and validation errors remain errors rather than sample success', async () => {
  const previous = globalThis.fetch
  try {
    globalThis.fetch = async () => Response.json({ message: 'Unavailable' }, { status: 503 })
    await assert.rejects(getRecruiterProfile(), e => e.status === 503)
    globalThis.fetch = async url => Response.json(url.endsWith('/auth/csrf')
      ? { data: { headerName: 'X-CSRF-TOKEN', token: 'csrf' } }
      : { message: 'Stale profile' }, { status: url.endsWith('/auth/csrf') ? 200 : 409 })
    await assert.rejects(saveRecruiterProfile(profileDraft({}), 1), e => e.status === 409 && e.message === 'Stale profile')
  } finally { globalThis.fetch = previous }
  const valid = profileDraft({ phone: '+84 900 123 456', avatarUrl: 'https://example.test/avatar.png' })
  assert.equal(validateProfile(valid), '')
  for (const phone of ['123', '1234567890123456', 'abc1234567']) assert.ok(validateProfile({ ...valid, phone }))
  for (const avatarUrl of ['javascript:alert(1)', 'ftp://example.test/a', 'https://user:pass@example.test/a']) assert.ok(validateProfile({ ...valid, avatarUrl }))
})
