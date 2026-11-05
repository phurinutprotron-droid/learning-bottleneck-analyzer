# Architecture and module map

See SYSTEM_ARCHITECTURE.md for the system boundary. This is a single deployable FastAPI application and a separate compiled React client, not a microservice architecture.

| Module | Responsibility |
| --- | --- |
| core | Environment settings, database unit of work, scrypt passwords, opaque sessions, structured logs |
| models/entities.py | Relational persistence; models grouped together to make foreign-key dependencies visible |
| schemas/contracts.py | Strict external input and AI-output contracts |
| subjects/base_pack.py | SubjectPack interface and item/rubric/provenance schemas |
| subjects/mathematics, subjects/science | Independently versioned sample content |
| subjects/registry.py | Registration and lookup, independent of the diagnostic engine |
| repositories/records.py | Ownership, consent, immutable snapshots, response access and audit helpers |
| diagnostics | Lexical observations, competing hypotheses and curated adaptive verification |
| knowledge_graph | Typed relationships, prerequisite traversal, cycle validation |
| analytics | Configurable heuristic scoring, descriptive statistics, agreement and reliability |
| interventions | Sample activity planning; teacher review and progress are persisted through API workflows |
| services | Provider-independent AI protocol, optional Gemini adapter and deterministic fallback |
| api | Authentication, assessments, diagnostics, verification, interventions and research endpoints |

SQLAlchemy models support SQLite and PostgreSQL. Alembic is the only production schema initialization path. Subject packs are validated at startup and stored as immutable JSON snapshots under subject:version. Startup refuses changed content under an existing version. Original answers have no update route and are protected against duplicate assessment/item writes. Diagnostic evidence and hypotheses are stored separately from responses. Verification appends a result; it does not overwrite the original inference.

The frontend stores a bearer token only in memory. Refreshing requires signing in again; theme preference alone uses localStorage. Vite proxies /api locally. Nginx serves the production build and proxies the same API in Compose. The API documents all contracts at /docs and /openapi.json.

One deployment is one trusted school/research team. Teacher role has access to all learner records in that deployment. Researchers see aggregates only. There is no multi-school tenancy or class assignment model yet. In-process rate limiting is a development defense, not a distributed limiter. Production work must add gateway limits, HTTPS, monitoring, and organization-specific authorization.
