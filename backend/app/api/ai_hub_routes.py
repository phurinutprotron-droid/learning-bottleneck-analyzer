"""Teacher-facing discovery of OpenRouter catalog metadata."""
from decimal import Decimal, InvalidOperation

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import staff
from app.services.openrouter_provider import BASE_URL

router = APIRouter(prefix='/ai', tags=['AI Hub'])


def price_class(pricing: dict) -> str:
    try:
        rates = [Decimal(pricing[field]) for field in ('prompt', 'completion')]
        if all(rate.is_finite() and rate >= 0 for rate in rates):
            return 'free' if not any(rates) else 'paid'
    except (InvalidOperation, KeyError, TypeError):
        pass
    return 'unknown'


async def catalog(q: str = '', modality: str = '', minimum_context: int = 0, free_only: bool = False):
    try:
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=8) as client:
            response = await client.get('models')
            response.raise_for_status()
            entries = response.json()['data']
            if not isinstance(entries, list):
                raise ValueError('Invalid catalog')
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        raise HTTPException(503, 'OpenRouter model catalog unavailable') from exc

    result = []
    for entry in entries:
        model_id = entry['id']
        name = entry.get('name') or model_id
        architecture = entry.get('architecture') or {}
        inputs = architecture.get('input_modalities') or []
        pricing = entry.get('pricing') or {}
        context = entry.get('context_length') or 0
        cost = price_class(pricing)
        parameters = entry.get('supported_parameters') or []
        output = architecture.get('output_modalities') or []
        if (q.casefold() not in f'{model_id} {name}'.casefold()
                or (modality and modality not in inputs)
                or context < minimum_context or (free_only and cost != 'free')):
            continue
        result.append({
            'provider': 'openrouter', 'id': model_id, 'name': name,
            'input_modalities': inputs, 'output_modalities': architecture.get('output_modalities'),
            'context_length': context, 'pricing': pricing, 'price_class': cost,
            'supported_parameters': parameters,
            'supports_advisory': 'structured_outputs' in parameters and 'text' in inputs and 'text' in output,
            'expiration_date': entry.get('expiration_date'),
        })
    return result


@router.get('/models', dependencies=[Depends(staff)])
async def models(
    q: str = Query('', max_length=100),
    modality: str = Query('', max_length=30),
    minimum_context: int = Query(0, ge=0),
    free_only: bool = False,
):
    return await catalog(q, modality, minimum_context, free_only)


async def require_advisory_model(model_id: str, allow_paid: bool):
    model = next((entry for entry in await catalog(q=model_id) if entry['id'] == model_id), None)
    if not model or not model['supports_advisory']:
        raise HTTPException(422, 'Choose a catalog model that supports structured text output')
    if model['price_class'] == 'unknown':
        raise HTTPException(422, 'This model has no verified prompt and completion pricing')
    if model['price_class'] == 'paid' and not allow_paid:
        raise HTTPException(422, 'Confirm paid model usage before submitting')




def select_auto_model(entries: list[dict], operation: str, preferred: str, default: str) -> str | None:
    reasoning_task = operation in {
        'reasoning_analysis', 'misconception_suggestions', 'verification_candidate',
    }
    eligible = [
        model for model in entries
        if model['supports_advisory'] and model['price_class'] == 'free'
        and not model['id'].startswith('openrouter/')
        and not model.get('expiration_date')
    ]
    if not eligible:
        return None

    def rank(model):
        parameters = model['supported_parameters']
        reasoning = 'reasoning' in parameters or 'reasoning_effort' in parameters
        return (
            model['id'] != preferred,
            reasoning != reasoning_task,
            model['id'] != default,
            -model['context_length'],
            model['id'],
        )

    return min(eligible, key=rank)['id']


async def choose_auto_model(operation: str, preferred: str, default: str) -> str | None:
    try:
        entries = await catalog(free_only=True)
    except HTTPException as exc:
        if exc.status_code != 503:
            raise
        return None
    return select_auto_model(entries, operation, preferred, default)
