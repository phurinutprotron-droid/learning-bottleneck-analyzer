# Diagnostic method, rules-v1

## Observations
Answers are normalized by case and whitespace and compared to approved aliases. Reasoning is checked against groups of rubric phrases and explicit misconception phrases using word boundaries. Alignment is aligned, partial, unmatched, or contradictory. These are lexical observations; paraphrase, negation, copied text, and irrelevant keyword insertion can invalidate interpretation. The system explains this limitation rather than claiming semantic assessment.

For each concept, the evidence record stores response IDs, correct and incorrect observations, rubric flags, rubric alignment counts, uncertainty, and confidence/correctness pairs. Confidence never changes a diagnostic rule or score. Source response IDs allow a teacher to inspect the original answer and explanation.

## Inferences
Fewer than two distinct sampled items produces insufficient evidence. Incorrect answers produce competing knowledge-gap and task/slip explanations. Explicit reasoning phrases produce a possible misconception hypothesis requiring review. Correct answers without rubric alignment produce a possible reasoning-gap hypothesis. Mixed correct and incorrect observations produce inconsistent-understanding hypotheses. At least two correct, rubric-aligned observations without flags produce demonstrated-on-sample wording, never a global mastery label.

Evidence strength is min(n/4, 1). Uncertainty is 1 − strength × consistency, where consistency is 0.5 for mixed correctness and 0.8 otherwise. These are transparent engineering heuristics, not calibrated probabilities or validated scales. Sample counts, explanations, and all score components are visible.

## Priority
The priority score uses evidence 25%, certainty 15%, repetition 15%, downstream graph relevance 10%, incorrect performance 25%, and verification support 10%. Downstream relevance only changes the exploration order and never establishes a prerequisite cause. The scoring function accepts alternate nonnegative normalized weights; changing weights requires a documented engine/version change before a study.

## Verification
Choose an unused curated item maximizing number of relevant hypothesis kinds + uncertainty + scaled priority, with deterministic item-ID tie-breaking. This is an information-gain-inspired coverage heuristic, not a probability model, entropy estimate, or optimal adaptive test. Compare correctness, alignment, and flags against approved rules. Append supported, contradicted, or inconclusive status. A single verification changes heuristic support by at most 0.2 and retains uncertainty. Initial support is preserved; the displayed support and priority incorporate appended verification results. Exhaustion is an explicit conflict response, never a generated successful result.

## Intervention and outcomes
A teacher reviews and may replace sample activities. The intervention stores the selected concept, baseline, expected outcome, and review/override rationale. A teacher confirms completion before retesting. Post, transfer, and retention use distinct curated items and retain denominators. Retention requires at least seven days after completion. Scores on different forms are not equated; descriptive differences are not treatment effects. No pre/post observation alone supports a causal conclusion.
