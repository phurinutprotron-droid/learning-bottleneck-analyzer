# Cloudflare Free deployment investigation

Updated: 2026-11-05. Status: compatibility probe only; the LBA backend is NOT deployed on Cloudflare.

## Scope and cost constraint

The user selected free hosting. Do not enable Workers Paid, Containers, paid database plans, or automatic paid upgrades. AI provider usage is separate from hosting and must stay within the selected provider's allowed quota.

The proposed architecture is the existing GitHub Pages frontend, a Python FastAPI Worker, and external PostgreSQL on a free Neon plan through Hyperdrive. This is a candidate architecture, not a verified production deployment.

## Verified runtime results

GitHub Actions runs on branch cloudflare-free:

- Run 42016731518: FastAPI, pydantic-settings, SQLAlchemy, httpx and google.genai imported; psycopg failed to import and hashlib.scrypt was unavailable.
- Run 42017647316: all listed imports passed with pg8000; cryptography's Scrypt derived a 64-byte digest using the existing password cost parameters.
- The second local-runtime probe reported 168 ms wall time for the first derivation, including import. This is NOT a production CPU measurement and does not prove compatibility with the Workers Free 10 ms CPU budget.
- No database connection, full application route, legacy password equivalence test, production CPU measurement, or live Cloudflare request has passed yet.

The probe contains synthetic input only and does not implement LBA API routes. Do not point VITE_API_BASE_URL at it.

## Remaining work before deployment

1. Connect a Cloudflare Free account and a Neon Free database. Neither is currently available to the agent.
2. Validate repeated Scrypt timings, legacy hash equivalence and actual deployed CPU usage. Do not reduce password security to fit the free tier. If CPU limits prevent the existing login flow, choose a free compatible authentication architecture before deployment.
3. Adapt the existing database adapter minimally to pg8000 and request-scoped Hyperdrive bindings with no retained cross-request I/O. Preserve CPython/PostgreSQL operation.
4. Run migrations from CI against an isolated database; serialize synchronous SQLAlchemy access as required by the Python Workers runtime.
5. Test the full FastAPI app, lifespan behavior, authentication and permissions, student isolation, exact-origin CORS, health, AI fallback, and frontend integration in the Workers runtime.
6. Deploy only after those checks and verify live HTTP requests. Configure the frontend origin only after a working backend URL exists.

## Account setup and secrets

Do not paste API keys, database URLs or login passwords in chat or source control.

After the Worker deployment workflow exists, its GitHub Actions credentials should be stored under repository Settings > Secrets and variables > Actions:

- CLOUDFLARE_API_TOKEN: narrowly scoped Worker deployment token for the chosen account.
- CLOUDFLARE_ACCOUNT_ID: chosen account ID.
- DATABASE_URL: private PostgreSQL connection URL for migrations, never a VITE_ variable.
- BOOTSTRAP_TEACHER_PASSWORD: private initial teacher password if provisioning is enabled.

Hyperdrive binding and provider secrets must be configured securely in Cloudflare; disable query caching for authentication and mutable student records. Provider keys stay server-side. No deployment workflow or account credentials have been configured by this probe.

## References

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/languages/python/packages/fastapi/
- https://developers.cloudflare.com/hyperdrive/examples/python-workers/
- https://developers.cloudflare.com/hyperdrive/platform/pricing/
- https://neon.com/pricing
