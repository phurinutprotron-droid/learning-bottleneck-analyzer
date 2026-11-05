# AI advisory prompt contract, version advisory-v1

The exact system instruction is implemented in backend/app/services/gemini_provider.py. The persisted AI review includes the operation, model identifier, prompt version, source-reference mapping, fallback status, and validated output.

Operations: reasoning_analysis, misconception_suggestions, verification_candidate, student_explanation, intervention_suggestions.

Input contains per-request R1/R2 references, correctness, deterministic lexical rubric observations, approved objectives and rubrics. It does not send handles, learner identifiers, account identifiers, confidence, original answers, or student free text. Reasoning analysis therefore assists with rubric observations rather than independently re-reading the original prose. This deliberate minimization limits the provider's assistance.

AI text is advisory and never passed back into the deterministic engine. A candidate must match a known concept, verification stage, difficulty, objective, and rubric and pass Item validation. Structural validation cannot establish pedagogical quality or answer-key truth. Candidates require teacher review and content-author review before release through a new versioned pack; there is no auto-publication path.

HTTP errors, timeouts, rate limits, absent configuration, unavailable models, malformed JSON, invalid schemas and unsupported citations produce a labeled fallback. One request attempt per operation prevents hidden retry costs. No live Gemini request has been validated without credentials.
