import io
import unittest
from pypdf import PdfWriter
from models.cv_parser import ParsedCvResult
from services.cv_parser import extract_text_from_pdf, clean_json_text


class CvParserTests(unittest.IsolatedAsyncioTestCase):
    def test_parsed_cv_result_schema_defaults(self):
        result = ParsedCvResult(
            fullName="Nguyễn Văn A",
            skills=["Java", "Spring Boot", "React"],
            experiences=[{
                "company": "Công ty ABC",
                "position": "Backend Developer",
                "startDate": "2022-01",
                "endDate": "2024-01",
                "current": False,
                "description": "Lập trình REST API",
            }],
        )
        self.assertEqual(result.fullName, "Nguyễn Văn A")
        self.assertEqual(len(result.skills), 3)
        self.assertEqual(result.experiences[0].company, "Công ty ABC")
        self.assertEqual(result.title, "CV từ tệp tải lên")

    def test_extract_text_from_pdf_returns_content(self):
        writer = PdfWriter()
        writer.add_blank_page(width=100, height=100)
        output = io.BytesIO()
        writer.write(output)
        pdf_bytes = output.getvalue()

        # Blank PDF should not crash, returns empty string
        text = extract_text_from_pdf(pdf_bytes)
        self.assertEqual(text, "")

    def test_clean_json_text_removes_markdown_codeblocks(self):
        raw = "```json\n{\"fullName\": \"Test\"}\n```"
        cleaned = clean_json_text(raw)
        self.assertEqual(cleaned, "{\"fullName\": \"Test\"}")

    def test_clean_json_text_handles_plain_json(self):
        raw = "{\"fullName\": \"Test\"}"
        cleaned = clean_json_text(raw)
        self.assertEqual(cleaned, "{\"fullName\": \"Test\"}")

class PdfImportSafetyTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from services.cv_parser import _vision_rate_limits
        _vision_rate_limits.clear()

    async def test_vision_respects_retry_after_without_unbounded_or_repeated_requests(self):
        import os, json, httpx
        from unittest.mock import patch, AsyncMock
        from services.cv_parser import parse_with_groq_multimodal, _vision_rate_limits
        from services.cv_writing_providers import ProviderUnavailable
        ok = httpx.Response(200, json={'choices': [{'finish_reason': 'stop',
            'message': {'content': json.dumps({'fullName': 'Synthetic'})}}]})
        with patch.dict(os.environ, {'GROQ_API_KEY': 'test'}), \
             patch('services.cv_parser.render_pdf_images', return_value=['page']), \
             patch('services.cv_parser.asyncio.sleep', new_callable=AsyncMock) as sleep, \
             patch('services.cv_parser.httpx.AsyncClient.post', new_callable=AsyncMock,
                   side_effect=[httpx.Response(429, headers={'Retry-After': '13'}), ok]) as post:
            self.assertEqual((await parse_with_groq_multimodal(b'pdf')).fullName, 'Synthetic')
            self.assertEqual(post.await_count, 2); sleep.assert_awaited_once()
            self.assertGreater(sleep.await_args.args[0], 12)
            self.assertLess(sleep.await_args.args[0], 14)
            # The provider uses JSON mode; a duplicated full schema needlessly burns TPM.
            prompt=post.await_args.kwargs['json']['messages'][0]['content']
            self.assertNotIn('$defs', prompt)
            self.assertIn('experiences', prompt)
            _vision_rate_limits.clear(); post.reset_mock(); sleep.reset_mock()
            post.side_effect = None; post.return_value = httpx.Response(429, headers={'Retry-After': '60'})
            for _ in range(2):
                with self.assertRaises(ProviderUnavailable) as error: await parse_with_groq_multimodal(b'pdf')
                self.assertEqual(str(error.exception), 'http_429')
                self.assertGreater(error.exception.retry_after, 50)
            post.assert_awaited_once(); sleep.assert_not_awaited()

    async def test_rate_limit_remains_visible_when_vision_fallback_also_fails(self):
        from unittest.mock import patch, AsyncMock
        from services.cv_parser import parse_cloud_visual
        from services.cv_writing_providers import ProviderUnavailable
        from fastapi import FastAPI
        from routers.cv_parser import router
        import httpx
        with patch('services.cv_parser.parse_with_groq_multimodal', new_callable=AsyncMock,
                   side_effect=ProviderUnavailable('http_429', 45)), \
             patch('services.cv_parser.parse_with_gemini_multimodal', new_callable=AsyncMock,
                   side_effect=TimeoutError()):
            with self.assertRaises(ProviderUnavailable) as error: await parse_cloud_visual(b'pdf', 'cv.pdf')
            self.assertEqual(str(error.exception), 'http_429')
            self.assertGreater(error.exception.retry_after, 40)
        app=FastAPI();app.include_router(router)
        with patch('routers.cv_parser.parse_cv_content', new_callable=AsyncMock,
                   side_effect=ProviderUnavailable('http_429', 42)):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
                response=await client.post('/cv-parser', files={'file': ('cv.pdf', b'%PDF-fixture')})
            self.assertEqual(response.status_code, 429)
            self.assertEqual(response.headers['Retry-After'], '42')

    async def test_visual_provider_fallback_is_bounded_and_never_bypasses_refusal(self):
        from unittest.mock import patch, AsyncMock
        from services.cv_parser import parse_cloud_visual
        from services.cv_writing_providers import ProviderUnavailable, ProviderRefused
        with patch('services.cv_parser.parse_with_groq_multimodal', new_callable=AsyncMock,
                   return_value=ParsedCvResult(fullName='Synthetic')), \
             patch('services.cv_parser.parse_with_gemini_multimodal', new_callable=AsyncMock) as gemini:
            self.assertEqual((await parse_cloud_visual(b'pdf', 'cv.pdf')).fullName, 'Synthetic')
            gemini.assert_not_awaited()
        for error in [ProviderUnavailable('http_503'), ProviderUnavailable('vision_page_limit'), TimeoutError(), ValueError('invalid JSON')]:
            with patch('services.cv_parser.parse_with_groq_multimodal', new_callable=AsyncMock, side_effect=error) as groq, \
                 patch('services.cv_parser.parse_with_gemini_multimodal', new_callable=AsyncMock,
                       return_value=ParsedCvResult(fullName='Synthetic')) as gemini:
                result = await parse_cloud_visual(b'pdf', 'cv.pdf')
                self.assertEqual(result.fullName, 'Synthetic')
                groq.assert_awaited_once(); gemini.assert_awaited_once_with(b'pdf', 'cv.pdf')
        with patch('services.cv_parser.parse_with_groq_multimodal', new_callable=AsyncMock,
                   side_effect=ProviderUnavailable('http_429')) as groq, \
             patch('services.cv_parser.parse_with_gemini_multimodal', new_callable=AsyncMock,
                   side_effect=ProviderUnavailable('http_429')) as gemini:
            with self.assertRaises(ProviderUnavailable): await parse_cloud_visual(b'pdf', 'cv.pdf')
            groq.assert_awaited_once(); gemini.assert_awaited_once()
        with patch('services.cv_parser.parse_with_groq_multimodal', new_callable=AsyncMock,
                   side_effect=ProviderRefused('provider_refused')), \
             patch('services.cv_parser.parse_with_gemini_multimodal', new_callable=AsyncMock) as gemini:
            with self.assertRaises(ProviderRefused): await parse_cloud_visual(b'pdf', 'cv.pdf')
            gemini.assert_not_awaited()

    async def test_groq_vision_sends_images_and_never_truncates_long_cv_or_accepts_partial_output(self):
        import os, json, httpx
        from unittest.mock import patch, AsyncMock
        from services.cv_parser import parse_with_groq_multimodal
        from services.cv_writing_providers import ProviderUnavailable
        def response(finish='stop'):
            return httpx.Response(200, json={'choices': [{'finish_reason': finish,
                'message': {'content': json.dumps({'fullName': 'Synthetic'})}}]})
        with patch.dict(os.environ, {'GROQ_API_KEY': 'test'}), \
             patch('services.cv_parser.render_pdf_images', return_value=['page-one', 'page-two']) as render, \
             patch('services.cv_parser.httpx.AsyncClient.post', new_callable=AsyncMock,
                   side_effect=[response(), response('length')]) as post:
            result = await parse_with_groq_multimodal(b'pdf')
            self.assertEqual(result.fullName, 'Synthetic')
            images = post.await_args.kwargs['json']['messages'][1]['content'][1:]
            self.assertEqual(len(images), 2)
            self.assertEqual(images[1]['image_url']['url'], 'data:image/jpeg;base64,page-two')
            with self.assertRaises(ProviderUnavailable): await parse_with_groq_multimodal(b'pdf')
            render.return_value = ['p1', 'p2', 'p3', 'p4']
            with self.assertRaises(ProviderUnavailable): await parse_with_groq_multimodal(b'pdf')
            self.assertEqual(post.await_count, 2)

    async def test_gemini_visual_request_uses_compact_schema_but_validates_original_limits(self):
        import os
        import httpx
        from unittest.mock import patch, AsyncMock
        from services.cv_parser import parse_with_gemini_multimodal
        def response(data):
            import json
            return httpx.Response(200, json={'candidates': [{'finishReason': 'STOP',
                'content': {'parts': [{'text': json.dumps(data)}]}}]})
        too_many_sources = {'fullName': 'Synthetic', 'sources': [
            {'path': 'fullName', 'quote': 'Synthetic', 'page': 1} for _ in range(81)]}
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test'}), patch(
                'services.cv_parser.httpx.AsyncClient.post', new_callable=AsyncMock,
                side_effect=[response({'fullName': 'Synthetic'}), response(too_many_sources)]) as post:
            result = await parse_with_gemini_multimodal(b'%PDF-fixture', 'cv.pdf')
            self.assertEqual(result.fullName, 'Synthetic')
            schema = post.await_args.kwargs['json']['generationConfig']['responseJsonSchema']
            self.assertEqual(schema['properties']['title']['type'], 'string')
            self.assertEqual(schema['$defs']['ParsedAward']['properties']['title']['type'], 'string')
            self.assertNotIn('extractedText', schema['properties'])
            self.assertNotIn('pageCount', schema['properties'])
            self.assertNotIn('maxItems', schema['properties']['sources'])
            self.assertNotIn('maxLength', schema['$defs']['FieldSource']['properties']['quote'])
            with self.assertRaises(ValueError):
                await parse_with_gemini_multimodal(b'%PDF-fixture', 'cv.pdf')

    async def test_text_gemini_uses_compact_schema_without_changing_groq_or_local_schemas(self):
        import json
        from unittest.mock import patch, AsyncMock
        from services.cv_parser import parse_cv_content, extraction_schema
        from services.cv_writing_providers import Provider
        provider = Provider('gemini', 'test', 'GEMINI_API_KEY', 15)
        with patch('services.cv_parser.inspect_pdf', return_value=('Synthetic Candidate', 1, False)), \
             patch('services.cv_parser.upstream.providers', return_value=[provider]), \
             patch('services.cv_parser.upstream.available', return_value=True), \
             patch('services.cv_parser.upstream.generate', new_callable=AsyncMock,
                   return_value=json.dumps({'fullName': 'Synthetic Candidate'})) as generate:
            result = await parse_cv_content(b'fixture', 'cv.pdf')
            self.assertEqual(result.fullName, 'Synthetic Candidate')
            self.assertNotIn('maxItems', generate.await_args.kwargs['schema']['properties']['warnings'])
            self.assertNotIn('sources', generate.await_args.kwargs['schema']['properties'])
        self.assertEqual(extraction_schema(True)['properties']['sources']['maxItems'], 80)

    async def test_invalid_encrypted_or_too_many_pages_never_calls_ai(self):
        from unittest.mock import patch, AsyncMock
        from services.cv_parser import parse_cv_content
        def pdf(pages=1, password=None):
            w=PdfWriter()
            for _ in range(pages): w.add_blank_page(width=100,height=100)
            if password: w.encrypt(password)
            out=io.BytesIO();w.write(out);return out.getvalue()
        with patch('services.cv_parser.upstream.generate', new_callable=AsyncMock) as generate, patch('services.cv_parser.parse_with_gemini_multimodal', new_callable=AsyncMock) as vision:
            for content in (b'not PDF', b'%PDF-broken', pdf(11), pdf(1,'password')):
                with self.assertRaises(ValueError): await parse_cv_content(content,'cv.pdf')
            generate.assert_not_awaited();vision.assert_not_awaited()

    async def test_text_provider_fallback_and_preserve_extra_sections(self):
        from unittest.mock import patch, AsyncMock
        from services.cv_parser import parse_cv_content
        from services.cv_writing_providers import ProviderUnavailable
        import json
        response={'fullName':'Synthetic Candidate','extraSections':[{'title':'Research','content':'Paper 2023'}]}
        with patch('services.cv_parser.inspect_pdf',return_value=('--- TRANG 1 ---\nSynthetic Candidate, Paper 2023',1,False)), patch('services.cv_parser.upstream.available',return_value=True), patch('services.cv_parser.upstream.generate',new_callable=AsyncMock,side_effect=[ProviderUnavailable('quota'),json.dumps(response)]) as gen, patch('services.cv_parser.parse_with_gemini_multimodal',new_callable=AsyncMock) as vision:
            result=await parse_cv_content(b'fixture','cv.pdf')
            self.assertEqual(gen.await_count,2)
            self.assertEqual([c.args[0].name for c in gen.await_args_list],['gemini','groq'])
            self.assertEqual(result.extraSections[0].content,'Paper 2023')
            self.assertIn('TRANG 1',result.extractedText);self.assertEqual(result.pageCount,1)
            vision.assert_not_awaited()

    async def test_visual_uses_pdf_and_refusal_does_not_fallback(self):
        from unittest.mock import patch, AsyncMock
        from services.cv_parser import parse_cv_content
        from services.cv_writing_providers import ProviderRefused
        with patch('services.cv_parser.inspect_pdf',return_value=('--- TRANG 1 ---',1,True)), patch('services.cv_parser.parse_cloud_visual',new_callable=AsyncMock,return_value=ParsedCvResult(fullName='Synthetic')) as vision, patch('services.cv_parser.upstream.generate',new_callable=AsyncMock) as gen:
            result=await parse_cv_content(b'fixture','private-name.pdf')
            vision.assert_awaited_once_with(b'fixture','cv.pdf');gen.assert_not_awaited()
            self.assertTrue(any('bố cục' in w for w in result.warnings))
        with patch('services.cv_parser.inspect_pdf',return_value=('text',1,False)), patch('services.cv_parser.upstream.available',return_value=True), patch('services.cv_parser.upstream.generate',new_callable=AsyncMock,side_effect=ProviderRefused('refused')) as gen:
            with self.assertRaises(ProviderRefused): await parse_cv_content(b'fixture','cv.pdf')
            self.assertEqual(gen.await_count,1)

    def test_partial_dates_are_preserved_without_inventing_month(self):
        from services.cv_parser import checked_result
        result=checked_result(ParsedCvResult(fullName='Synthetic',experiences=[{'company':'ABC','startDate':'2023'}],certifications=[{'name':'Certificate','issuedDate':'2024'}]),'2023 2024',1,False)
        self.assertEqual(result.experiences[0].startDate,'')
        self.assertIn('2023',result.experiences[0].description)
        self.assertEqual(result.certifications[0].issuedDate,'')
        self.assertIn('2024',result.extraSections[0].content)
