import json
import unittest
from unittest.mock import AsyncMock, patch

from models.interview_scorecard import ScorecardGenerateRequest
from services.interview_scorecard import _build_prompt, _normalize, generate_scorecard
from services import cv_writing_providers as upstream


class ScorecardNormalizeTest(unittest.TestCase):
    def _sample_data(self):
        return {
            'sections': [
                {
                    'title': 'Chuyên môn & Kỹ thuật cốt lõi',
                    'questions': [
                        {
                            'id': 'tech_1',
                            'question': 'Cách bạn xử lý transaction trong Spring Boot?',
                            'target_skill': 'Java Spring Boot',
                            'context': 'CV ghi biết Spring Boot',
                            'rubric_good': 'Nêu được @Transactional và rollback',
                            'rubric_poor': 'Không giải thích được cơ chế rollback',
                        }
                    ],
                }
            ]
        }

    def test_normalize_valid(self):
        result = _normalize(self._sample_data())
        self.assertEqual(len(result.sections), 1)
        self.assertEqual(result.sections[0].title, 'Chuyên môn & Kỹ thuật cốt lõi')
        self.assertEqual(result.sections[0].questions[0].target_skill, 'Java Spring Boot')

    def test_normalize_rejects_empty(self):
        with self.assertRaises(ValueError):
            _normalize({'sections': []})

    def test_prompt_building(self):
        req = ScorecardGenerateRequest(
            job_title='Backend Developer',
            job_requirements='Yêu cầu Java, Spring Boot, Docker',
            candidate_name='Nguyen Van A',
            cv_summary='Kỹ sư backend 1 năm kinh nghiệm',
            cv_skills=['Java', 'Spring Boot'],
            assessment_missing_skills=['Docker'],
            github_unverified_skills=['Docker'],
            github_vibe_flags=['Chỉ có 1 commit duy nhất'],
        )
        prompt = _build_prompt(req)
        self.assertIn('Backend Developer', prompt)
        self.assertIn('Docker', prompt)
        self.assertIn('Chỉ có 1 commit duy nhất', prompt)


class ScorecardProviderTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        upstream._cooldowns.clear()

    async def test_full_generation_with_mocked_ai(self):
        req = ScorecardGenerateRequest(
            job_title='Backend Developer',
            cv_skills=['Java'],
        )
        sample_response = json.dumps({
            'sections': [
                {
                    'title': 'Chuyên môn kỹ thuật',
                    'questions': [
                        {
                            'id': 'q1',
                            'question': 'Bạn cấu hình Spring Security như thế nào?',
                            'target_skill': 'Spring Security',
                            'context': 'Đánh giá bảo mật',
                            'rubric_good': 'Nắm rõ filter chain và JWT',
                            'rubric_poor': 'Chưa làm qua filter chain',
                        }
                    ],
                }
            ]
        })
        with patch.dict('os.environ', {'GROQ_API_KEY': 'test', 'GEMINI_API_KEY': 'test'}), \
             patch.object(upstream, 'generate', new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = sample_response
            res = await generate_scorecard(req)
            self.assertEqual(len(res.sections), 1)
            self.assertEqual(res.sections[0].questions[0].id, 'q1')

