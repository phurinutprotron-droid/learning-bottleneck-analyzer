import type {
  Assessment,
  Diagnostic,
  GraphData,
  Profile,
  Research,
  Session,
  Subject,
  User,
} from "../types";

// Public convenience credentials for the isolated, read-only interface preview.
// These values are never accepted by the backend authentication service.
export const judgeCredentials = {
  handle: "lba_judge",
  password: "LBA-Judge-2026!",
};
type Role = User["role"];
const previewTokens: Record<Role, string> = {
  student: "lba-public-preview-student",
  teacher: "lba-public-preview-teacher",
  researcher: "lba-public-preview-researcher",
};
export function isJudgeToken(token?: string): boolean {
  return !!token && Object.values(previewTokens).includes(token);
}
export function createJudgeSession(role: Role): Session {
  return {
    access_token: previewTokens[role],
    user: {
      id: `judge-${role}`,
      handle: judgeCredentials.handle,
      role,
      is_demo: true,
      student_id: role === "student" ? profile.id : null,
      anonymous_id: role === "student" ? profile.anonymous_id : null,
    },
  };
}

const subjects: Subject[] = [
  {
    id: "mathematics",
    name: "Mathematics",
    version: "judge-example-v1",
    review_status: "illustrative_only",
    baseline_item_count: 2,
    concepts: [
      {
        id: "math.fractions",
        name: "Equivalent fractions",
        topic: "Fractions",
        skills: ["Explain equivalent fractions"],
      },
      {
        id: "math.proportion",
        name: "Proportional reasoning",
        topic: "Ratios",
        skills: ["Compare ratios"],
      },
    ],
  },
  {
    id: "science",
    name: "Science",
    version: "judge-example-v1",
    review_status: "illustrative_only",
    baseline_item_count: 2,
    concepts: [
      {
        id: "science.particles",
        name: "Particle model",
        topic: "Matter",
        skills: ["Describe a particle model"],
      },
      {
        id: "science.heat",
        name: "Thermal energy transfer",
        topic: "Energy",
        skills: ["Explain energy transfer"],
      },
    ],
  },
  {
    id: "coding",
    name: "Coding",
    version: "judge-example-v1",
    review_status: "illustrative_only",
    baseline_item_count: 2,
    concepts: [
      {
        id: "coding.variables",
        name: "Variable state",
        topic: "Variables",
        skills: ["Trace values"],
      },
      {
        id: "coding.loops",
        name: "Loop boundaries",
        topic: "Loops",
        skills: ["Trace a loop"],
      },
    ],
  },
];
const prompts: Record<
  string,
  { prompt: string; answer: string; correct: boolean; reasoning: string }[]
> = {
  mathematics: [
    {
      prompt: "Which fraction is equivalent to 1/2? Explain your choice.",
      answer: "2/4",
      correct: true,
      reasoning: "I multiplied the numerator and denominator by two.",
    },
    {
      prompt: "If two notebooks cost 30 baht, how much do four cost? Explain.",
      answer: "45 baht",
      correct: false,
      reasoning: "I added 15 once.",
    },
  ],
  science: [
    {
      prompt: "Use a particle model to describe a solid.",
      answer: "Its particles are close together.",
      correct: true,
      reasoning: "They vibrate around fixed positions.",
    },
    {
      prompt: "Why does a metal spoon become warm in hot water?",
      answer: "The spoon makes new heat.",
      correct: false,
      reasoning: "I think the metal creates heat.",
    },
  ],
  coding: [
    {
      prompt: "After x = 2 and then x = x + 3, what is x? Explain.",
      answer: "5",
      correct: true,
      reasoning: "The new assignment replaces the old value.",
    },
    {
      prompt: "How many times does a loop over [0, 1, 2] run?",
      answer: "3",
      correct: true,
      reasoning: "There is one iteration for each value.",
    },
  ],
};
function exampleAssessment(subject: Subject, completed: boolean): Assessment {
  const id = `judge-${subject.id}-${completed ? "completed" : "open"}`;
  return {
    id,
    subject_id: subject.id,
    subject_version: subject.version,
    stage: "pre",
    status: completed ? "completed" : "open",
    created_at: completed ? "2026-11-02T09:00:00Z" : "2026-11-09T09:00:00Z",
    intervention_id: null,
    items: subject.concepts.map((concept, i) => ({
      id: `${id}-q${i}`,
      concept_id: concept.id,
      prompt: prompts[subject.id][i].prompt,
      kind: "short_answer",
      options: [],
    })),
    responses: completed
      ? subject.concepts.map((_, i) => ({
          id: `${id}-r${i}`,
          item_id: `${id}-q${i}`,
          answer: prompts[subject.id][i].answer,
          reasoning: prompts[subject.id][i].reasoning,
          confidence: 3,
          correct: prompts[subject.id][i].correct,
        }))
      : [],
  };
}
const assessments = [
  ...subjects.slice(0, 2).map((subject) => exampleAssessment(subject, true)),
  ...subjects.map((subject) => exampleAssessment(subject, false)),
];
const profile: Profile = {
  id: "judge-learner-01",
  anonymous_id: "EXAMPLE-01",
  grade: 7,
  consent: true,
  consent_version: "synthetic-preview",
  assessments,
  interventions: [],
  outcomes: [],
};
const completed = assessments.filter((a) => a.status === "completed");
const research: Research = {
  data_status: "Illustrative example dataset · not research results",
  include_demo: true,
  students: 1,
  responses: completed.reduce((sum, a) => sum + a.responses.length, 0),
  completed_baselines: completed.length,
  diagnostic_runs: completed.length,
  stages: {},
  verification: { evaluated: 0, with_contradictions: 0 },
  reliability: [],
  interpretation:
    "Fixed examples for reviewing the interface. No participant research or educational effectiveness is established.",
};

