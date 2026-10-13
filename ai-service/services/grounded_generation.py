"""Validate every provider response before accepting it; never fabricate a fallback."""
import asyncio
import logging
import re
from dataclasses import replace
from services import cv_writing_providers as upstream

logger = logging.getLogger(__name__)
_slots = asyncio.Semaphore(2)


def strict_schema(schema):
    if isinstance(schema, dict):
        schema = {k: strict_schema(v) for k, v in schema.items()}
        if schema.get('type') == 'object':
            schema['additionalProperties'] = False
            schema['required'] = list(schema.get('properties', {}))
    elif isinstance(schema, list):
        schema = [strict_schema(v) for v in schema]
    return schema


async def generate_grounded(prompt, schema, normalize, max_tokens=8192):
    # No unbounded queue. Spring also limits authenticated matching requests.
    if _slots.locked():
        raise upstream.ProviderUnavailable('busy')
    async with _slots, asyncio.timeout(28):
        for configured in upstream.providers():
            provider = replace(configured, timeout=10 if configured.name == 'groq' else 16)
            if not upstream.available(provider):
                continue
            try:
                raw = await asyncio.wait_for(upstream.generate(provider, prompt, strict_schema(schema), max_tokens), provider.timeout)
                from services.gemini_service import _parse_json
                result = normalize(_parse_json(raw.strip()))
                result.model_name = f'{provider.name}/{provider.model}'
                upstream.succeeded(provider)
                return result
            except upstream.ProviderRefused:
                # Refusal must not be bypassed through another provider.
                raise
            except (upstream.ProviderUnavailable, ValueError, TimeoutError) as error:
                upstream.failed(provider, getattr(error, 'retry_after', 15))
                # Never log prompts, generated content, provider bodies, URLs or keys.
                code = type(error).__name__
                if isinstance(error, upstream.ProviderUnavailable) and re.fullmatch(r'http_[0-9]{3}|network_or_timeout|incomplete_response|invalid_response|empty_response|response_too_large', str(error)):
                    code = str(error)
                elif type(error) is ValueError and str(error) in {
                    'Evidence is not an exact CV quote', 'No-evidence criterion cannot contain evidence',
                    'Unknown or unbounded gap suggestions', 'AI trả về JSON không hợp lệ.',
                    'Kết quả thiếu hoặc trùng tiêu chí của JD.', 'AI đã thay đổi trọng số của JD.',
                    'Kết quả chứa tiêu chí không thuộc JD hoặc trùng lặp.', 'Điểm không tương ứng bằng chứng.',
                    'Kết quả khớp thiếu trích dẫn CV.', 'Summary evidence does not match job',
                }: code = str(error)
                logger.warning('Grounded AI unavailable: %s (%s)', provider.name, code)
        raise upstream.ProviderUnavailable('all_providers_unavailable')
