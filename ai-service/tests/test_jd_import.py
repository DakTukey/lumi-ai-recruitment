import io
import json
import os
import unittest
import zipfile
from unittest.mock import AsyncMock, patch

from pypdf import PdfWriter

from services import cv_writing_providers as providers
from services.job_creator import parse_jd_content, normalize_jd_import


def pdf(pages=1, password=None):
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=300, height=420)
    if password:
        writer.encrypt(password)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


class JdImportTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {'JD_IMPORT_PROVIDER': 'ollama'})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        providers._cooldowns.clear()

    async def test_scan_routes_page_images_to_local_model_only(self):
        with patch('services.job_creator.upstream.generate', new_callable=AsyncMock,
                   return_value='{"title":"Backend Developer","skills":[{"name":"Java"}]}') as generate:
            result = await parse_jd_content(pdf(), 'scan.pdf', None)
        self.assertEqual(result.title, 'Backend Developer')
        self.assertEqual(result.location, '')
        self.assertEqual(generate.await_count, 1)
        self.assertEqual(generate.await_args.args[0].name, 'ollama')
        self.assertEqual(len(generate.await_args.kwargs['images']), 1)

    async def test_text_pdf_uses_extracted_text_without_images(self):
        with patch('services.job_creator.inspect_document', return_value=('JD: Java developer in Hanoi', 1, False)), \
             patch('services.job_creator.upstream.generate', new_callable=AsyncMock,
                   return_value='{"title":"Java developer"}') as generate, \
             patch('services.job_creator.render_pdf_images') as render:
            await parse_jd_content(b'%PDF-fixture', 'jd.pdf', None)
        self.assertIn('Java developer in Hanoi', generate.await_args.args[1])
        self.assertIsNone(generate.await_args.kwargs['images'])
        render.assert_not_called()

    async def test_unavailable_local_model_never_falls_back_to_cloud(self):
        with patch('services.job_creator.upstream.generate', new_callable=AsyncMock,
                   side_effect=providers.ProviderUnavailable('local_model_unavailable')) as generate:
            with self.assertRaises(providers.ProviderUnavailable):
                await parse_jd_content(None, None, 'Backend developer using Java')
        self.assertEqual(generate.await_count, 1)
        self.assertEqual(generate.await_args.args[0].name, 'ollama')

    async def test_invalid_pdf_and_oversized_text_do_not_call_model(self):
        with patch('services.job_creator.upstream.generate', new_callable=AsyncMock) as generate:
            for content in (b'not PDF', pdf(11), pdf(password='private')):
                with self.subTest(content_length=len(content)), self.assertRaises(ValueError):
                    await parse_jd_content(content, 'jd.pdf', None)
            with self.assertRaises(ValueError):
                await parse_jd_content(None, None, 'x' * 50001)
            with self.assertRaises(ValueError):
                await parse_jd_content(None, None, 'x' * 12001)
            generate.assert_not_awaited()

    async def test_docx_extracts_xml_text_and_keeps_source_only(self):
        output = io.BytesIO()
        with zipfile.ZipFile(output, 'w') as archive:
            archive.writestr('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Java developer in Hanoi</w:t></w:r></w:p></w:body></w:document>')
        with patch('services.job_creator.upstream.generate', new_callable=AsyncMock,
                   return_value='{"title":"Java developer"}') as generate:
            await parse_jd_content(output.getvalue(), 'jd.docx', None)
        self.assertIn('Java developer in Hanoi', generate.await_args.args[1])

    def test_unknown_source_fields_stay_empty_and_zero_weight_is_retained(self):
        result = normalize_jd_import({'title': 'Backend', 'criteria': [{'description': 'Java', 'weight': 0}]})
        self.assertEqual((result.level, result.mode, result.location, result.headcount), ('', '', '', ''))
        self.assertEqual(result.criteria[0].weight, 0)
        self.assertEqual(result.criteria[0].id, 'crit-1')
        self.assertNotEqual(providers.providers('general')[0].name, 'ollama')

    async def test_empty_ai_output_is_rejected(self):
        with patch('services.job_creator.upstream.generate', new_callable=AsyncMock,
                   return_value=json.dumps({'title': '', 'description': '', 'requirements': ''})):
            with self.assertRaises(providers.ProviderUnavailable):
                await parse_jd_content(None, None, 'Backend developer using Java')


if __name__ == '__main__':
    unittest.main()
