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
        with patch('services.cv_parser.inspect_pdf',return_value=('--- TRANG 1 ---',1,True)), patch('services.cv_parser.parse_with_gemini_multimodal',new_callable=AsyncMock,return_value=ParsedCvResult(fullName='Synthetic')) as vision, patch('services.cv_parser.upstream.generate',new_callable=AsyncMock) as gen:
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
