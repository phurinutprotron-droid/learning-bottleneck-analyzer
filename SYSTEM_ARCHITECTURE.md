# System architecture

React/TypeScript/Vite UI → FastAPI API → application modules → SQLAlchemy unit of work → SQLite locally or PostgreSQL in deployment.

The backend is one modular monolith. Subject packs define immutable versioned concepts, relationships, items, scoring rubrics, verification items, and transfer tasks. The assessment module grades from approved pack keys. The evidence analyzer uses deterministic rubric matching and explicitly reports its lexical limitations. Diagnostics retain supporting and contradictory response IDs and generate competing explanations. The graph proposes prerequisite exploration; it never establishes causality. Heuristic priority scores expose every component. Verification uses curated discriminating items, not unreviewed AI output. Interventions require teacher review; retests preserve stage and version.

SQL tables store users and roles, anonymous learner IDs, consent, subject versions, assessment snapshots, original responses, evidence, hypothesis history, verification assignments, interventions, learning outcomes, and audit events. Foreign keys and API ownership checks protect records. Research exports exclude identifiers and free-text responses.

AI providers return schema-validated suggestions only. Gemini is configured entirely on the backend and validates its configured model against the provider model list. Failures return a labeled deterministic fallback. Prompts omit account and learner identifiers. AI cannot change deterministic scores or final labels.

Bearer sessions use random opaque tokens stored as hashes, expiration, and logout revocation; passwords use scrypt. Only CLI provisioning can create staff accounts. Students can self-register with anonymous handles. Consent gates assessment collection. Production requires HTTPS, school access governance, backup policy, monitoring, and reviewed content.


## Online Cloudflare variant

The public frontend remains React/Vite on GitHub Pages. A native JavaScript Worker uses pg through Hyperdrive and the same Alembic PostgreSQL schema. Approved content, request schemas and synthetic algorithm-parity fixtures are exported from the Python implementation at build time. The Python FastAPI and google-genai SDK paths remain available and tested. Online Gemini calls use bounded REST transport to avoid Python runtime overhead. Provider keys and the password pepper exist only as server-side secrets. See docs/CLOUDFLARE_FREE.md for the verified scope and remaining limits.
