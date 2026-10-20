import unittest
from models.cv_parser import ParsedCvResult
from services.cv_parser import checked_result


class CvSourcesTests(unittest.TestCase):
    def test_empty_model_warnings_are_removed_before_storage(self):
        parsed = ParsedCvResult(fullName='Candidate', warnings=['', ' ', '\u200b', '- • —', ' Check dates ', 'Check dates'])
        result = checked_result(parsed, '--- TRANG 1 ---\nCandidate', 1, False)
        self.assertEqual(result.warnings[0], 'Check dates')
        self.assertEqual(len(result.warnings), 2)

    def test_exact_fields_get_actual_page_and_original_name(self):
        parsed = ParsedCvResult(fullName='Nguyễn Văn An', experiences=[{'company': 'ABC', 'description': 'Build API'}])
        result = checked_result(parsed, '--- TRANG 1 ---\nNGUYEN VAN AN\n--- TRANG 2 ---\nABC\nBuild API', 2, False)
        sources = {s.path: s for s in result.sources}
        self.assertEqual(result.fullName, 'NGUYEN VAN AN')
        self.assertEqual(sources['fullName'].page, 1)
        self.assertEqual(sources['experiences.0.company'].page, 2)
        self.assertTrue(sources['experiences.0.description'].verified)

    def test_scan_quote_not_verified_just_because_model_claims_it(self):
        parsed = ParsedCvResult(fullName='Candidate', sources=[{'path': 'fullName', 'quote': 'Candidate', 'page': 1, 'verified': True}])
        result = checked_result(parsed, '--- TRANG 1 ---\n', 1, True)
        self.assertFalse(result.sources[0].verified)

    def test_unrelated_paths_and_wrong_pages_are_discarded(self):
        parsed = ParsedCvResult(experiences=[{'description':'Parsed value'}], sources=[
            {'path': 'experiences.0.description', 'quote': 'Source sentence', 'page': 2, 'verified': True},
            {'path': 'secret', 'quote': 'Other', 'page': 1},
            {'path': 'fullName', 'quote': 'Missing', 'page': 10},
        ])
        result = checked_result(parsed, '--- TRANG 1 ---\nSource sentence\n--- TRANG 2 ---\nOther', 2, False)
        self.assertEqual(len(result.sources), 1)
        self.assertFalse(result.sources[0].verified)

    def test_dates_with_only_year_remain_in_original_text_for_review(self):
        result = checked_result(ParsedCvResult(fullName='Candidate', experiences=[{'company': 'ABC', 'startDate': '2023'}]), '--- TRANG 1 ---\nCandidate ABC 2023', 1, False)
        self.assertEqual(result.experiences[0].startDate, '')
        self.assertIn('2023', result.experiences[0].description)
        self.assertTrue(result.warnings)

class TextSourceGenerationTests(unittest.IsolatedAsyncioTestCase):
    async def test_text_pdf_does_not_spend_generation_on_quotes(self):
        from unittest.mock import AsyncMock, patch
        from services.cv_parser import parse_cv_content
        import os
        with patch.dict(os.environ, {'CV_PROCESSING_PROVIDER': 'ollama'}), \
             patch('services.cv_parser.inspect_pdf', return_value=('--- TRANG 1 ---\nCandidate\nJava', 1, False)), \
             patch('services.cv_parser.upstream.generate', new_callable=AsyncMock, return_value='{"fullName":"Candidate","skills":["Java"]}') as generate:
            result = await parse_cv_content(b'fixture', 'cv.pdf')
        schema = generate.await_args.kwargs['schema']
        for field in ('sources', 'extractedText', 'pageCount'):
            self.assertNotIn(field, schema['properties'])
            self.assertNotIn(field, schema['required'])
        self.assertEqual(schema['properties']['warnings']['maxItems'], 8)
        self.assertEqual(schema['properties']['warnings']['items']['maxLength'], 300)
        self.assertEqual({s.path for s in result.sources}, {'fullName', 'skills.0'})
        self.assertTrue(all(s.verified for s in result.sources))

class TextHallucinationGuardsTests(unittest.TestCase):
    def test_prompt_example_location_and_generated_summary_are_not_kept(self):
        result = checked_result(ParsedCvResult(fullName='NGUYEN VAN AN', email='an@example.test', location='Đà Nẵng, TP.HCM',
            summary='Experienced developer with excellent skills', extraSections=[{'title':'Tài liệu','content':'Trang 1 của tài liệu'}],
            experiences=[{'company':'ABC','description':'Built Java APIs'}]),
            '--- TRANG 1 ---\nNGUYEN VAN AN\nan@example.test\nABC\nBuilt Java APIs', 1, False)
        self.assertEqual(result.location, '')
        self.assertEqual(result.summary, '')
        self.assertEqual(result.email, 'an@example.test')
        self.assertEqual(result.extraSections, [])
        self.assertTrue(any('Nơi ở' in w for w in result.warnings))

    def test_real_intro_survives_layout_whitespace_and_scan_is_not_cleared(self):
        parsed = ParsedCvResult(fullName='Candidate', summary='I build APIs', phone='+84 901234567')
        result = checked_result(parsed, '--- TRANG 1 ---\nCandidate\nI build\nAPIs\n+84 901234567', 1, False)
        self.assertEqual(result.summary, 'I build APIs')
        self.assertEqual(result.phone, '+84 901234567')
        scan = checked_result(parsed, '--- TRANG 1 ---\n', 1, True)
        self.assertEqual(scan.fullName, 'Candidate')
        self.assertEqual(scan.summary, 'I build APIs')