function exampleDiagnostic(assessment: Assessment): Diagnostic {
  const response = assessment.responses[1];
  const concept = assessment.items[1].concept_id;
  return {
    id: `example-${assessment.id}`,
    assessment_id: assessment.id,
    engine_version: "illustrative-example",
    interpretation:
      "Prewritten example report tied to the example answers below. It is not a newly completed analysis.",
    evidence: [
      {
        id: `e-${assessment.id}`,
        concept_id: concept,
        explanation: `The example answer “${response.answer}” is incorrect. Its explanation should be checked with another question.`,
        source_response_ids: [response.id],
        evidence_strength: 0.5,
        uncertainty: 0.5,
        supporting_observations: {
          incorrect_ids: [response.id],
          rubric_flag_ids: [],
        },
        contradictory_observations: { correct_ids: [], rubric_aligned_ids: [] },
      },
    ],
    hypotheses: [
      {
        id: `h-${assessment.id}`,
        concept_id: concept,
        kind: "reasoning_gap",
        status: "unverified",
        explanation:
          "Illustrative possibility only. The single answer does not establish a misconception.",
        support: 0.5,
        uncertainty: 0.5,
        source_response_ids: [response.id],
        prerequisites_to_explore: [],
        verification_status: "not_verified",
        priority: {
          score: 50,
          label: "illustrative",
          components: {
            example_evidence: { value: 0.5, weight: 1, contribution: 50 },
          },
        },
      },
    ],
    verifications: [],
  };
}
export class JudgePreviewError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function judgePreviewRequest(
  path: string,
  token: string,
  options: RequestInit = {},
): unknown {
  const role = (Object.keys(previewTokens) as Role[]).find(
    (role) => previewTokens[role] === token,
  );
  if (!role) throw new JudgePreviewError(401, "Unknown preview session");
  const url = new URL(path, "https://judge-preview.invalid");
  const route = url.pathname;
  const method = (options.method || "GET").toUpperCase();
  if (route === "/auth/logout" && method === "POST") return undefined;
  const existingReport = completed.find(
    (a) => route === `/assessments/${a.id}/diagnostics`,
  );
  if (existingReport && method === "POST" && role !== "researcher")
    return structuredClone(exampleDiagnostic(existingReport));
  if (method !== "GET")
    throw new JudgePreviewError(
      403,
      "Judge preview is read-only · พื้นที่กรรมการสำหรับดูข้อมูลตัวอย่างเท่านั้น",
    );
  let result: unknown;
  if (route === "/subjects") result = subjects;
  else if (route === "/auth/me") result = createJudgeSession(role).user;
  else if (route === "/students" && role === "teacher")
    result = [
      {
        id: profile.id,
        anonymous_id: profile.anonymous_id,
        grade: profile.grade,
        assessments_completed: completed.length,
      },
    ];
  else if (route === `/students/${profile.id}` && role !== "researcher")
    result = profile;
  else if (route === "/research/summary" && role !== "student") {
    result =
      url.searchParams.get("include_demo") === "true"
        ? research
        : {
            ...research,
            data_status:
              "Example records excluded · no included research records",
            include_demo: false,
            students: 0,
            responses: 0,
            completed_baselines: 0,
            diagnostic_runs: 0,
          };
  } else if (route === "/curriculum/status" && role !== "student")
    result = {
      sources: [],
      verified_indicators: 0,
      priority_grades: [7, 8, 9],
    };
  else if (route === "/curriculum/exam-indicators" && role !== "student")
    result = [];
  else if (route === "/ai/models" && role === "teacher") result = [];
  else if (
    route === "/graph" ||
    subjects.some((s) => route === `/subjects/${s.id}/graph`)
  ) {
    const chosen =
      route === "/graph"
        ? subjects
        : subjects.filter((s) => route === `/subjects/${s.id}/graph`);
    const graph: GraphData = {
      nodes: chosen.flatMap((s) => s.concepts),
      edges: chosen.map((s) => ({
        source_id: s.concepts[0].id,
        target_id: s.concepts[1].id,
        source: "Prewritten judge example",
        relationship_type: "prerequisite",
        reviewer_status: "unvalidated",
        version: "judge-example-v1",
        evidence_status: "illustrative_only",
      })),
      validation: {
        interpretation:
          "Illustrative relationships only. These links are not evidence of causes.",
      },
    };
    result = graph;
  } else {
    const assessment = assessments.find(
      (a) => route === `/assessments/${a.id}`,
    );
    const report = completed.find(
      (a) => route === `/diagnostics/example-${a.id}`,
    );
    const recommendations = completed.some(
      (a) => route === `/diagnostics/example-${a.id}/recommendations`,
    );
    if (assessment && role !== "researcher") result = assessment;
    else if (report && role !== "researcher")
      result = exampleDiagnostic(report);
    else if (recommendations && role === "teacher") result = [];
    else
      throw new JudgePreviewError(
        404,
        "This record is not part of the judge preview · ไม่มีข้อมูลนี้ในพื้นที่สาธิต",
      );
  }
  return structuredClone(result);
}
