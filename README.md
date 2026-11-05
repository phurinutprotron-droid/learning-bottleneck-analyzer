# Learning Bottleneck Analyzer (LBA)

Online trial: https://phurinutprotron-droid.github.io/learning-bottleneck-analyzer/

The online API uses Cloudflare Workers and Neon PostgreSQL. Student registration is available; teacher credentials are provisioned privately. Demo accounts are disabled online. See [Cloudflare deployment and verification](docs/CLOUDFLARE_FREE.md) and [current build status](BUILD_STATUS.md). Content remains an unvalidated software/research MVP.

An integrated research MVP that connects original assessment responses to transparent evidence, competing hypotheses, curated verification, teacher-reviewed activities, and descriptive follow-up outcomes.

**Unvalidated sample content.** The mathematics and science packs are software demonstrations, not validated diagnostics. No participants, expert approvals, accuracy results, or causal effects are fabricated. Accounts are empty unless the opt-in demo script is run; that script seeds no answers or results. Use fictional answers until pilot safeguards and content review are completed.

## Quick start on this Windows machine

All project files are under `D:\learning-bottleneck-analyzer`. Python 3.12 and the virtual environment were installed inside this repository because Windows Store Python could not run in the sandbox. Node 24 is available on the machine. No global install is needed.

```powershell
cd D:\learning-bottleneck-analyzer
.\scripts\setup.ps1
```

The script installs locked Python/npm dependencies, creates `.env` from the example if absent, and runs migrations. It uses `uv` if available, otherwise an installed Python 3.12+ and pip. Workspace-local caches are configured. To install manually using an ordinary Python installation:

```powershell
cd D:\learning-bottleneck-analyzer
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.lock
Copy-Item .env.example .env
cd backend
..\.venv\Scripts\python.exe -m alembic upgrade head
cd ..\frontend
npm ci
```

Start the backend in one terminal:

```powershell
cd D:\learning-bottleneck-analyzer\backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --no-access-log
```

Start the frontend in another:

```powershell
cd D:\learning-bottleneck-analyzer\frontend
npm run dev -- --port 5173
```

Open **http://127.0.0.1:5173/**. Backend API docs: **http://127.0.0.1:8000/docs**. Health: **http://127.0.0.1:8000/health**. Run backend commands from `backend/` so the root `.env` and relative SQLite path resolve consistently.

## Accounts and demonstration

Local test logins have been provisioned for this installation:

| View | Handle | Local demo password |
| --- | --- | --- |
| Student | demo_student | LbaDemo!2026 |
| Teacher | demo_teacher | LbaDemo!2026 |
| Research | demo_researcher | LbaDemo!2026 |

These are shared development-only credentials. No test ID, school ID, name or email is needed. Sign in as the student, record demo assent, then start or resume Mathematics/Science. The teacher can select DEMO-LEARNER to review evidence. Ordinary research summaries/exports exclude demo accounts by default; use the explicit checkbox to include them for software testing. Demo records are labeled and are not research findings.

To provision them in another local development SQLite database, run `..\.venv\Scripts\python.exe ..\scripts\create_demo_accounts.py` from backend/. Existing passwords are preserved. The script seeds no answers, consent, scores or outcomes and refuses a production/PostgreSQL environment.

This session serves the compiled frontend on port 5173 with `scripts/serve_preview.py`, proxying /api to port 8000. To start that preview from the root, run `.\.venv\Scripts\python.exe scripts\serve_preview.py`. Use `npm run dev` instead while editing; run only one frontend server on port 5173.

UI UX Pro Max is installed project-locally. See docs/ui_ux_review.md for the applied changes and actual verification.

Create a student account from the sign-in page using a nickname and a password with at least ten characters. Staff accounts are deliberately not self-assignable. Provision them with a hidden password prompt:

```powershell
cd D:\learning-bottleneck-analyzer\backend
..\.venv\Scripts\python.exe -m app.cli create-staff --handle teacher --role teacher
..\.venv\Scripts\python.exe -m app.cli create-staff --handle researcher --role researcher
```

1. As a fictional learner, record demo assent and choose Mathematics or Science.
2. Complete all six baseline items, including reasoning and confidence. Answers are saved immutably; feedback appears at completion.
3. Explore the persisted observations, source answers, competing hypotheses, uncertainty and priority components. Request a distinct verification question and inspect how it supports, contradicts or leaves an explanation inconclusive.
4. Sign in as a teacher, select that learner, open their evidence, edit an activity and expected outcome, and record the review/override rationale before assignment.
5. Confirm activity completion as the teacher. The learner can then take targeted post and transfer tasks. Retention opens at least seven days later.
6. Inspect the learner outcomes or the research dashboard; export an aggregate CSV. Missing results remain empty. Research reference-label/SUS calculations require real externally collected data, and are not automatically populated.

