"""Privately validate/configure Gemini; never print credentials or provider bodies."""
from pathlib import Path
import getpass
import json
import httpx

root = Path(__file__).resolve().parents[1]
key = getpass.getpass('Gemini API key (input hidden): ').strip()
model = 'gemini-3.8-flash'
if not key:
    raise SystemExit('No key supplied. Configuration unchanged.')
with httpx.Client(base_url='https://generativelanguage.googleapis.com/v1beta/', headers={'x-goog-api-key': key}, timeout=25) as client:
    try:
        metadata = client.get('models/' + model)
        print('Model access HTTP status:', metadata.status_code)
        if metadata.status_code != 200 or 'generateContent' not in metadata.json().get('supportedGenerationMethods', []):
            raise SystemExit('Model access was not verified. Configuration unchanged; deterministic mode remains available.')
        test = client.post('models/' + model + ':generateContent', json={
            'contents': [{'role': 'user', 'parts': [{'text': 'Return a JSON object with ok set to true. This is a software connection test.'}]}],
            'generationConfig': {'responseMimeType': 'application/json', 'responseJsonSchema': {'type': 'object', 'properties': {'ok': {'type': 'boolean'}}, 'required': ['ok']}, 'maxOutputTokens': 128},
        })
        print('Structured generation HTTP status:', test.status_code)
        generation_verified = False
        if test.status_code in (429, 500, 502, 503, 504):
            print('Provider temporarily unavailable. Model access is verified; deterministic fallback will handle generation failures.')
        elif test.status_code != 200:
            raise SystemExit('Generation was not verified. Configuration unchanged.')
        else:
            parsed = json.loads(test.json()['candidates'][0]['content']['parts'][0]['text'])
            if parsed != {'ok': True}:
                raise SystemExit('Unexpected structured test response. Configuration unchanged.')
            generation_verified = True
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        raise SystemExit('Provider test failed: ' + type(exc).__name__ + '. Configuration unchanged.') from None
path = root / '.env'
lines = path.read_text(encoding='utf-8').splitlines() if path.exists() else []
updates = {'AI_PROVIDER': 'gemini', 'GEMINI_MODEL': model, 'GEMINI_API_KEY': key}
kept = [line for line in lines if line.partition('=')[0] not in updates]
path.write_text('\n'.join(kept + [name + '=' + value for name, value in updates.items()]) + '\n', encoding='utf-8')
print('Configured Gemini 3.8 Flash in the ignored .env. Live structured generation verified:', generation_verified)
