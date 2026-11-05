# API reference

Interactive contracts: http://127.0.0.1:8000/docs. Machine-readable schema: /openapi.json. Prefix application paths with /api. Pass Authorization: Bearer <session-token>. Tokens expire after SESSION_HOURS and are revoked on logout.

| Method and path | Use / access |
| --- | --- |
| POST /auth/register | Anonymous student handle, password, grade; never accepts staff role |
| POST /auth/login; GET /auth/me; POST /auth/logout | Session lifecycle |
| GET /subjects | Versioned metadata without keys or rubrics, authenticated |
| GET /subjects/{id}/graph?concept_id=... | Relationship provenance and prerequisite exploration |
| GET /students | Teacher-only anonymous roster |
| GET /students/{id} | Own profile or teacher: assessments, activities, outcomes |
| POST /students/{id}/consent | Append current-version assent/withdrawal record |
| DELETE /students/{id} | Own account/learner data or teacher; irreversible; implement a user confirmation if exposing in UI |
| POST /students/{id}/assessments | Baseline or follow-up; consent required; follow-up requires completed intervention |
| GET /assessments/{id} | Own/teacher assessment; answer keys never returned |
| POST /assessments/{id}/responses | Original answer, reasoning, confidence (1–5); duplicate rejected |
| POST /assessments/{id}/complete | Requires all items; feedback and descriptive follow-up records |
| POST /assessments/{id}/diagnostics | Completed baseline → persisted rule-based diagnostic snapshot |
| GET /diagnostics/{id} | Evidence, initial hypotheses and appended verification history |
| GET /diagnostics/{id}/recommendations | Teacher-reviewed sample activity proposals |
| POST /diagnostics/{id}/verification | Select/resume one curated verification assessment |
| GET /assessments/{id}/verification | Recover diagnostic association when resuming verification |
| POST /verifications/{id}/evaluate | Evaluate completed verification; idempotent |
| POST /diagnostics/{id}/ai-assist | Teacher-only advisory operation; never changes outcomes |
| POST /interventions | Teacher assignment with baseline and review rationale |
| PATCH /interventions/{id} | Teacher completion/cancellation; completed history immutable |
| GET /research/summary | Teacher/researcher aggregate descriptive metrics |
| GET /research/export | Aggregate CSV without learner IDs or free text |
| POST /research/evaluate | Paired reference/predicted labels, optional ten-item SUS ratings; computed, not persisted |
| GET /health | Public database connectivity check |

Errors: 401 unauthenticated/expired; 403 role/ownership; 404 absent resource; 409 incomplete workflow/immutable response/consent/conflict; 422 invalid schema; 429 per-IP rate limit. No fabricated success is returned when an operation fails.

Research evaluation accepts {"reference_labels":["gap","none"],"predicted_labels":["gap","none"],"sus_responses":[]}. These are illustrative category pairs, not collected results. The AI operations are listed in PROMPTS/advisory-v1.md. The generated OpenAPI schema is exported to docs/openapi.json during verification.
