import asyncio
import copy
import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from pydantic import ValidationError
from models.schemas import AssessRequest
from services.prompt_builder import assessment_targets, build_assessment_prompt
from services.gemini_service import assess, normalize_result, _parse_json, evidence_options


def request():
    return AssessRequest.model_validate({
        'application_id': 'test-application',
        'job': {'title': 'Backend', 'description': 'API', 'requirements': 'Java',
                'benefits': '', 'location': 'Da Nang', 'employmentType': 'FULL_TIME',
                'workMode': 'HYBRID', 'experienceLevel': 'JUNIOR',
                'skills': [{'id': 'java', 'name': 'Java', 'required': True},
                           {'id': 'docker', 'name': 'Docker', 'required': False}],
                'criteria': [{'id': 'education', 'type': 'EDUCATION',
                              'description': 'Bachelor IT', 'weight': 25.5, 'required': True}]},
        'resume': {'fullName': 'Test Candidate', 'desiredPosition': 'Backend',
                   'githubUrl': 'https://example.test/github', 'portfolioUrl': 'https://example.test/portfolio',
                   'skills': ['Java'], 'experiences': [{'position': 'Engineer', 'description': 'x' * 400 + 'TAIL_EVIDENCE'}],
                   'projects': [{'name': 'PROJECT_EVIDENCE', 'description': 'y' * 400 + 'PROJECT_TAIL'}],
                   'educations': [{'school': 'EDUCATION_EVIDENCE'}],
                   'certifications': [{'name': 'CERT_EVIDENCE'}],
                   'languages': [{'name': 'LANGUAGE_EVIDENCE', 'proficiency': 'B2'}],
                   'awards': [{'title': 'AWARD_EVIDENCE'}], 'activities': [{'name': 'ACTIVITY_EVIDENCE'}]}})


def response(req):
    criteria = []
    for t in assessment_targets(req.job):
        criteria.append({**{k: t[k] for k in ['criterion_key', 'skill', 'weight']},
                         'match_level': 'PARTIAL', 'evidence': 'Java', 'reason': 'Cần làm rõ', 'points': 80})
    return {'summary': 'Phù hợp một phần', 'score': 999, 'criteria': criteria,
            'gaps': [], 'interview_questions': []}


