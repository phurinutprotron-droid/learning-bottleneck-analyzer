# Deploy LBA

The public deployment uses the [Cloudflare Free guide](CLOUDFLARE_FREE.md). It documents the native Worker, existing PostgreSQL schema, private secrets, current checks and recovery procedure. The Python-server instructions below remain available for the reference server architecture.

The Compose stack runs PostgreSQL 17, the FastAPI backend, and the React build served by Nginx. The browser uses the same origin for the SPA and API. Place an HTTPS reverse proxy in front of the frontend listener at 127.0.0.1:8080. Keep both published Compose listeners on loopback and keep PostgreSQL on the private Compose network.

1. Copy .env.production.example to .env.production. Generate a strong hexadecimal POSTGRES_PASSWORD so it can be inserted into the database URL without escaping. Keep this file private and out of source control.
2. Leave CORS_ORIGINS=[] for a same-origin deployment. If separately hosting the API for another browser origin, set it to a JSON list of exact HTTPS origins. Configure that origin and routing deliberately. The supplied frontend uses same-origin API requests.
3. Keep AI_PROVIDER=deterministic until ready to enable Gemini. To enable it, set AI_PROVIDER=gemini, GEMINI_MODEL and GEMINI_API_KEY in the server environment. Compose injects them into the backend only. Do not add them as Vite build variables.
4. Run the following commands from the repository root.

       docker compose --env-file .env.production up --build -d
       docker compose --env-file .env.production ps
       docker compose --env-file .env.production exec backend alembic current
       curl --fail https://YOUR_HOST/health

   The backend applies Alembic migrations before starting. Expect Alembic revision 0003 (head) and a 200 health response. An established backend returns 503 when its database check fails. Back up the PostgreSQL volume before upgrades and verify restores against a separate instance.
5. Provision a teacher through the backend CLI. It prompts for the password. Students self-register through the application. Staff roles are assigned only by the operator and demo accounts cannot authenticate in production.

       docker compose --env-file .env.production exec backend python -m app.cli create-staff --handle teacher_one --role teacher

Verify an unauthenticated request to /api/students returns 401, a student bearer token receives 403 for the same route, and a teacher token succeeds. The existing teacher role has access to all student records in this instance. Use a separate instance per institution if those records must be isolated.

Use at least a 75-second upstream response timeout on the HTTPS proxy. The provider allows three attempts of up to 18 seconds each, with up to 1.5 seconds total backoff. The local preview and Compose Nginx proxy allow 75 seconds, and the Codex MCP client allows 60 seconds. Uvicorn keep-alive is an idle connection setting. The backend logs the same request ID as its X-Request-ID response header and includes attempt duration, phase and HTTP status when available. The MCP bridge emits structured logs on stderr with a generated request ID per advisory call.

## Production launch and verification

From the repository root on the target host, create the private environment file
with cp .env.production.example .env.production (or Copy-Item on PowerShell).
Set POSTGRES_PASSWORD, use CORS_ORIGINS=[] for same-origin hosting, and leave
AI_PROVIDER=deterministic while validating the stack. Use a valid DNS name and
TLS certificate on the host reverse proxy. Forward to 127.0.0.1:8080 and set
the proxy upstream read timeout to at least 75 seconds.

    docker compose --env-file .env.production config --quiet
    docker compose --env-file .env.production up --build -d --wait
    docker compose --env-file .env.production exec -T backend alembic current
    curl --fail https://YOUR_HOST/health
    docker compose --env-file .env.production exec backend python -m app.cli create-staff --handle teacher_one --role teacher

The backend image starts with this command inside the container:

    alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log

Before external access, sign in through the HTTPS site with synthetic teacher
and student accounts. Verify own-record access, denial of another student's
record, and denial of teacher endpoints to students. Confirm both new and
previously issued demo credentials are rejected. Verify the HTTPS proxy and
Nginx preserve the X-Request-ID header. Configure external monitoring for
/health and alert on sustained 5xx, readiness_failed, and ai_fallback events.
Application JSON logs include route templates and durations. Keep proxy access
logs free of credentials, request bodies and query strings.

## Backup and restore drill

Run these commands with Docker Compose on the target host. Use a protected
backup directory and a new filename each time. The dump contains student data
and authentication records. Encrypt it and store a copy off the host with
restricted access.

    docker compose --env-file .env.production exec -T db pg_dump -U lba -d lba -Fc -f /tmp/lba-backup.dump
    docker compose --env-file .env.production cp db:/tmp/lba-backup.dump ./lba-backup.dump
    docker compose --env-file .env.production exec -T db rm -f /tmp/lba-backup.dump

Restore into a separate private PostgreSQL instance of a compatible version.
Here lba-restore-db is an already running disposable PostgreSQL container with
the lba role. Use a fresh lba_restore database for each drill.

    docker cp ./lba-backup.dump lba-restore-db:/tmp/lba-backup.dump
    docker exec lba-restore-db createdb -U lba lba_restore
    docker exec lba-restore-db pg_restore --exit-on-error --single-transaction --no-owner --no-acl -U lba -d lba_restore /tmp/lba-backup.dump
    docker exec lba-restore-db psql -v ON_ERROR_STOP=1 -U lba -d lba_restore -c "SELECT version_num FROM alembic_version;"
    docker exec lba-restore-db rm -f /tmp/lba-backup.dump

Compare table counts with the backup-time baseline and start a private LBA
backend against the restored database. Check health and run synthetic
authorization and record-access checks before accepting the restore. Keep the
restore instance private and remove its data after the drill. These PostgreSQL
commands require a live target-host rehearsal.

## OpenRouter advisory setup

Set AI_PROVIDER=openrouter, OPENROUTER_API_KEY, and OPENROUTER_MODEL in the
backend environment. Select an exact model ID that supports structured outputs.
The optional OPENROUTER_TASK_MODELS JSON object maps existing advisory
operations to exact model IDs. For Compose, pass that optional variable through
a backend service environment override. Restart the backend after changes.

A teacher can search the current OpenRouter catalog at GET /api/ai/models using
q, modality, minimum_context, and free_only. A listed model may still be
unavailable for an account, privacy policy, or request capability. The advisory
adapter requires structured output and denies provider data collection. LBA
validates response references before use and falls back to its local advisory
if generation or validation fails. Deterministic diagnostics remain separate.

For local testing, open /teacher/login and use the teacher demo account from
the README. Production blocks demo accounts and requires operator provisioning.
