import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const code=ts.transpileModule(await readFile(new URL('../src/features/resumes/pdf-import-model.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText
const {importedDraft}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
test('PDF import starts a new draft linked to original and retains unknown sections',()=>{
 const document={id:'original',parsed:{fullName:'Synthetic',extraSections:[{title:'Research',content:'Paper 2023'}],warnings:['Review'],extractedText:'raw'}}
 const before=structuredClone(document)
 const draft=importedDraft(document)
 assert.equal(draft.sourceDocumentId,'original');assert.equal(draft.version,null);assert.equal(draft.status,'DRAFT')
 assert.equal(draft.email,'');assert.deepEqual(draft.experiences,[])
 assert.deepEqual(draft.extraSections,document.parsed.extraSections)
 assert.equal('warnings' in draft,false);assert.equal('extractedText' in draft,false)
 assert.deepEqual(document,before)
 assert.throws(()=>importedDraft({id:'unparsed',parsed:null}))
})
