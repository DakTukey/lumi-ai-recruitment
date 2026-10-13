import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = (
  await readFile(new URL('../src/features/resumes/cv-preview-theme.ts', import.meta.url), 'utf8')
).replace("'react'", `'${import.meta.resolve('react')}'`)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
})
const url = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`

test('preview theme defaults to light, remembers dark and notifies other previews', async () => {
  const store = new Map()
  const target = new EventTarget()
  target.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  }
  const previous = globalThis.window
  globalThis.window = target
  try {
    const { getCvPreviewTheme, setCvPreviewTheme } = await import(`${url}#persist`)
    let changes = 0
    target.addEventListener('lumi-cv-preview-theme-changed', () => changes++)
    assert.equal(getCvPreviewTheme(), 'light')
    setCvPreviewTheme('dark')
    assert.equal(store.get('lumi.cv-preview-theme'), 'dark')
    assert.equal(getCvPreviewTheme(), 'dark')
    const reloaded = await import(`${url}#reloaded`)
    assert.equal(reloaded.getCvPreviewTheme(), 'dark')
    setCvPreviewTheme('light')
    assert.equal(getCvPreviewTheme(), 'light')
    assert.equal(changes, 2)
    store.set('lumi.cv-preview-theme', 'invalid')
    assert.equal(getCvPreviewTheme(), 'light')
  } finally {
    if (previous === undefined) delete globalThis.window
    else globalThis.window = previous
  }
})

test('preview theme keeps working when browser storage is unavailable', async () => {
  const target = new EventTarget()
  target.localStorage = {
    getItem: () => {
      throw new Error('Blocked')
    },
    setItem: () => {
      throw new Error('Blocked')
    },
  }
  const previous = globalThis.window
  globalThis.window = target
  try {
    const { getCvPreviewTheme, setCvPreviewTheme } = await import(`${url}#blocked`)
    assert.equal(getCvPreviewTheme(), 'light')
    setCvPreviewTheme('dark')
    assert.equal(getCvPreviewTheme(), 'dark')
    setCvPreviewTheme('light')
    assert.equal(getCvPreviewTheme(), 'light')
  } finally {
    if (previous === undefined) delete globalThis.window
    else globalThis.window = previous
  }
})
