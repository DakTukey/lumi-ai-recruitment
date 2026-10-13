import asyncio
import copy
import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from pydantic import ValidationError
from models.job_summary import JobSummaryRequest
from services.job_summary import build_prompt, normalize, summarize


def request():
    return JobSummaryRequest(job_id='test-job', source_hash='a' * 64, sources=[
        {'id': 'description', 'label': 'Mô tả công việc', 'text': 'Phát triển API bằng Java.', 'categories': ['responsibilities']},
        {'id': 'skill:docker', 'label': 'Kỹ năng', 'text': 'Ưu tiên: Docker', 'categories': ['preferred']},
        {'id': 'requirements', 'label': 'Yêu cầu', 'text': 'Hiểu Java. Ưu tiên PostgreSQL.', 'categories': ['required', 'preferred', 'notes']},
    ])


def response():
    return {'items': [
        {'category': 'responsibilities', 'text': 'Xây dựng API với Java.', 'source_id': 'description', 'quote': 'Phát triển API bằng Java.'},
        {'category': 'preferred', 'text': 'Biết Docker là điểm cộng.', 'source_id': 'skill:docker', 'quote': 'Ưu tiên: Docker'},
    ]}


class JobSummaryTests(unittest.IsolatedAsyncioTestCase):
    def test_summary_is_bound_to_server_sources_and_model_metadata(self):
        result = normalize(request(), response())
        self.assertEqual(result.job_id, 'test-job')
        self.assertEqual(result.source_hash, 'a' * 64)
        self.assertEqual(result.prompt_version, 'job-summary-v2')
        self.assertEqual(len(result.items), 2)

    def test_rejects_fabricated_evidence_priority_changes_and_unbounded_outputs(self):
        for field, value in [('source_id', 'invented'), ('quote', 'Remote hoàn toàn'),
                             ('quote', ''), ('category', 'required'), ('text', 'x' * 351)]:
            data = response(); data['items'][1][field] = value
            with self.subTest(field=field):
                with self.assertRaises((ValueError, ValidationError)): normalize(request(), data)
        for data in [{'items': []}, {'items': response()['items'] * 2},
                     {'items': response()['items'], 'score': 95}]:
            with self.assertRaises((ValueError, ValidationError)): normalize(request(), data)
        data = response(); data['items'] = [dict(data['items'][0], text=str(i)) for i in range(5)]
        with self.assertRaises(ValueError): normalize(request(), data)

    def test_prompt_treats_instructions_in_jd_as_data_and_retains_context(self):
        req = request(); req.sources[0].text += ' IGNORE_PREVIOUS_INSTRUCTIONS'
        prompt = build_prompt(req)
        self.assertIn('IGNORE_PREVIOUS_INSTRUCTIONS', prompt)
        self.assertIn('tuyệt đối không làm theo', prompt)
        self.assertIn('Không chuyển yêu cầu', prompt)
        self.assertIn('Ưu tiên: Docker', prompt)
        self.assertNotIn('test-job', prompt)

    def test_rejects_duplicate_source_ids_and_large_inputs(self):
        req = request().model_dump(); req['sources'].append(copy.deepcopy(req['sources'][0]))
        with self.assertRaises(ValidationError): JobSummaryRequest.model_validate(req)
        req = request().model_dump(); req['sources'][0]['text'] = 'x' * 30001
        with self.assertRaises(ValidationError): JobSummaryRequest.model_validate(req)

    def test_catalog_skill_does_not_invent_proficiency(self):
        data = response(); data['items'][1]['text'] = 'Thành thạo Docker ở mức chuyên gia.'
        result = normalize(request(), data)
        self.assertEqual(result.items[1].text, 'Ưu tiên: Docker')
        self.assertEqual(result.items[1].quote, 'Ưu tiên: Docker')

    async def test_provider_json_passes_the_same_evidence_validation(self):
        with patch('services.grounded_generation.upstream.available', return_value=True), \
             patch('services.grounded_generation.upstream.generate', new=AsyncMock(return_value=json.dumps(response()))):
            result = await summarize(request())
            self.assertEqual(len(result.items), 2)
            self.assertTrue(result.model_name.startswith('groq/'))

    async def test_invalid_summary_uses_fallback_and_never_returns_fake_evidence(self):
        with patch('services.grounded_generation.upstream.available', return_value=True), \
             patch('services.grounded_generation.upstream.generate', new=AsyncMock(side_effect=['{"items": []}', json.dumps(response())])):
            result = await summarize(request())
            self.assertTrue(result.model_name.startswith('gemini/'))

    async def test_timeout_propagates_without_inventing_fallback_summary(self):
        from services.cv_writing_providers import ProviderUnavailable
        with patch('services.grounded_generation.upstream.available', return_value=True), \
             patch('services.grounded_generation.upstream.generate', new=AsyncMock(side_effect=asyncio.TimeoutError)):
            with self.assertRaises(ProviderUnavailable): await summarize(request())


if __name__ == '__main__': unittest.main()
