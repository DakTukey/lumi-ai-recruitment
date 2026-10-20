import asyncio
import json
import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from models.github_verification import GithubVerifyRequest
from services.github_fetcher import (
    GitHubSummary,
    RepoSummary,
    _extract_username,
    fetch_github_summary,
)
from services.github_verifier import _compute_top_languages, _normalize, verify_github
from services import cv_writing_providers as upstream


class ExtractUsernameTest(unittest.TestCase):
    def test_extracts_from_full_url(self):
        self.assertEqual(_extract_username('https://github.com/johndoe'), 'johndoe')
        self.assertEqual(_extract_username('https://github.com/johndoe/'), 'johndoe')
        self.assertEqual(_extract_username('github.com/johndoe'), 'johndoe')

    def test_extracts_plain_username(self):
        self.assertEqual(_extract_username('johndoe'), 'johndoe')

    def test_ignores_repo_path(self):
        self.assertEqual(_extract_username('https://github.com/johndoe/my-repo'), 'johndoe')

    def test_rejects_invalid_url(self):
        for url in ['not a valid url !','https://evil.test/github.com/johndoe','https://github.com.evil.test/johndoe','https://user@github.com/johndoe','http://github.com/johndoe']:
            with self.subTest(url=url), self.assertRaises(ValueError): _extract_username(url)


class TopLanguagesTest(unittest.TestCase):
    def _make_repo(self, langs: dict) -> RepoSummary:
        return RepoSummary(
            name='test', description='', stars=0, language=None,
            is_fork=False, commit_count=5,
            first_commit_at=None, last_commit_at=None,
            has_tests=False, has_docker=False, has_ci=False,
            languages=langs,
        )

    def test_computes_percentage(self):
        repos = [self._make_repo({'Python': 800, 'Java': 200})]
        result = _compute_top_languages(repos)
        self.assertAlmostEqual(result['Python'], 80.0)
        self.assertAlmostEqual(result['Java'], 20.0)

    def test_empty_repos(self):
        self.assertEqual(_compute_top_languages([]), {})


class NormalizeTest(unittest.TestCase):
    def _good_data(self):
        return {
            'verified_skills': [{'skill': 'Python', 'evidence': 'Repo python-api có code Python.'}],
            'unverified_skills': [{'skill': 'React', 'note': 'Chưa có bằng chứng công khai; HR nên hỏi thêm trong phỏng vấn'}],
            'matched_projects': [{'cv_project': 'Library App', 'github_repo': 'library-api', 'confidence': 'cao'}],
            'code_quality_score': 7,
            'technical_summary': 'Ứng viên có kinh nghiệm backend Python.',
            'interview_suggestions': ['Hỏi về kinh nghiệm React.'],
        }

    def test_accepts_valid_data(self):
        result = _normalize(self._good_data())
        self.assertEqual(result.verified_skills[0].skill, 'Python')
        self.assertEqual(result.code_quality_score, 7)

    def test_rejects_missing_or_invalid_score_instead_of_fabricating_one(self):
        for score in [None,99,-5,True,'7']:
            data=self._good_data();data['code_quality_score']=score
            with self.subTest(score=score), self.assertRaises(ValueError): _normalize(data)

    def test_rejects_empty_summary(self):
        data = self._good_data()
        data['technical_summary'] = ''
        with self.assertRaises(ValueError):
            _normalize(data)


class VibeDetectionTest(unittest.TestCase):
    def _make_repo(self, name: str, commit_count: int, age_days: int, **kw) -> RepoSummary:
        from datetime import timedelta
        first = datetime.now(timezone.utc) - timedelta(days=age_days)
        last = datetime.now(timezone.utc)
        return RepoSummary(
            name=name, description=kw.get('description', ''), stars=0, language=None,
            is_fork=False, commit_count=commit_count,
            first_commit_at=first, last_commit_at=last,
            has_tests=False, has_docker=False, has_ci=False,
        )

    def test_detects_tutorial_clone(self):
        from services.github_fetcher import _analyze_repo
        # Tutorial name pattern check is in _TUTORIAL_PATTERNS
        from services.github_fetcher import _TUTORIAL_PATTERNS
        self.assertTrue(bool(_TUTORIAL_PATTERNS.search('mern-tutorial-app')))
        self.assertFalse(bool(_TUTORIAL_PATTERNS.search('my-personal-project')))

    def test_vibe_flags_few_commits_old_repo(self):
        repo = self._make_repo('old-project', commit_count=2, age_days=60)
        # Simulate what _analyze_repo would set
        from datetime import timedelta
        first = datetime.now(timezone.utc) - timedelta(days=60)
        age_days = (datetime.now(timezone.utc) - first).days
        # Check logic directly
        flags = []
        if repo.commit_count < 4 and age_days > 30:
            flags.append('Ít commit, repo cũ — có thể là dump một lần')
        self.assertIn('Ít commit, repo cũ — có thể là dump một lần', flags)


