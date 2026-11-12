# LBA build status

## One hundred simulated students — 2026-11-12

- Imported 100 explicitly synthetic, login-disabled student identities into the existing online Neon database. Grades 7/8/9: 34/33/33. Ten not started, fifteen in progress and seventy-five with completed mathematics/science sample baselines.
- Persisted 165 assessments (150 complete, 15 open) and 933 generated responses graded by existing rules. Existing subject snapshots and all nine pre-existing user rows were preserved.
- Demo flags exclude the cohort from ordinary production student/research views. Research staff can explicitly include demo records. No human consent, AI review, diagnostic completion, intervention or learning gain was fabricated.
- Full local backend suite: 49 passed, including five new cohort tests. Live database counts verified; synthetic sign-in returned 401, health returned 200, and no synthetic sessions/consents were created. See [dataset and reproduction details](docs/SIMULATED_STUDENTS.md).


## Smooth selection and content entry — 2026-11-11

- Added one persistent sliding highlight for the sign-in portal, workspace navigation and Home activity-period controls. Button bounds, responsive changes, language changes and mobile scrolling are measured directly.
- Content uses subtle directional entry. Navigation stays mounted while lazy content loads. Reduced motion keeps a static highlight and opacity-only feedback.
- All 18 frontend tests and the production build passed. Local Chromium checked six intermediate slides, rapid retargeting, language changes,320/390/1440px layouts and reduced-motion styles with no runtime exceptions. Independent review found no blocking issue.
- Published in Pages run 43034372237; fresh dependency installation, all 18 frontend tests, production build and public asset checks passed. The independent native Chromium probe also passed against the deployed HTTPS site, including six intermediate slides, final alignment, rapid retargeting, language changes, responsive navigation and reduced motion.
- Automated live browser run 43034502820 failed before application tests: the runner could not resolve Ubuntu package mirrors while installing browser fonts. A rerun was requested. This infrastructure failure is separate from the completed direct live UI verification.


## Judge entry and request-bound loading — 2026-11-10

- Added a public judge sign-in page with prefilled convenience credentials and student/teacher/researcher views. The view is an isolated, read-only frontend demonstration using labelled example data. Production accounts, sessions and student records are not exposed.
- Added branded boot, pending/skeleton and login loading states tied to real request lifetimes, with static reduced-motion alternatives and no simulated completion percentages.
- Eighteen frontend tests passed. Local Chromium checked 36 captures at 320/390/1440px, zero preview API network requests, loading/error transitions and reduced motion. Independent source and screenshot review found no blocking issue.
- Published in Pages run 42838667779. Live browser run 42839378675 passed the judge link, prefilled credentials, all three views, research filtering and zero backend record requests; the backend returned 401 for the public preview token. Normal student registration/CORS/Home and cleanup also passed. [Preview boundaries and verification](docs/JUDGES.md).


## Shared interface rollout — 2026-11-10

- The owner approved the learner Home style for all pages. Shared materials now cover all three sign-in portals, registration, student/teacher/research workspaces, assessment/evidence/AI controls, curriculum/exam drafting, graph and graph dialogs.
- Nine frontend tests passed and the release source passed TypeScript and Vite build. Local synthetic-fixture Chromium checks passed 29 role/page states at 320/390/1440px, 87 captures, with no document overflow or runtime exceptions.
- The graph refits on resize, including All subjects on a 320px phone. Mobile teacher destinations remain reachable through the horizontally scrollable labelled dock.
- Published successfully in Pages run 42832405913. Live browser run 42832665301 passed registration, actual backend/CORS calls, Home rendering and mobile layout, then erased its synthetic account. [Interface implementation and review scope](docs/UI_SYSTEM.md).


## Current phase
The research MVP follows the dependency order of the original 21-day plan. Cloudflare/Neon deployment has passed live API integration and production HTTPS/auth/CORS checks. The online variant preserves the Python implementation as the reference and uses a native Worker for hosting. The published GitHub Pages frontend has passed actual browser registration, CORS, dashboard rendering and mobile layout checks. This is software validation, not 21 calendar days of research validation.

