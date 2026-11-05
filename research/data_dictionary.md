# Data dictionary

| Table | Main fields / interpretation |
| --- | --- |
| users | UUID, anonymous handle, scrypt hash, role, timestamp |
| sessions | SHA-256 token hash, owner, expiration; raw token never persisted |
| students | UUID, owning user, generated anonymous code, grade |
| consents | Learner, notice/protocol version, granted/withdrawn, timestamp |
| subject_versions | Subject:version key, complete immutable pack and graph snapshot |
| assessments | Learner, subject snapshot, stage, assigned item IDs, status, intervention link |
| responses | Original answer and reasoning, confidence 1–5, item version, deterministic correctness/rubric observations |
| diagnostic_runs | Baseline assessment, engine version and timestamp |
| evidence | Run and structured observations including supporting/contradictory response IDs |
| hypotheses | Run and initial competing inferences with support, uncertainty, priority components |
| verifications | Run, distinct assessment, selection rationale and appended support updates |
| interventions | Learner, teacher, target concept, selected baseline, editable-before-assignment activity, expected outcome and review rationale; completion history |
| learning_results | Follow-up assessment, stage, pre/follow-up denominators and proportions, descriptive difference and elapsed interval |
| ai_reviews | Run, operation, provider/model/prompt version, source mapping, validated suggestion and fallback status |
| audit_logs | Actor reference (nullable on deletion), action and timestamp; no answer bodies |

Aggregate exports intentionally contain no response-level rows or stable participant identifiers. Paired expert reference labels and SUS ratings submitted to the metric calculator are not persisted; record approved research provenance separately.
