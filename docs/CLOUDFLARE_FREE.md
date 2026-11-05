# Cloudflare Free deployment

Updated 2026-11-05. Public backend: https://lba-api.lba-phurinut.workers.dev

## Architecture

The existing React frontend stays on GitHub Pages. The online API runs as a native JavaScript Cloudflare Worker in Singapore, connects through Hyperdrive to Neon PostgreSQL 17, and uses the existing Alembic schema. The Python FastAPI application, google-genai 2.34.0 adapter, algorithms and test suite remain in the repository as the server implementation and reference for edge parity.

Python Workers were tested, including real registration, authentication, role checks and database access. Their CPU use was unsuitable for the Free budget. The production edge runtime therefore uses pg and native Web Crypto. Approved packs, schemas, curriculum metadata and synthetic parity fixtures are exported from Python at build time; student records are never bundled.

Cloudflare hosting and the Neon organization use the selected free services. No paid hosting subscription was enabled. Provider AI billing is separate: automatic model selection considers verified free catalog entries; paid manual models and Qwen exam drafts require the existing explicit confirmation. The default adviser remains deterministic.

## Verified checks

- 61 backend tests passed against PostgreSQL 17, including both the original SQLAlchemy pin and the Python Worker compatibility pin.
- 14 native tests passed: 168 grading cases, 36 diagnostic/verification patterns, 48 seeded exam cases, 12 research-statistic cases, Unicode/rounding parity, HMAC parity, schema/size controls, free-model selection and AI 504/timeout handling.
- Live native integration run 42035637987, attempt 2, passed registration, demo-account denial, teacher/student portals, ownership, answer immutability, baseline completion, diagnostics, verification, teacher interventions, follow-up, delayed retention rejection, aggregate research export, seeded exams and logout.
- Production HTTPS/auth/CORS smoke run 42042275837 passed with a private random synthetic password. Its account was subsequently marked as demo.
- Frontend tests (7), production build and GitHub Pages publication passed in run 42045112823. Actual browser run 42050347016 passed live registration, API connectivity/CORS, dashboard rendering and desktop/mobile layout. Screenshots contain synthetic data only.
- Final production smoke run 42050347115 passed login, logout, portal/ownership checks and authenticated erasure of its own synthetic account; the browser check also erased its own account. The corresponding QA users were absent in a subsequent production database check.
- Native artifact build run 42050347100 passed with repeatable publication. Public integration/prototype Worker routes are disabled.
- Clean Neon migrations reached revision 0004. Runtime role lba_runtime has application read/write grants and no superuser, role-creation, database-creation or RLS-bypass capability.
- A prelaunch recovery branch was read successfully at revision 0004; a write on that branch did not create a table in production.
- Existing Google/OpenRouter keys are configured as Worker secrets. Successful live Gemini generation has NOT been established by these deployment tests.

The service is available for software trials. Classroom load, sustained CPU behavior, quota exhaustion, independent content review and a formal research pilot remain unverified. Do not treat successful functional checks as a capacity or research-validity claim. Free Workers have a nominal CPU budget; measured native requests include values above it. No paid-plan workaround was enabled.

## Reproduce the build

Use Python 3.12 and Node 24. From the repository root:

```sh
cd backend
python -m pip install -r requirements.lock
python -m pytest -q
python -m app.export_worker --out ../cloudflare/edge/generated
cd ../cloudflare/edge
npm ci
npm test
npm run build
```

The generated content and dependencies are ignored by Git. GitHub Actions builds the public Worker artifact on main and cloudflare-free; compiled artifacts contain source/content only, with no database URL, password, pepper or API keys.

## Deploy a new backend version

The live deployment was performed through the connected Cloudflare account. For a CLI deployment, authenticate Wrangler to the intended account and use the committed production environment:

```sh
cd cloudflare/edge
npx wrangler deploy --env production
```

The production environment declares the actual Hyperdrive ID, exact Pages CORS origin, rate-limit bindings and required password-pepper secret. Existing secrets must be retained. Set or change secrets through interactive input, never command arguments:

```sh
npx wrangler secret put PASSWORD_PEPPER --env production
npx wrangler secret put GEMINI_API_KEY --env production
npx wrangler secret put OPENROUTER_API_KEY --env production
```

Do not replace an established pepper: existing edge password hashes require it. An authorized password-reset/migration procedure is required to rotate it. Database URLs and provider keys must never be VITE_ variables.

Frontend deployments run through .github/workflows/pages.yml on main. That build supplies the public HTTPS backend origin. The frontend and backend do not share secret environment variables. Backend artifact builds are automated; publishing a backend version still requires the connected Cloudflare account or an explicitly configured deployment credential.

## Database migrations and staff accounts

Use the direct owner connection for migrations, supplied privately in the process environment:

```sh
cd backend
python -m alembic upgrade head
```

The Worker uses the separate scoped lba_runtime credential through Hyperdrive. Query caching is disabled for authentication and mutable educational data.

For an additional staff account, provide the correct direct connection, PASSWORD_HASH_BACKEND=postgres_bcrypt and the existing PASSWORD_PEPPER privately in the process environment, then run:

```sh
python -m app.cli create-staff --handle new_teacher --role teacher
```

The CLI prompts for the password. Public registration always creates a student; production demo accounts cannot authenticate. The initial owner teacher handle is lba_teacher; its password is not stored in this repository.

## Backup and recovery

The prelaunch branch prelaunch-recovery-2026-11-05 is an isolated copy, not an automatic backup schedule. Its ID is br-weathered-violet-b3g29w0f. The project reported a six-hour history window when provisioned; check the current console before relying on any recovery window.

Before migrations or imports, create a dated branch/backup and verify revision and row counts. For development with real learner data, use schema-only or deidentified branches; the integration data here is synthetic.

To recover, create a separate branch from the chosen backup/history point, verify migrations and counts, test health/auth/ownership against it, then deliberately point a replacement Hyperdrive configuration at that verified branch. Never reset the production branch as a routine test. The isolated copy/read/write check passed; a full production point-in-time failover was not executed.

Preserve the password pepper and provider secrets in an encrypted secret backup separately from the database. A database copy alone cannot recover peppered credentials. Local provisioning backups are under the ignored .cache directory of the deployment workspace; they must not be uploaded or committed.

## Monitoring and rollback

Structured logs contain event name, route template, method/status, request ID, elapsed duration and failure category. Student answers, reasoning, passwords, tokens and keys are not logged. Production logs/traces are sampled; rate-limit bindings protect application and authentication requests.

Check /health, Worker errors/CPU metrics and Neon consumption. Link incidents to X-Request-ID and the Worker source tag. An AI fallback is reported as fallback, with upstream HTTP failures distinguished from client timeouts.

Worker-version rollback does not restore the database. Restore schema/data only through a separately verified recovery branch and a deliberate connection cutover. Docker Compose and the alternative Render deployment are not part of the verified Cloudflare path.

## References

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/hyperdrive/platform/pricing/
- https://neon.com/docs/extensions/pgcrypto
- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