## Latest Cloudflare verification — 2026-11-05

- Backend: **61 tests passed** against PostgreSQL 17, including the original SDK/server path and database password support.
- Native Worker: **14 tests passed**, comparing 168 grading cases, 36 diagnostic patterns, 48 seeded exam cases and 12 research-statistics cases with Python, plus validation, HMAC, pricing/auto-routing and AI failure handling.
- Live native flow passed in [run 42035637987, attempt 2](https://github.com/phurinutprotron-droid/learning-bottleneck-analyzer/actions/runs/42035637987).
- Production HTTPS, authentication, exact CORS, ownership, portal separation and logout passed in [run 42042275837](https://github.com/phurinutprotron-droid/learning-bottleneck-analyzer/actions/runs/42042275837).
- Production database revision is 0004. lba_runtime has no superuser/role-creation/database-creation/RLS-bypass privileges. Demo accounts cannot authenticate and are excluded from the online roster/default research summary.
- The prelaunch recovery branch was read and written in isolation; production was unchanged. This does not establish a tested production point-in-time failover or an automatic backup schedule.
- Successful live Gemini generation, sustained classroom load, native CPU behavior under quota exhaustion, independent content review and research validation remain open.
- [Cloudflare deployment, commands, monitoring and recovery procedures](docs/CLOUDFLARE_FREE.md).

- Frontend: **7 tests and the production build passed**, followed by successful Pages publication in run 42045112823.
- Actual live-browser verification passed in [run 42050347016](https://github.com/phurinutprotron-droid/learning-bottleneck-analyzer/actions/runs/42050347016): registration, cross-origin API calls, rendered dashboard, desktop/mobile screenshots and no horizontal mobile overflow. Its own synthetic account was erased through the authenticated API.
- Repeatable native build run 42050347100 and production smoke run 42050347115 passed. A database check confirmed no users remained for these two final synthetic checks.
- Public routes for the experimental integration Workers are disabled; the production lba-api route remains enabled.

## Prioritized tasks
- [x] Inspect workspace (empty) and verify write access.
- [x] Record architecture, rules, and development plan.
- [x] Database models, four migrations, authentication, ownership and consent.
- [x] Versioned mathematics/science subject packs and assessment flow.
- [x] Deterministic evidence and competing diagnostic hypotheses.
- [x] Provenance-bearing knowledge graph, cross-subject view, heuristic priority and verification.
- [x] Teacher-reviewed intervention, targeted retest, transfer and delayed retention.
- [x] Optional Gemini adapter with schema/source validation and deterministic fallback.
- [x] Student, teacher and research interfaces with explicit empty states.
- [x] Supplied UI UX Pro Max skill installed project-locally; readability, responsive layout and form feedback improvements applied.
- [x] Demonstration logins, explicit database demo flag and default exclusion of demo records from research/exports.
- [x] Automated checks, Docker configuration, setup/test scripts, API and research documentation.
- [x] PostgreSQL 17 migrations, scoped runtime grants, production HTTP/auth/CORS and native Cloudflare learning workflows.
- [ ] Docker Compose execution (optional Python hosting path; not exercised for the Cloudflare deployment).
- [ ] Successful live Gemini generation (model metadata accessible; generation returned 503 and timed out).
- [ ] Content review, privacy/ethics preparation and independent real-world pilot.

## Historical local verification
- Latest QA pass: 33 backend tests, 7 frontend tests, Alembic drift check and production build passed. Live student, teacher and researcher demo login, authorized access and logout passed.
- New diagnostic runs use rules-v2, which fixes reasoning-gap detection for mixed correct and incorrect responses. Scoring now rejects non-finite weights. Existing diagnostic snapshots were retained.
- Live Gemini MCP: tool discovery and invocation passed, Google model lookup returned HTTP 200, generation returned HTTP 503, and the labeled fallback was returned.
- Detailed findings and research limits are recorded in QA_AUDIT.md, SYSTEM_TEST_MATRIX.md, ALGORITHM_AUDIT.md and RESEARCH_VALIDATION_PLAN.md.
- Backend: 29 tests passed, including ten diagnostic scenarios, confidence independence, RBAC/ownership, consent, immutable answers, integrated pre→verification→intervention→post/transfer flow, deletion, migration roundtrip/parity, demo-data exclusion and AI failure validation.
- Frontend: six critical form/API-flow tests passed, including linked-error focus and completion retry without duplicate submissions.
- TypeScript and Vite production build passed. Main, graph and research code are split into separate bundles.
- Alembic drift check: no new upgrade operations detected.
- Python dependency audit previously clean after dependency updates; npm audit clean after dependency restoration, including current production-dependency audit.
- Live smoke checks: frontend HTTP 200, backend health OK, all three demo accounts passed sign-in, correct-role record access and logout.
- Browser: student demo login verified; demonstration notice visible; desktop and 375 px layouts visually checked. Mobile body text measured 16 px and no document-wide horizontal overflow. Existing demo answers were preserved.
- One dependency warning remains: Starlette's TestClient deprecates the httpx transport in favor of httpx2. Tests still pass; migration is follow-up maintenance.

## Local testing
Open http://127.0.0.1:5173/. Handles: demo_student, demo_teacher, demo_researcher. Password for these local demo accounts: LbaDemo!2026. They are explicitly demonstration-only, and no performance results were seeded. Responses entered by the user are retained normally and remain flagged as demonstration data.

The compiled build is served by scripts/serve_preview.py, with /api proxied to the backend on 8000. The npm dependency installation was repaired. README.md contains development, testing and Docker commands. No Git commit, remote push or external deployment was performed.

## Gemini configuration
The supplied key is stored only in ignored .env. AI_PROVIDER=gemini and GEMINI_MODEL=gemini-3.8-flash. Google model metadata returned HTTP 200 and reported generateContent support. A structured generation request returned HTTP 503; a second generation request timed out. Do not claim successful live generation. Deterministic assessment/diagnostics remain independent of Gemini, and the provider's labeled fallback handles API failures. No student prose or identities were sent in these connection tests.

## Evidence and limitations
No educational validity or causal effectiveness established. No real student data supplied.
Subject content, prerequisite links and lexical reasoning rules are unvalidated samples. Heuristic support and priority are not calibrated probabilities. One deployment trusts one school/team; class-level multi-tenancy is not implemented. Research randomization/adjudication, automatic retention deletion, production monitoring and validated infrastructure recovery remain pilot/deployment work. Documentation distinguishes observations, inference, verification support and descriptive outcomes from causal conclusions.

## Gemini Python SDK migration

- Migrated the backend and local stdio MCP bridge to the shared Google Gen AI Python SDK provider (google-genai 2.34.0). Kept schema validation, evidence checks, teacher review, and deterministic fallback.
- Backend suite: 35 passed. SDK transport tests cover successful generation, malformed or empty responses, invalid evidence, rate limits, service unavailability, and timeouts.
- Live MCP with synthetic outcomes: model metadata returned HTTP 200 for gemini-3.8-flash. The generation request returned HTTP 504; MCP reported deterministic fallback. Live Gemini generation remains unverified.

## Gemini timeout hardening and deployment preparation

- Three direct SDK generation probes bypassing MCP used a one-word synthetic prompt, 64 output tokens, and a 25-second SDK timeout. Google API responses were HTTP 504 DEADLINE_EXCEEDED at 23.89, 23.56, and 23.88 seconds. The underlying Google component is unknown and no generation succeeded.
- Transient SDK failures now have three 18-second attempt windows with exponential jitter capped at 1.5 seconds total. MCP remains at 60 seconds. Preview and Nginx proxy read timeouts are 75 seconds. Backend and MCP logs record correlation IDs, attempt duration, and failure details without recording prompts or credentials.
- Full backend suite: 40 passed with the existing Starlette TestClient deprecation warning. Two fresh backend processes loaded SDK 2.34.0 and returned health 200 against a newly migrated SQLite database through the ASGI test client. A separate loopback Uvicorn probe timed out, so the running preview was not restarted or verified over TCP.
- Added production environment template, strict CORS validation, database readiness failure handling, and demo account restrictions. PostgreSQL Alembic SQL rendered successfully offline. Live PostgreSQL and Compose were not verified on this host.

## Production readiness investigation

Direct Gemini REST probes used the configured server-side key, v1beta, no environment proxy, a 32-second client timeout, and a synthetic one-word prompt. Probe IDs below were generated locally. The responses did not expose an upstream request ID in the checked headers.

| Model | Operation | Result | Seconds | Local probe ID |
| --- | --- | --- | ---: | --- |
| gemini-3.8-flash | Lookup | 200, generateContent supported | 0.203 | 7ce96d24-3f6c-45b6-a194-9feade7d5815 |
| gemini-3.8-flash | Generate | 429 RESOURCE_EXHAUSTED | 0.297 | 2b83caff-b537-4dcc-8d7b-623bc2af436f |
| gemini-3.5-flash-lite | Lookup | 200, generateContent supported | 0.125 | c0141a23-fd90-4151-8da7-a4c28f480a1c |
| gemini-3.5-flash-lite | Generate | 200, generated text | 14.578 | 7f16ffb2-5922-4d1e-a224-893ac980cc43 |
| gemini-3.8-flash | Quota confirmation | 429, free-tier per-project/per-model daily request quota of 20, retry delay 57022s | 0.484 | 086729a2-ff03-4abb-afab-91abc4391b41 |

The latest blocker for the configured model is Google-reported quota exhaustion. Earlier 504 DEADLINE_EXCEEDED responses were received from the upstream API. Their underlying cause remains unknown. AI Studio's status page did not expose readable status here and private billing and limits were not independently accessed. The alternate-model probe made no persistent configuration change.

The standard backend port was occupied during this audit. An isolated Uvicorn listener on an OS-assigned loopback port started and shut down cleanly. The built frontend preview and its API proxy reached that listener. Health, CORS allow and deny cases, teacher and student permissions, cross-student denial, and demo password and token rejection under the production auth policy passed against a clean migrated SQLite database. Production settings validated separately. SQLite backup and restore matched the synthetic source, passed integrity and foreign-key checks, and retained Alembic head. The configured Gemini key was absent from the built frontend.

Added structured lifecycle, readiness-failure and request monitoring with route templates and exception type names. Full backend suite: 40 passed with the existing Starlette warning. Frontend: 7 passed and production build succeeded. Docker and PostgreSQL executables were unavailable. Compose validation, live PostgreSQL migration and restore, public HTTPS integration, and production deployment remain outstanding.

## OpenRouter, role-specific sign-in, and motion tuning

- Added separate student, teacher, and researcher sign-in views and server-side role checks before issuing portal sessions. The built preview served the teacher page and health endpoint. Live demo teacher sign-in returned 200 through the teacher portal and 403 through the student portal.
- Tuned shared easing and timing and added a short portal transition with reduced-motion support. Frontend suite: 7 passed and production build succeeded.
- OpenRouter advisory routing uses exact configurable model IDs and optional task overrides. A live Crouton Alpha structured advisory passed LBA validation in 11.609 seconds. The teacher-only catalog found the model with its zero prompt and completion pricing. The configured key was absent from the built frontend.
- The listed Nemotron 3 Ultra free route returned HTTP 404 for the synthetic probe with provider data collection denied. Its catalog entry did not advertise structured outputs. The paid route was not tested.
- Separate Groq, multi-model comparison, and the full admin control center remain future AI Hub phases.

## Teacher model picker

- The teacher evidence panel supports five advisory tasks with separate model selections during the current view. The OpenRouter catalog is searchable by family in the picker, with structured text capability and pricing shown.
- The server validates explicit selections against the current catalog and requires confirmation before sending a request to a paid model. The existing server default and deterministic assessment scoring remain in place.
- Live catalog contained Nemotron 3 Ultra, Qwen, DeepSeek, Mistral, Llama, and Cohere. The free Nemotron 3 Ultra entry lacked structured-output support. Catalog discovery does not verify generation access for every model.
- Verification: 42 backend tests and 7 frontend tests passed. Frontend production build succeeded.

## Automatic advisory model selection

- The teacher picker defaults to Auto and ranks free, named models that support structured text. It respects eligible task overrides and uses reasoning metadata to match the task. Manual selection and paid confirmation remain available.
- Auto falls back locally if the catalog or selected provider is unavailable. It does not route to a paid model. The advisory panel shows the requested model when it differs from the result.
- The current live catalog selected Crouton Alpha for all four sampled tasks. Mocked catalog integration coverage verified distinct selections by task, exclusion of paid models, and local fallback when discovery fails. Backend: 42 passed. Frontend: 7 passed and build succeeded.

## Curriculum-aligned exam drafts

- Teacher-only exam generator covers three Mathematics M.1 indicators matched to the OBEC B.E. 2560 revision: ค 1.1 ม.1/1, ค 1.1 ม.1/3, and ค 1.3 ม.1/1. Each draft carries the official source link, template version, and seed. Items are original template variants with calculated answer keys.
- The Curriculum intake page allows 1–20 multiple-choice questions, review of each solution, and separate UTF-8 question and answer downloads after teacher acknowledgement. Drafts are not assigned to students automatically.
- Backend: 43 passed. Frontend: 7 passed and production build succeeded. An independent prompt-based calculation confirmed all answer keys in 1,200 generated items across the three templates.

## Qwen exam drafts for lower secondary

- Curriculum intake supports Qwen 3.6 27B exam drafts for M.1–M.3, the eight learning areas, and history. Teachers provide a code and excerpt from the official OBEC source and confirm possible charges. Excerpts are teacher-supplied and require review against the original document. The verified M.1 mathematics templates remain available.
- Drafts validate count, unique prompts, four distinct choices, and answer indices. Teachers review the questions and answer key before exporting. Drafts are not assigned or graded in LBA.
- The diagnostic evidence panel includes an explicit Gemini reasoning analysis action for existing LBA assessments. It uses pseudonymous evidence and keeps deterministic fallback and teacher review.
- A live Qwen request returned one schema-valid question. Backend: 44 passed. Frontend: 7 passed and production build succeeded.
- Live Gemini 3.8 Flash evidence probe exhausted retries and returned the local fallback. The final provider error was HTTP 503.

## Bilingual learner home

- Student Home displays subjects as roots and concepts as branches. Status is derived from saved response item IDs. Selecting a subject resumes an open baseline or starts one after consent. Assessment history remains in the separate learning profile.
- Added a persistent English/Thai selector for sign-in, navigation, Home, and core assessment controls. Source questions and some advanced screen text still use their original language.
- Frontend: 7 passed, including real-response branch state, language switching, and direct resume from Home. Production build succeeded.

## GitHub Pages prepared copy

This copy includes a Pages workflow, project-path asset handling, and optional VITE_API_BASE_URL configuration for a separately hosted backend. Publication is pending creation of the target GitHub repository and activation of Pages.

Pages preparation checks: 7 frontend tests passed. The build for /learning-bottleneck-analyzer/ succeeded and emitted HTML asset paths resolve in dist. GitHub upload was denied with 403 Resource not accessible by integration before any branch update.
