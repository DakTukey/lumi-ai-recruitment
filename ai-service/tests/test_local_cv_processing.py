import io
import json
import os
import unittest
from unittest.mock import AsyncMock, patch

from pypdf import PdfWriter

from services import cv_writing_providers as providers
from services.cv_parser import parse_cv_content, original_spelling


class FakeResponse:
    is_error = False
    is_redirect = False
    status_code = 200
    content = b'{}'

    def json(self):
        return {'done_reason': 'stop', 'message': {'content': '{"summary":"ok"}'}}


class FakeClient:
    def __init__(self):
        self.post = AsyncMock(return_value=FakeResponse())

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        pass


class LocalCvProcessingTests(unittest.IsolatedAsyncioTestCase):
    def test_name_keeps_original_pdf_spelling(self):
        self.assertEqual(original_spelling('Nguyễn Văn An', 'CV\nNGUYEN VAN AN\nJava'), 'NGUYEN VAN AN')
        self.assertEqual(original_spelling('Nguyen Van An', 'CV\nNguyễn Văn An\nJava'), 'Nguyễn Văn An')

    async def test_local_provider_uses_loopback_and_schema_without_api_key(self):
        with patch.dict(os.environ, {'CV_PROCESSING_PROVIDER': 'ollama'}, clear=False):
            provider = providers.providers('cv_processing')[0]
            self.assertEqual(provider.name, 'ollama')
            self.assertTrue(providers.available(provider))
            client = FakeClient()
            with patch.object(providers.httpx, 'AsyncClient', return_value=client):
                answer = await providers.generate(provider, 'Instructions<INPUT_JSON>{"cv":"private"}',
                                                  schema={'type': 'object', 'properties': {'summary': {'type': 'string'}}},
                                                  images=['image-base64'])
            self.assertEqual(json.loads(answer), {'summary': 'ok'})
            args, kwargs = client.post.await_args
            self.assertEqual(args[0], 'http://127.0.0.1:11434/api/chat')
            self.assertEqual(kwargs['json']['model'], 'qwen3-vl:2b-instruct-q4_K_M')
            self.assertEqual(kwargs['json']['messages'][1]['images'], ['image-base64'])
            self.assertFalse(kwargs['json']['stream'])

    async def test_visual_pdf_stays_on_local_provider(self):
        writer = PdfWriter()
        writer.add_blank_page(width=300, height=420)
        output = io.BytesIO()
        writer.write(output)
        with patch.dict(os.environ, {'CV_PROCESSING_PROVIDER': 'ollama'}, clear=False), \
             patch('services.cv_parser.upstream.generate', new_callable=AsyncMock,
                   return_value='{"fullName":"Synthetic Candidate"}') as generate, \
             patch('services.cv_parser.parse_with_gemini_multimodal', new_callable=AsyncMock) as external:
            parsed = await parse_cv_content(output.getvalue(), 'cv.pdf')
        self.assertEqual(parsed.fullName, 'Synthetic Candidate')
        self.assertEqual(parsed.pageCount, 1)
        self.assertTrue(generate.await_args.kwargs['images'])
        self.assertEqual(generate.await_args.kwargs['schema']['properties']['sources']['maxItems'], 12)
        external.assert_not_awaited()


if __name__ == '__main__':
    unittest.main()
