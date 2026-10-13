import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const code=ts.transpileModule(await readFile(new URL('../src/features/jobs/candidate-benchmark-model.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText
const {benchmarkPriorities,benchmarkNumber}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
test('prioritize mandatory missing evidence before gaps; exclude zero-weight and already adequate criteria',()=>{
 const rows=[{name:'Nice to have',weight:1,required:false,action:'STRENGTHEN',priority:40},{name:'Mandatory evidence',weight:2,required:true,action:'CLARIFY',priority:5},{name:'Already strong',weight:2,required:true,action:'MAINTAIN',priority:0},{name:'No weight',weight:0,required:true,action:'CLARIFY',priority:90},{name:'Small gap',weight:1,required:false,action:'STRENGTHEN',priority:10}]
 const original=structuredClone(rows)
 assert.deepEqual(benchmarkPriorities(rows).map(c=>c.name),['Mandatory evidence','Nice to have','Small gap'])
 assert.deepEqual(rows,original)
 assert.equal(benchmarkNumber(null),'—');assert.equal(benchmarkNumber(0),'0')
})
