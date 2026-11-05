export type User = {
  id: string;
  handle: string;
  role: "student" | "teacher" | "researcher";
  is_demo?: boolean;
  student_id: string | null;
  anonymous_id: string | null;
};
export type Session = { access_token: string; user: User };
export type Concept = {
  id: string;
  name: string;
  topic: string;
  skills: string[];
};
export type Subject = {
  baseline_item_count?: number;
  id: string;
  name: string;
  version: string;
  review_status: string;
  concepts: Concept[];
};
export type Item = {
  id: string;
  prompt: string;
  kind: "multiple_choice" | "short_answer";
  options: string[];
  concept_id: string;
};
export type SavedResponse = {
  id: string;
  item_id: string;
  answer: string;
  reasoning: string;
  confidence: number;
  correct?: boolean;
  rubric?: { alignment: string; limitation: string };
};
export type Assessment = {
  id: string;
  subject_id: string;
  subject_version: string;
  stage: string;
  status: string;
  items: Item[];
  responses: SavedResponse[];
  created_at: string;
  intervention_id: string | null;
};
export type Intervention = {
  id: string;
  concept_id: string;
  activity: string;
  expected_outcome: string;
  review_note: string;
  status: string;
  subject_id: string;
};
export type Outcome = {
  stage: string;
  concept_id: string;
  pre_performance: number;
  followup_performance: number;
  descriptive_difference: number;
  interpretation: string;
  pre_n: number;
  followup_n: number;
};
export type Profile = {
  id: string;
  anonymous_id: string;
  grade: number;
  consent: boolean;
  consent_version: string;
  assessments: Assessment[];
  interventions: Intervention[];
  outcomes: Outcome[];
};
export type Learner = {
  id: string;
  anonymous_id: string;
  grade: number;
  assessments_completed: number;
};
export type Hypothesis = {
  id: string;
  concept_id: string;
  kind: string;
  explanation: string;
  status: string;
  support: number;
  uncertainty: number;
  source_response_ids: string[];
  prerequisites_to_explore: string[];
  verification_status: string;
  priority: {
    score: number;
    label: string;
    components: Record<
      string,
      { value: number; weight: number; contribution: number }
    >;
  };
};
export type Evidence = {
  id: string;
  concept_id: string;
  explanation: string;
  source_response_ids: string[];
  evidence_strength: number;
  uncertainty: number;
  supporting_observations: {
    incorrect_ids: string[];
    rubric_flag_ids: string[];
  };
  contradictory_observations: {
    correct_ids: string[];
    rubric_aligned_ids: string[];
  };
};
export type Verification = {
  id: string;
  assessment_id: string;
  selection: {
    concept_id: string;
    strategy: string;
    distinguishing_evidence: string;
  };
  result: {
    updates: {
      kind: string;
      verification_status: string;
      explanation: string;
    }[];
  } | null;
};
export type Diagnostic = {
  id: string;
  assessment_id: string;
  evidence: Evidence[];
  hypotheses: Hypothesis[];
  verifications: Verification[];
  interpretation: string;
  engine_version: string;
};
export type Recommendation = {
  concept_id: string;
  activity: string;
  expected_outcome: string;
};
export type GraphData = {
  nodes: Concept[];
  edges: {
    source_id: string;
    target_id: string;
    source: string;
    relationship_type: string;
    reviewer_status: string;
    version: string;
    evidence_status: string;
  }[];
  validation: { interpretation: string };
};
export type Metric = {
  n: number;
  mean: number | null;
  standard_error: number | null;
};
export type Research = {
  data_status: string;
  include_demo: boolean;
  students: number;
  responses: number;
  completed_baselines: number;
  diagnostic_runs: number;
  stages: Record<
    string,
    { performance: Metric; descriptive_difference: Metric }
  >;
  verification: { evaluated: number; with_contradictions: number };
  reliability: {
    subject_version: string;
    n: number;
    cronbach_alpha: number | null;
  }[];
  interpretation: string;
};
