"""Expose ingestion readiness without publishing unreviewed curriculum text."""
import json
import sys
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import current_user, staff
from app.models.entities import User
from app.services.curriculum_exam import generate_exam, indicator_catalog

from app.services.qwen_exam import OBEC_CURRICULUM, OBEC_INDICATORS, generate_qwen_exam

router = APIRouter(tags=['Curriculum'])
ARCHIVE = Path(__file__).resolve().parents[2 if sys.platform == 'emscripten' else 3] / 'curriculum_archive'


@router.get('/curriculum/status')
def curriculum_status(user: User = Depends(current_user)):
    if user.role not in {'teacher', 'researcher'}:
        raise HTTPException(403, 'Curriculum staging is available to staff.')
    sources = []
    for path in sorted(ARCHIVE.glob('*.json')):
        record = json.loads(path.read_text(encoding='utf-8'))
        pages = record.get('pages', [])
        sources.append({
            **{field: record.get(field) for field in ('title', 'source_url', 'status', 'year_be', 'revision', 'sha256')},
            'pages': len(pages),
            'needs_ocr': sum(page['status'] == 'needs_ocr' for page in pages),
            'candidate_pages': sum(bool(page['indicator_candidates']) for page in pages),
        })
    versions_by_digest = {}
    for source in sources:
        if source['sha256']:
            versions_by_digest.setdefault(source['sha256'], set()).add((source['year_be'], source['revision']))
    for source in sources:
        source['revision_conflict'] = len(versions_by_digest.get(source['sha256'], ())) > 1
    return {
        'sources': sources,
        'verified_indicators': len(indicator_catalog()),
        'generation_ready': True,
        'priority_grades': [7, 8, 9],
    }


class ExamDraftRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    indicator_id: Literal['rational', 'ratio', 'equation']
    count: int = Field(default=5, ge=1, le=20)
    seed: int | None = Field(default=None, ge=0, le=2**32 - 1)


@router.get('/curriculum/exam-indicators', dependencies=[Depends(staff)])
def exam_indicators():
    return indicator_catalog()


@router.post('/curriculum/exam-drafts', dependencies=[Depends(staff)])
def exam_draft(body: ExamDraftRequest):
    return generate_exam(body.indicator_id, body.count, body.seed)


class AIExamDraftRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    grade: Literal[7, 8, 9]
    subject: Literal['thai', 'math', 'science', 'social', 'history', 'health', 'arts', 'career', 'language']
    code: str = Field(min_length=3, max_length=60)
    excerpt: str = Field(min_length=12, max_length=2500)
    source_url: Literal[OBEC_CURRICULUM, OBEC_INDICATORS]
    count: int = Field(default=3, ge=1, le=10)
    allow_paid: Literal[True]


@router.post('/curriculum/ai-exam-drafts', dependencies=[Depends(staff)])
async def ai_exam_draft(body: AIExamDraftRequest):
    return await generate_qwen_exam(body.model_dump(exclude={'count', 'allow_paid'}), body.count)

