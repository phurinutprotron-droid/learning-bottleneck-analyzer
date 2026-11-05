"""Local stdio MCP bridge for LBA's Gemini advisory provider."""
import sys
from pathlib import Path
from typing import Annotated, Any, Literal

from mcp.server.fastmcp import FastMCP
from pydantic import Field

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))

from app.core.config import Settings
from app.core.logging import configure_logging
from app.services.gemini_provider import GeminiProvider


server = FastMCP('LBA Gemini')


@server.tool()
async def gemini_advisory(
    subject: Literal['mathematics', 'science', 'coding'],
    outcomes: Annotated[list[bool], Field(min_length=1, max_length=20)],
) -> dict[str, Any]:
    """Get advisory suggestions from anonymous correctness observations.

    Use synthetic or authorized anonymous outcomes only. True indicates correct.
    Check the provider and fallback fields before attributing results to Gemini.
    """
    settings = Settings(_env_file=ROOT / '.env')
    observations = [
        {'source_id': f'R{index}', 'subject': subject, 'correct': correct}
        for index, correct in enumerate(outcomes, 1)
    ]
    return await GeminiProvider(settings).suggest('intervention_suggestions', {
        'source_response_ids': [observation['source_id'] for observation in observations],
        'observations': observations,
        'rubrics': [],
    })


if __name__ == '__main__':
    configure_logging()
    server.run(transport='stdio')