Student accounts see only their records. Teachers see the deployment's anonymous roster. Researchers see aggregate metrics and graphs. This version uses a single-school trust boundary; multi-school/class isolation remains deployment work. Tokens are memory-only, so refresh signs you out.

## Checks

```powershell
cd D:\learning-bottleneck-analyzer
.\scripts\test.ps1
```

Individual checks:

```powershell
cd D:\learning-bottleneck-analyzer\backend
..\.venv\Scripts\python.exe -m pytest -q
..\.venv\Scripts\python.exe -m alembic check
cd ..\frontend
npm test
npm run build
npm audit
```

Tests cover the requested ten diagnostic scenarios, graph validation, confidence independence, ownership/RBAC, consent, immutable response storage, database migration round-trips, full pre→verification→intervention→post/transfer flow, research exports, AI schema/source/model/failure handling, and critical frontend forms and API error recovery. They use synthetic records only. Exact executed results and verification limits are in BUILD_STATUS.md.

## Gemini (optional)

In the root `.env`, set:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=your_private_key
GEMINI_MODEL=an_exact_model_id_available_to_your_key
```

Keep the key out of source control and the frontend. Do not copy the placeholder literally. Restart the backend after configuration changes. The adapter first checks the configured model's metadata and `generateContent` support, requests JSON-schema output, validates response citations and candidate rubric/objective/difficulty, and records model/prompt metadata. No model ID is hardcoded. Invalid output, timeouts, rate limits, missing configuration and API failures return a labeled deterministic fallback. Teacher “Advisory assistance” exercises the provider. Other operations are available through the API.

AI suggestions do not change deterministic evidence, scores or diagnostic decisions. Generated candidate questions cannot be delivered automatically: qualified review and a new released subject-pack version are required. The privacy-minimized context omits raw student text and stable identities; reasoning assistance therefore uses rubric observations. See [the provider contract](PROMPTS/advisory-v1.md) and [Google's structured-output documentation](https://ai.google.dev/gemini-api/docs/structured-output). The supplied key is configured privately for gemini-3.8-flash: model metadata access returned HTTP 200, but generation returned HTTP 503 and timed out on a later attempt. Successful live generation is not verified; failures use the labeled deterministic fallback.

## Docker / PostgreSQL

Requires Docker Desktop with Compose. Add a strong URL-safe `POSTGRES_PASSWORD` to the root `.env` (alphanumeric random passwords avoid connection-URL escaping issues):

```powershell
cd D:\learning-bottleneck-analyzer
docker compose up --build -d
docker compose exec backend python -m app.cli create-staff --handle teacher --role teacher
```

Open **http://localhost:8080/**. API docs remain at **http://localhost:8000/docs**. Database storage uses a named volume. Stop with `docker compose down` (preserves that volume). Deploy behind reviewed HTTPS/auth/network/backup controls before external access. Docker/PostgreSQL execution requires Docker and was not validated on this machine if unavailable; see the build status. For direct PostgreSQL use, set `DATABASE_URL=postgresql+psycopg://...` and run the same Alembic migration commands.

## Design and research records

- [21-day sequencing](DEVELOPMENT_PLAN.md), [architecture](SYSTEM_ARCHITECTURE.md), [module map](docs/architecture.md), [rules](PROJECT_RULES.md)
- [Diagnostic method](docs/diagnostic_method.md), [pack contract](docs/subject_pack_spec.md), [API reference](docs/api_reference.md)
- [Privacy, consent, retention and deployment boundary](docs/privacy_and_security.md)
- [Research methodology](research/methodology.md), [hypotheses](research/hypotheses.md), [experiment protocol](research/experiment_design.md), [metrics](research/metrics.md), [data dictionary](research/data_dictionary.md)

Direct Python requirements and the complete resolved lock are committed; `package-lock.json` freezes npm resolution. Current compatibility and audit results are recorded in BUILD_STATUS.md. The 21-day plan is a roadmap followed in dependency order, not a claim that 21 calendar days of validation have occurred.

Before real-world use: review curricular/linguistic content and prerequisite claims, replace lexical reasoning scoring or validate it against blinded experts, calibrate sample forms, establish lawful consent and privacy processes for minors, scope staff to classes/schools, validate PostgreSQL deployment and recovery, and execute the preregistered pilot. Software tests do not establish educational validity.

For public hosting, see the [LBA deployment guide](docs/DEPLOYMENT.md).
