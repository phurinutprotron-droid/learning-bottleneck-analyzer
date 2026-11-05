# System architecture

React/TypeScript/Vite UI → FastAPI API → application modules → SQLAlchemy unit of work → SQLite locally or PostgreSQL in deployment.

The backend is one modular monolith. Subject packs define immutable versioned concepts, relationships, items, scoring rubrics, verification items, and transfer tasks. The assessment module grades from approved pack keys. The evidence analyzer uses deterministic rubric matching and explicitly reports its lexical limitations. Diagnostics retain supporting and contradictory response IDs and generate competing explanations. The graph proposes prerequisite exploration; it never establishes causality. Heuristic priority scores expose every component. Verification uses curated discriminating items, not unreviewed AI output. Interventions require teacher review; retests preserve stage and version.

SQL tables store users and roles, anonymous learner IDs, consent, subject versions, assessment snapshots, original responses, evidence, hypothesis history, verification assignments, interventions, learning outcomes, and audit events. Foreign keys and API ownership checks protect records. Research exports exclude identifiers and free-text responses.

AI providers return schema-validated suggestions only. Gemini is configured entirely on the backend and validates its configured model against the provider model list. Failures return a labeled deterministic fallback. Prompts omit account and learner identifiers. AI cannot change deterministic scores or final labels.

Bearer sessions use random opaque tokens stored as hashes, expiration, and logout revocation; passwords use scrypt. Only CLI provisioning can create staff accounts. Students can self-register with anonymous handles. Consent gates assessment collection. Production requires HTTPS, school access governance, backup policy, monitoring, and reviewed content.