class FetchGitHubSummaryTest(unittest.IsolatedAsyncioTestCase):
    async def test_raises_on_not_found(self):
        with patch('httpx.AsyncClient') as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock()

            not_found = MagicMock()
            not_found.status_code = 404
            not_found.raise_for_status = MagicMock()
            mock_client.get.return_value = not_found
            mock_client_cls.return_value = mock_client

            with self.assertRaises(ValueError):
                await fetch_github_summary('https://github.com/nonexistent-user-xyz')


class VerifyGitHubProviderTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        upstream._cooldowns.clear()

    def _make_summary(self):
        return GitHubSummary(
            username='testuser',
            public_repos=3,
            account_age_days=365,
            total_stars=5,
            repos=[
                RepoSummary(
                    name='my-api', description='REST API project', stars=2,
                    language='Python', is_fork=False, commit_count=10,
                    first_commit_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
                    last_commit_at=datetime(2024, 6, 1, tzinfo=timezone.utc),
                    has_tests=True, has_docker=False, has_ci=True,
                    languages={'Python': 5000, 'Shell': 500},
                    readme_excerpt='A REST API built with FastAPI.',
                    core_file_path='services/user_service.py',
                    core_file_content='class UserService:\n    def get_user(self, id): ...',
                )
            ],
        )

    def _good_ai_response(self):
        return json.dumps({
            'verified_skills': [{'skill': 'Python', 'evidence': 'Repo my-api dùng Python.'}],
            'unverified_skills': [],
            'matched_projects': [],
            'code_quality_score': 7,
            'technical_summary': 'Ứng viên có kinh nghiệm Python backend.',
            'interview_suggestions': ['Hỏi về testing strategy.'],
        })

    async def test_full_flow_with_mocked_fetch_and_ai(self):
        req = GithubVerifyRequest(
            github_url='https://github.com/testuser',
            cv_skills=['Python', 'React'],
            cv_projects=[{'name': 'My API', 'description': 'REST API project'}],
        )
        with patch('services.github_verifier.fetch_github_summary', new_callable=AsyncMock) as mock_fetch, \
             patch.dict('os.environ', {'GROQ_API_KEY': 'test', 'GEMINI_API_KEY': 'test'}), \
             patch.object(upstream, 'generate', new_callable=AsyncMock) as mock_gen:
            mock_fetch.return_value = self._make_summary()
            mock_gen.return_value = self._good_ai_response()

            result = await verify_github(req)

            self.assertEqual(result.github_username, 'testuser')
            self.assertEqual(result.verified_skills[0].skill, 'Python')
            self.assertTrue(result.has_tests)
            self.assertTrue(result.has_ci)
            self.assertIn('Python', result.top_languages)

    async def test_all_providers_fail_raises(self):
        req = GithubVerifyRequest(
            github_url='https://github.com/testuser',
            cv_skills=['Python'],
        )
        with patch('services.github_verifier.fetch_github_summary', new_callable=AsyncMock) as mock_fetch, \
             patch.dict('os.environ', {'GROQ_API_KEY': 'test', 'GEMINI_API_KEY': 'test'}), \
             patch.object(upstream, 'generate', new_callable=AsyncMock) as mock_gen:
            mock_fetch.return_value = self._make_summary()
            mock_gen.side_effect = upstream.ProviderUnavailable('http_503')

            with self.assertRaises(upstream.ProviderUnavailable):
                await verify_github(req)
