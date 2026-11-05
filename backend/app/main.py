import logging
import time
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.database import SessionLocal, get_db
from app.core.logging import configure_logging, request_id_context
from app.core.security import current_user
from app.models.entities import SubjectVersion, User
from app.subjects.registry import PACKS, CROSS_SUBJECT_RELATIONSHIPS
from app.knowledge_graph.graph_engine import validate_graph, traverse, validate_cross_subject
from app.api import auth_routes, student_routes, assessment_routes, diagnostic_routes, verification_routes, intervention_routes, research_routes


@asynccontextmanager
async def lifespan(app):
    configure_logging()
    validate_cross_subject(PACKS, CROSS_SUBJECT_RELATIONSHIPS)
    with SessionLocal() as db:
        for pack in PACKS.values():
            validate_graph(pack)
            key = f'{pack.id}:{pack.version}'
            existing = db.get(SubjectVersion, key)
            if existing and existing.snapshot != pack.model_dump():
                raise RuntimeError('Subject pack changed without a version increment: ' + key)
            if not existing:
                db.add(SubjectVersion(id=key, snapshot=pack.model_dump()))
        db.commit()
    logging.getLogger("lba.lifecycle").info("startup_completed")
    try:
        yield
    finally:
        logging.getLogger("lba.lifecycle").info("shutdown_completed")


app = FastAPI(title='Learning Bottleneck Analyzer', version='0.1.0', lifespan=lifespan,
              description='Evidence-driven research MVP. Sample content is unvalidated; no causal or clinical claims.')
settings = get_settings()
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False,
                   allow_methods=['GET', 'POST', 'PATCH', 'DELETE'], allow_headers=['Authorization', 'Content-Type'],
                   expose_headers=['X-Request-ID'])
requests_by_ip = defaultdict(deque)


@app.middleware('http')
async def request_context(request, call_next):
    request_id = str(uuid.uuid4())
    started = time.monotonic()
    address = request.client.host if request.client else 'local'
    bucket = requests_by_ip[address]
    while bucket and bucket[0] < started - 60:
        bucket.popleft()
    if len(requests_by_ip) > 10000:
        for key in list(requests_by_ip):
            if not requests_by_ip[key] or requests_by_ip[key][-1] < started - 60:
                del requests_by_ip[key]
    token = request_id_context.set(request_id)
    try:
        if request.url.path != '/health' and len(bucket) >= settings.rate_limit_per_minute:
            response = JSONResponse({'detail': 'Rate limit reached; retry in one minute'}, status_code=429, headers={'Retry-After': '60'})
        else:
            if request.url.path != '/health':
                bucket.append(started)
            response = await call_next(request)
    except Exception as exc:
        logging.getLogger('lba.http').error('request_failed', extra={
            'request_id': request_id, 'status': 500, 'failure_type': type(exc).__name__,
            'duration_ms': round((time.monotonic() - started) * 1000),
        })
        raise
    finally:
        request_id_context.reset(token)
    response.headers['X-Request-ID'] = request_id
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Cache-Control'] = 'no-store'
    route = getattr(request.scope.get('route'), 'path', None)
    logging.getLogger('lba.http').info('request_completed', extra={
        'request_id': request_id, 'status': response.status_code, 'method': request.method,
        'route': route, 'duration_ms': round((time.monotonic() - started) * 1000),
    })
    return response


@app.exception_handler(IntegrityError)
async def integrity_error(request, exc):
    logging.getLogger('lba.db').warning('integrity_conflict')
    return JSONResponse({'detail': 'Conflicting record; refresh and retry'}, status_code=409)


@app.get('/health', tags=['Operations'])
def health():
    try:
        with SessionLocal() as db:
            db.execute(text('SELECT 1'))
    except SQLAlchemyError as exc:
        logging.getLogger('lba.db').warning('readiness_failed', extra={
            'request_id': request_id_context.get(), 'failure_type': type(exc).__name__,
        })
        return JSONResponse({'status': 'unavailable'}, status_code=503)
    return {'status': 'ok', 'version': app.version}


@app.get('/api/subjects', tags=['Subjects'])
def subjects(user: User = Depends(current_user)):
    return [
        {**pack.model_dump(exclude={'items'}), 'baseline_item_count': sum(item.stage == 'pre' for item in pack.items)}
        for pack in PACKS.values()
    ]


@app.get('/api/subjects/{subject_id}/graph', tags=['Subjects'])
def graph(subject_id: str, concept_id: str | None = None, user: User = Depends(current_user)):
    if subject_id not in PACKS:
        raise HTTPException(404, 'Subject not found')
    pack = PACKS[subject_id]
    if concept_id and concept_id not in {c.id for c in pack.concepts}:
        raise HTTPException(404, 'Concept not found')
    return {'nodes': [c.model_dump() for c in pack.concepts], 'edges': [r.model_dump() for r in pack.relationships],
            'validation': validate_graph(pack), 'prerequisites': traverse(pack, concept_id, True) if concept_id else []}


@app.get('/api/graph', tags=['Subjects'])
def cross_subject_graph(user: User = Depends(current_user)):
    return {'nodes': [c.model_dump() for pack in PACKS.values() for c in pack.concepts],
            'edges': [r.model_dump() for pack in PACKS.values() for r in pack.relationships] + [r.model_dump() for r in CROSS_SUBJECT_RELATIONSHIPS],
            'validation': validate_cross_subject(PACKS, CROSS_SUBJECT_RELATIONSHIPS)}


from app.api import ai_hub_routes, curriculum_routes

for module in [auth_routes, student_routes, assessment_routes, diagnostic_routes, verification_routes, intervention_routes, research_routes, curriculum_routes, ai_hub_routes]:
    app.include_router(module.router, prefix='/api')