class AssessmentTests(unittest.IsolatedAsyncioTestCase):
    def test_real_snapshot_camel_case_contract(self):
        req = request()
        self.assertEqual(req.job.employment_type, 'FULL_TIME')
        self.assertEqual(req.resume.full_name, 'Test Candidate')
        self.assertEqual(req.resume.desired_position, 'Backend')
        self.assertEqual(req.resume.github_url, 'https://example.test/github')
        self.assertEqual(req.resume.portfolio_url, 'https://example.test/portfolio')

    def test_prompt_retains_all_sections_and_full_descriptions(self):
        req = request()
        prompt = build_assessment_prompt(req.job, req.resume)
        for token in ['TAIL_EVIDENCE', 'PROJECT_TAIL', 'EDUCATION_EVIDENCE', 'CERT_EVIDENCE',
                      'LANGUAGE_EVIDENCE', 'AWARD_EVIDENCE', 'ACTIVITY_EVIDENCE', 'https://example.test/github']:
            self.assertIn(token, prompt)
        self.assertNotIn('Test Candidate', prompt)

    def test_score_computed_from_jd_weights_not_model_score(self):
        req = request(); data = response(req)
        data['criteria'][1].update(match_level='NO_EVIDENCE', evidence='', points=0)
        result = normalize_result(req, data)
        self.assertEqual(result.score, 77)  # (80*2 + 0*1 + 80*25.5) / 28.5
        self.assertEqual(result.criteria[2].weight, 25.5)
        self.assertIn('Docker', result.missing_skills)

    def test_more_than_eight_required_skills_are_all_evaluated(self):
        req = request()
        req.job.skills = [req.job.skills[0].model_copy(update={'id': str(i), 'name': 'Skill ' + str(i)}) for i in range(12)]
        self.assertEqual(len(normalize_result(req, response(req)).criteria), 13)

    def test_invalid_coverage_weights_and_scores_rejected(self):
        req = request(); base = response(req)
        invalid = []
        x = copy.deepcopy(base); x['criteria'].pop(); invalid.append(x)
        x = copy.deepcopy(base); x['criteria'][1] = x['criteria'][0]; invalid.append(x)
        for field, value in [('points', 101), ('points', -1), ('points', 5.5), ('weight', 9),
                             ('match_level', 'VERIFIED'), ('evidence', ''), ('criterion_key', 'invented')]:
            x = copy.deepcopy(base); x['criteria'][0][field] = value; invalid.append(x)
        x = copy.deepcopy(base); x['criteria'][0]['match_level'] = 'NO_EVIDENCE'; invalid.append(x)
        for data in invalid:
            with self.subTest(data=data):
                with self.assertRaises((ValueError, ValidationError)):
                    normalize_result(req, data)

    def test_json_parse_does_not_expose_model_output(self):
        self.assertEqual(_parse_json('```json\n{"criteria": []}\n```'), {'criteria': []})
        with self.assertRaises(ValueError) as ctx: _parse_json('PRIVATE_CV_CONTENT')
        self.assertNotIn('PRIVATE_CV_CONTENT', str(ctx.exception))
        with self.assertRaises(ValueError): _parse_json('[]')

    async def test_async_provider_result_uses_same_validator(self):
        req = request()
        with patch('services.grounded_generation.upstream.available', return_value=True), \
             patch('services.grounded_generation.upstream.generate', new=AsyncMock(return_value=json.dumps(response(req)))) as generate:
            result = await assess(req)
            self.assertEqual(result.score, 80)
            self.assertTrue(result.model_name.startswith('groq/'))
            self.assertIn('CV_DATA', generate.call_args.args[1])

    async def test_provider_timeout_is_bounded_and_falls_back(self):
        req = request()
        with patch('services.grounded_generation.upstream.available', return_value=True), \
             patch('services.grounded_generation.upstream.generate', new=AsyncMock(side_effect=[asyncio.TimeoutError(), json.dumps(response(req))])) as generate:
            result = await assess(req)
            self.assertTrue(result.model_name.startswith('gemini/'))
            self.assertEqual(generate.await_count, 2)

    def test_rejects_fabricated_or_combined_cv_quotes(self):
        for quote in ['Invented evidence', 'Java TAIL_EVIDENCE']:
            req = request(); data = response(req); data['criteria'][0]['evidence'] = quote
            with self.assertRaises(ValueError): normalize_result(req, data)
        req = request(); data = response(req)
        data['criteria'][0].update(match_level='NO_EVIDENCE', points=0)
        with self.assertRaises(ValueError): normalize_result(req, data)

    async def test_invalid_primary_response_uses_validated_fallback(self):
        req = request(); bad = response(req); bad['criteria'][0]['evidence'] = 'INVENTED'
        with patch('services.grounded_generation.upstream.available', return_value=True), \
             patch('services.grounded_generation.upstream.generate', new=AsyncMock(side_effect=[json.dumps(bad), json.dumps(response(req))])):
            result = await assess(req)
            self.assertTrue(result.model_name.startswith('gemini/'))

    async def test_no_provider_success_returns_error_not_fake_score(self):
        from services.cv_writing_providers import ProviderUnavailable
        with patch('services.grounded_generation.upstream.available', return_value=True), \
             patch('services.grounded_generation.upstream.generate', new=AsyncMock(side_effect=ProviderUnavailable('http_429'))) as generate:
            with self.assertRaises(ProviderUnavailable): await assess(request())
            self.assertEqual(generate.await_count, 2)

    async def test_provider_schema_constrains_quotes_and_gap_targets(self):
        req = request()
        with patch('services.grounded_generation.upstream.available', return_value=True), \
             patch('services.grounded_generation.upstream.generate', new=AsyncMock(return_value=json.dumps(response(req)))) as generate:
            await assess(req)
            schema = generate.call_args.args[2]
            quotes = schema['properties']['criteria']['items']['properties']['evidence']['enum']
            self.assertIn('Java', quotes)
            self.assertIn('EDUCATION_EVIDENCE', quotes)
            self.assertNotIn('Test Candidate', quotes)
            self.assertEqual(schema['properties']['gaps']['items']['properties']['skill']['enum'], ['Java', 'Docker', 'Bachelor IT'])
            self.assertFalse(schema['additionalProperties'])

    def test_quote_choices_are_exact_even_with_newlines_and_long_text(self):
        req = request()
        original = 'First exact line\nSecond exact line' + 'x' * 1600
        req.resume.projects = [{'description': original}]
        for quote in evidence_options(req.resume):
            self.assertTrue(not quote or any(quote in text for text in __import__('services.gemini_service', fromlist=['resume_texts']).resume_texts(req.resume)))

    async def test_refusal_does_not_trigger_fallback(self):
        from services.cv_writing_providers import ProviderRefused
        with patch('services.grounded_generation.upstream.available', return_value=True), \
             patch('services.grounded_generation.upstream.generate', new=AsyncMock(side_effect=ProviderRefused('refused'))) as generate:
            with self.assertRaises(ProviderRefused): await assess(request())
            self.assertEqual(generate.await_count, 1)


if __name__ == '__main__': unittest.main()
