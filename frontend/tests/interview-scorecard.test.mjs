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
    (await compile('../src/services/interview-scorecard.service.ts')).replace(
      "'./api'",
      `'${api}'`,
    ),
  )
)

test('interview scorecard service supports get, generate and save with proper CSRF headers', async () => {
  const previous = globalThis.fetch
  const calls = []
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options })
      if (url.endsWith('/auth/csrf')) {
        return Response.json({ data: { headerName: 'X-CSRF-TOKEN', token: 'scorecard-csrf' } })
      }
      return Response.json({
        data: {
          applicationId: 'app-999',
          version: 3,
          interviewerName: 'HR Manager',
          status: 'DRAFT',
          overallScore: 4.5,
          recommendation: 'STRONG_HIRE',
          overallNotes: 'Good candidate',
          sections: [
            {
              title: 'Chuyên môn',
              questions: [
                {
                  id: 'q1',
                  question: 'Spring Boot transaction?',
                  target_skill: 'Spring Boot',
                  context: 'Core skill',
                  rubric_good: 'Knows @Transactional',
                  rubric_poor: 'Does not know rollback',
                  score: 5,
                  notes: 'Answered well',
                },
              ],
            },
          ],
        },
      })
    }

    const fetched = await service.getInterviewScorecard('app-999')
    assert.equal(fetched.applicationId, 'app-999')
    assert.equal(fetched.overallScore, 4.5)
    assert.match(calls[0].url, /\/recruiter\/applications\/app-999\/scorecard$/)
    assert.equal(calls[0].options.method, 'GET')

    const generated = await service.generateInterviewScorecard('app-999', true)
    assert.equal(generated.status, 'DRAFT')
    const postCall = calls.find((c) => c.options?.method === 'POST')
    assert.ok(postCall)
    assert.match(postCall.url, /\/recruiter\/applications\/app-999\/scorecard\/generate$/)
    assert.deepEqual(JSON.parse(postCall.options.body), { force: true })
    assert.equal(postCall.options.headers.get('X-CSRF-TOKEN'), 'scorecard-csrf')

    const saved = await service.saveInterviewScorecard('app-999', {
      version: 3,
      status: 'COMPLETED',
      recommendation: 'STRONG_HIRE',
      overallNotes: 'Excellent performance',
      sections: [],
    })
    assert.equal(saved.status, 'DRAFT') // mock returns draft
    const putCall = calls.find((c) => c.options?.method === 'PUT')
    assert.ok(putCall)
    assert.match(putCall.url, /\/recruiter\/applications\/app-999\/scorecard$/)
    assert.equal(putCall.options.headers.get('X-CSRF-TOKEN'), 'scorecard-csrf')
    assert.deepEqual(JSON.parse(putCall.options.body).status, 'COMPLETED')
    assert.equal(JSON.parse(putCall.options.body).version, 3)
  } finally {
    globalThis.fetch = previous
  }
})

const model = await import(
  urlFor(await compile('../src/features/applications/interview-scorecard-model.ts'))
)
test('only the interview stage allows scorecard mutations; other stages explain screening or read-only access', () => {
  assert.equal(model.canWorkOnInterviewScorecard('INTERVIEW'), true)
  for (const stage of ['SUBMITTED', 'REVIEWING', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN']) {
    assert.equal(model.canWorkOnInterviewScorecard(stage), false)
    assert.ok(model.scorecardStageMessage(stage).length > 0)
  }
  assert.match(model.scorecardStageMessage('SUBMITTED'), /HR.*chuyển hồ sơ.*Phỏng vấn/)
  assert.match(model.scorecardStageMessage('REVIEWING'), /Điểm AI không tự chuyển vòng/)
  assert.match(model.scorecardStageMessage('OFFER'), /xem lại/)
  assert.match(model.scorecardStageMessage('REJECTED'), /không tạo mới hoặc chỉnh sửa/)
})
test('rated, noted and completed cards cannot regenerate; completion needs all scores and a recommendation', () => {
  const base = {
    status: 'DRAFT',
    overallScore: null,
    recommendation: null,
    overallNotes: '',
    sections: [
      {
        title: 'Test',
        questions: [
          { score: null, notes: '' },
          { score: null, notes: '' },
        ],
      },
    ],
  }
  assert.equal(model.canRegenerateScorecard(base), true)
  assert.equal(model.canCompleteScorecard(base), false)
  for (const change of [
    { status: 'COMPLETED' },
    { recommendation: 'HIRE' },
    { overallNotes: 'Keep notes' },
    { overallScore: 4 },
    { sections: [{ questions: [{ score: 4, notes: '' }] }] },
    { sections: [{ questions: [{ score: null, notes: 'Keep notes' }] }] },
  ])
    assert.equal(model.canRegenerateScorecard({ ...base, ...change }), false)
  const ready = {
    ...base,
    recommendation: 'HIRE',
    sections: [{ questions: [{ score: 4 }, { score: 5 }] }],
  }
  assert.equal(model.canCompleteScorecard(ready), true)
  assert.equal(model.canCompleteScorecard({ ...ready, status: 'COMPLETED' }), false)
})
