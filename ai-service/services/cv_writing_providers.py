"""Bounded, server-side JSON provider transport shared by AI features."""
import os
import time
from dataclasses import dataclass

import httpx


class ProviderUnavailable(RuntimeError):
    def __init__(self, reason: str, retry_after: float = 15):
        super().__init__(reason)
        self.retry_after = retry_after


class ProviderRefused(RuntimeError):
    pass


@dataclass(frozen=True)
class Provider:
    name: str
    model: str
    key_env: str
    timeout: float


# Process-local availability state only; no CV text, API keys or generated content.
_cooldowns: dict[tuple[str, str], float] = {}


def providers(feature: str = 'general') -> list[Provider]:
    local_setting = {'cv_processing': 'CV_PROCESSING_PROVIDER', 'jd_import': 'JD_IMPORT_PROVIDER'}.get(feature)
    if local_setting and os.getenv(local_setting, '').strip().lower() == 'ollama':
        return [Provider('ollama', os.getenv('OLLAMA_MODEL', 'qwen3-vl:2b-instruct-q4_K_M'), '', 240)]
    return [
        Provider('groq', os.getenv('GROQ_MODEL', 'openai/gpt-oss-120b'), 'GROQ_API_KEY', 15),
        Provider('gemini', os.getenv('GEMINI_MODEL', 'gemini-3.1-flash-lite'), 'GEMINI_API_KEY', 15),
    ]


def available(provider: Provider) -> bool:
    if provider.name == 'ollama':
        return time.monotonic() >= _cooldowns.get((provider.name, provider.model), 0)
    key = os.getenv(provider.key_env, '').strip()
    return bool(key and 'PASTE_YOUR_KEY' not in key
                and time.monotonic() >= _cooldowns.get((provider.name, provider.model), 0))


def failed(provider: Provider, retry_after: float = 15):
    _cooldowns[(provider.name, provider.model)] = time.monotonic() + min(300, max(15, retry_after))


def succeeded(provider: Provider):
    _cooldowns.pop((provider.name, provider.model), None)


_SCHEMA = {
    'type': 'object', 'additionalProperties': False,
    'properties': {'suggestion': {'type': 'string'},
                   'questions': {'type': 'array', 'items': {'type': 'string'}}},
    'required': ['suggestion', 'questions'],
}


async def generate(provider: Provider, prompt: str, schema: dict | None = None, max_tokens: int = 4096,
                   images: list[str] | None = None) -> str:
    if provider.name == 'ollama':
        instructions, marker, source = prompt.partition('<INPUT_JSON>')
        source = marker + source if marker else prompt
        url = os.getenv('OLLAMA_BASE_URL', 'http://127.0.0.1:11434').rstrip('/')
        if url not in ('http://127.0.0.1:11434', 'http://localhost:11434'):
            raise ProviderUnavailable('invalid_local_url', 60)
        payload = {
            'model': provider.model,
            'messages': [
                {'role': 'system', 'content': instructions},
                {'role': 'user', 'content': source, **({'images': images} if images else {})},
            ],
            'stream': False,
            'think': False,
            'format': schema or _SCHEMA,
            'options': {'temperature': 0, 'num_ctx': 16384, 'num_predict': max_tokens},
            'keep_alive': 0,
        }
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(provider.timeout, connect=3), follow_redirects=False) as client:
                response = await client.post(f'{url}/api/chat', json=payload)
        except httpx.RequestError:
            raise ProviderUnavailable('local_model_unavailable', 15) from None
        if response.is_error or response.is_redirect:
            raise ProviderUnavailable(f'local_http_{response.status_code}', 15)
        if len(response.content) > 262144:
            raise ProviderUnavailable('response_too_large')
        try:
            data = response.json()
            if data.get('done_reason') not in (None, 'stop'):
                raise ProviderUnavailable('incomplete_response')
            answer = data['message']['content']
            if not isinstance(answer, str) or not answer.strip():
                raise ProviderUnavailable('empty_response')
            return answer
        except (KeyError, TypeError, ValueError):
            raise ProviderUnavailable('invalid_response') from None
    key = os.environ.get(provider.key_env, '').strip()
    if not key:
        raise ProviderUnavailable('not_configured', 60)
    instructions, marker, source = prompt.partition('<INPUT_JSON>')
    source = marker + source if marker else prompt
    if provider.name == 'groq':
        url = 'https://api.groq.com/openai/v1/chat/completions'
        headers = {'Authorization': f'Bearer {key}'}
        payload = {
            'model': provider.model, 'messages': [
                {'role': 'system', 'content': instructions}, {'role': 'user', 'content': source}],
            'temperature': 0.2, 'max_completion_tokens': max_tokens, 'reasoning_effort': 'low',
            'response_format': {'type': 'json_schema', 'json_schema': {
                'name': 'cv_writing', 'strict': True, 'schema': schema or _SCHEMA}},
        }
    else:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{provider.model}:generateContent'
        headers = {'x-goog-api-key': key}
        payload = {
            'systemInstruction': {'parts': [{'text': instructions}]},
            'contents': [{'parts': [{'text': source}]}],
            'generationConfig': {'temperature': 0.2, 'maxOutputTokens': max_tokens,
                                 'responseMimeType': 'application/json'},
        }
    if provider.name == 'gemini' and schema is not None:
        payload['generationConfig']['responseJsonSchema'] = schema
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(provider.timeout, connect=3),
                                     follow_redirects=False) as client:
            response = await client.post(url, headers=headers, json=payload)
    except httpx.RequestError:
        raise ProviderUnavailable('network_or_timeout') from None
    if len(response.content) > 131072:
        raise ProviderUnavailable('response_too_large')
    if response.is_error or response.is_redirect:
        try:
            code = response.json().get('error', {}).get('code')
            # Groq sometimes rejects a valid exact CV substring because the schema offers whole lines.
            # Return the candidate JSON only; the caller must run the same strict business validator.
            # This adds no retry or paid request and never accepts an ungrounded result.
            if provider.name == 'groq' and response.status_code == 400 and code == 'json_validate_failed':
                candidate = response.json().get('error', {}).get('failed_generation')
                if isinstance(candidate, str) and candidate.strip():
                    return candidate
            if code in ('content_policy_violation', 'safety'):

                raise ProviderRefused('provider_refused')
        except (ValueError, AttributeError):
            pass
        try:
            retry_after = float(response.headers.get('retry-after', '30'))
        except ValueError:
            retry_after = 30
        if response.status_code in (401, 403, 404):
            retry_after = 60
        raise ProviderUnavailable(f'http_{response.status_code}', retry_after)
    try:
        data = response.json()
        if provider.name == 'groq':
            choice = data['choices'][0]
            if choice['message'].get('refusal'):
                raise ProviderRefused('provider_refused')
            if choice.get('finish_reason') != 'stop':
                raise ProviderUnavailable('incomplete_response')
            text = choice['message']['content']
        else:
            if data.get('promptFeedback', {}).get('blockReason'):
                raise ProviderRefused('provider_refused')
            candidate = data['candidates'][0]
            if candidate.get('finishReason') in ('SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST'):
                raise ProviderRefused('provider_refused')
            if candidate.get('finishReason') != 'STOP':
                raise ProviderUnavailable('incomplete_response')
            text = ''.join(part.get('text', '') for part in candidate['content']['parts']
                           if not part.get('thought'))
        if not isinstance(text, str) or not text.strip():
            raise ProviderUnavailable('empty_response')
        return text
    except (KeyError, IndexError, TypeError, ValueError):
        raise ProviderUnavailable('invalid_response') from None
