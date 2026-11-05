from typing import Protocol
from app.schemas.contracts import AISuggestion


class AIProvider(Protocol):
    async def suggest(self, operation: str, context: dict) -> dict: ...


class DeterministicProvider:
    async def suggest(self, operation: str, context: dict) -> dict:
        suggestion = AISuggestion(explanation='Review the observed answers and rubric observations with a teacher. These sample rules do not establish a learning diagnosis.',
                                  source_response_ids=context['source_response_ids'],
                                  suggestions=['Use a distinct curated verification item.', 'Explain each step and compare it with a worked example.'])
        return {'provider': 'deterministic', 'model_id': None, 'prompt_version': 'advisory-v1', 'operation': operation,
                'fallback': True, 'suggestion': suggestion.model_dump()}
