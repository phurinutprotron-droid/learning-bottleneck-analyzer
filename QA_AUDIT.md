# LBA 2.0 QA audit

Scope: existing local application, repository tests, local demo smoke test, and a live Gemini MCP call with synthetic observations. The supplied brief ends mid-word in phase 6. Findings cover the available text.

| Component | Classification | Evidence and limits |
| --- | --- | --- |
| Backend | Implemented and verified | FastAPI routes, SQLAlchemy persistence, explicit assessment and diagnostic services. API suite uses isolated SQLite databases. |
| Frontend | Implemented and verified | React and TypeScript build, form and role-view tests with mocked network, and live HTTP smoke. Full browser regression across devices remains unverified. |
| Database and migrations | Partially implemented | SQLite migration round-trip and model parity tested. PostgreSQL and container deployment were not exercised in this pass. |
| Authentication and authorization | Partially implemented | Scrypt hashes, hashed bearer sessions, expiry, revocation, role checks and student ownership tested. Demo teacher login tested live. Production provisioning and multi-school isolation remain unverified. |
| Classroom management | Missing | No classroom entity, roster import, membership or teacher-to-class authorization. Teachers have deployment-wide learner access. |
| Student and teacher workflows | Partially implemented | Consent, baseline, diagnostic run, verification, reviewed intervention and follow-up exercised through the API. UI tests cover form feedback, assent and profile rendering. |
| Assessment engine | Partially implemented | Sample multiple choice and short answers, lexical reasoning, confidence, versioned packs, history, and persistence. General semantic grading, image submissions and executable code are absent. |
| Diagnostic engine and ranking | Requires human validation | Deterministic rules and score arithmetic exercised on synthetic fixtures. No independent accuracy or calibration evidence. See ALGORITHM_AUDIT.md. |
| Knowledge graph | Partially implemented | Prerequisite traversal and cycle detection tested. Links have provenance fields. Relationship accuracy, dependency depth and conflicting-link handling remain open. |
| Adaptive verification | Partially implemented | Curated selection, idempotent pending assignment, exclusion of used items, contradictory updates and item exhaustion tested. No validated informativeness criterion or configurable burden budget. |
| Gemini and MCP | Broken for live generation | Live model lookup returned HTTP 200, generation returned HTTP 503. MCP handshake and fallback succeeded. Mock provider tests exercise valid output, invalid sources, malformed JSON, rate limits and timeout. |
| Curriculum intake | Partially implemented | Staff status endpoint and local PDF staging exist. Two listings point to identical bytes with conflicting revision labels. OCR and human verification are pending. There are zero verified indicators. |
| Coding | Partially implemented | Python variable state and loop boundaries through code tracing, with assessment and diagnostic integration tested. Code submission and sandbox execution are absent. |
| Analytics and reporting | Partially implemented | Learner progress, descriptive follow-ups, aggregate CSV, demo exclusion, reference agreement and exploratory reliability. Classroom reports, date filters and clustered inference are absent. |
| Security and privacy | Requires human validation | Access, expiry, demo exclusion, consent and cascade deletion have functional checks. Production hosting, retention, disclosure thresholds and research governance require review. |

## Priorities before a research pilot

1. Limit teachers to assigned learners before deploying across classes or schools. Restrict aggregate exports under an approved small-cell policy. Replace demo credentials in any shared deployment.
2. Separate repeated attempts from independent participants in research summaries. Current descriptive standard errors and reliability rows can count repeat observations from the same learner. Keep these summaries exploratory until the aggregation unit is corrected and validated.
3. Resolve curriculum revision conflicts, review extraction and have subject specialists approve item wording, rubrics and graph edges.
4. Validate stored hypothesis updates and score explanations across versions. Verification history currently relies on database retrieval order, and the displayed priority is recomputed from saved evidence. An explicit chronology and versioned replay are needed for strict historical reproducibility.
5. Expand browser and deployment coverage. Test concurrent diagnostic and verification assignment, session abuse, small-cohort exports and production PostgreSQL before claiming deployment readiness.

This audit supports a controlled software demonstration. Diagnostic accuracy, classroom effectiveness and research suitability still require the independent evidence described in RESEARCH_VALIDATION_PLAN.md.
