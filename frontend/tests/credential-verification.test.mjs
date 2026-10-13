import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  }).outputText
}

const dataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const utilSource = await readFile(
  new URL('../src/features/resumes/credential-verification.ts', import.meta.url),
  'utf8',
)
const { analyzeCredentialUrl, CREDENTIAL_PRESETS } = await import(dataUrl(transpile(utilSource)))

test('credential verification handles empty and invalid URLs safely', () => {
  assert.equal(analyzeCredentialUrl(''), null)
  assert.equal(analyzeCredentialUrl(null), null)
  assert.equal(analyzeCredentialUrl('   '), null)

  const invalid = analyzeCredentialUrl('htp://invalid-url-:::')
  assert.ok(invalid)
  assert.equal(invalid.isValidUrl, false)
  assert.equal(invalid.isTrusted, false)
})

test('credential verification recognizes Credly badges as trusted verification', () => {
  const info = analyzeCredentialUrl('https://www.credly.com/badges/abc-123-xyz')
  assert.ok(info)
  assert.equal(info.isTrusted, true)
  assert.equal(info.platformName, 'Credly')
  assert.equal(info.badgeVariant, 'trusted')
  assert.ok(info.helperText.includes('AI có thể tự động đối chiếu'))
})

test('credential verification recognizes Coursera verification links as trusted', () => {
  const info = analyzeCredentialUrl('https://coursera.org/verify/987654321')
  assert.ok(info)
  assert.equal(info.isTrusted, true)
  assert.equal(info.platformName, 'Coursera')
  assert.equal(info.badgeVariant, 'trusted')
})

test('credential verification recognizes HackerRank certificates as trusted', () => {
  const info = analyzeCredentialUrl('https://www.hackerrank.com/certificates/problem-solving-basic')
  assert.ok(info)
  assert.equal(info.isTrusted, true)
  assert.equal(info.platformName, 'HackerRank')
  assert.equal(info.badgeVariant, 'trusted')
})

test('credential verification recognizes Microsoft Learn credentials', () => {
  const info = analyzeCredentialUrl('https://learn.microsoft.com/credentials/cert-123')
  assert.ok(info)
  assert.equal(info.isTrusted, true)
  assert.equal(info.platformName, 'Microsoft Learn')
  assert.equal(info.badgeVariant, 'trusted')
})

test('credential verification recognizes Google Cloud and Accredible', () => {
  const infoAccredible = analyzeCredentialUrl('https://google.accredible.com/000111222')
  assert.ok(infoAccredible)
  assert.equal(infoAccredible.isTrusted, true)
  assert.equal(infoAccredible.platformName, 'Google Cloud / Accredible')

  const infoCredentialNet = analyzeCredentialUrl('https://www.credential.net/sample-badge')
  assert.ok(infoCredentialNet)
  assert.equal(infoCredentialNet.isTrusted, true)
})

test('credential verification recognizes Udemy course certificates', () => {
  const info = analyzeCredentialUrl('https://www.udemy.com/certificate/UC-abc123xyz/')
  assert.ok(info)
  assert.equal(info.isTrusted, true)
  assert.equal(info.platformName, 'Udemy')
  assert.equal(info.badgeVariant, 'course')
})

test('credential verification flags Google Drive as cloud storage with warning/tips', () => {
  const info = analyzeCredentialUrl('https://drive.google.com/file/d/1B2C3D4E5F/view?usp=sharing')
  assert.ok(info)
  assert.equal(info.isTrusted, false)
  assert.equal(info.isCloudStorage, true)
  assert.equal(info.badgeVariant, 'warning')
  assert.ok(info.helperText.includes('Bất kỳ ai có liên kết'))
})

test('credential presets include essential developer platforms', () => {
  const ids = CREDENTIAL_PRESETS.map((p) => p.id)
  assert.ok(ids.includes('credly'))
  assert.ok(ids.includes('coursera'))
  assert.ok(ids.includes('hackerrank'))
  assert.ok(ids.includes('microsoft'))
  assert.ok(ids.includes('google'))
  assert.ok(ids.includes('udemy'))
  assert.ok(ids.includes('drive'))
})
