# Privacy and security design

This is an engineering description and pilot preparation record, not a legal compliance certification.

## Collection and access
Accounts require anonymous handles and passwords, not email or names. A generated learner code and grade are stored. Free-text reasoning can still contain personal information: instruct participants not to enter it, review collection notices, and minimize access. Scrypt hashes protect passwords. Random opaque sessions are hashed server-side, expire, and can be revoked. Browser tokens stay in memory and are never included in URLs. Public registration cannot grant teacher or researcher roles.

Students access only their records; teachers access all learners in this single-school deployment; researchers access aggregate metrics. Teacher provisioning is an administrator CLI command with a hidden password prompt. This is not multi-tenant school software. School/class-scoped staff access and external identity integration are required for broader deployment.

The current consent endpoint appends local pilot assent records and blocks new collection on withdrawal or outdated consent. It does not prove guardian authority, legal basis, or informed participation. Before real research, the responsible institution must establish appropriate notices and authorization for minors, lawful processing basis, research oversight, participant rights, and safeguards appropriate to the Thai PDPA and other applicable requirements. Review with the institution's responsible privacy/legal staff; no compliance claim is made.

## AI boundary
No keys reach the frontend. Gemini receives only rubric observations, correctness, pack objectives and ephemeral per-request source references. Student handles, stable learner/response IDs, raw answers and reasoning prose are excluded. AI records retain model ID, prompt version, source mapping, output and fallback metadata. No live Gemini integration is considered tested without valid credentials. Review provider processing, retention and international transfers before enabling it for real data.

## Retention, withdrawal and deletion
Set an approved retention schedule before collecting real data; this MVP does not run automatic timed deletion. DELETE /api/students/{id} cascades the learner account, sessions, consents, assessments, answers, diagnostic runs, evidence, verification, AI reviews, activities and outcomes. Audit events are retained with the deleted actor reference nulled. Exports contain aggregate stage means and counts only, without row-level identifiers or reasoning. They can still disclose small-cohort information; authorize recipients and apply institution-approved minimum-cell suppression before external sharing. Downloaded exports and backups are not deleted by an API erasure: document the responsible operator and expiration procedure separately.

## Deployment controls
Keep .env and databases ignored. Use HTTPS and encrypted backup/storage in deployment. Restrict database and API exposure; Compose binds published ports to loopback. Set an independent strong PostgreSQL password. The current in-memory IP limiter is single-process and is not a replacement for a gateway, authentication throttling, alerting or operational monitoring. Structured application logs omit bodies, credentials and handles. Infrastructure access logs must also follow the retention policy. Rotate provider keys in the environment. Do not store real learner data in fixtures or source control.
