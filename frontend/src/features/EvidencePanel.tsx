import { useState, type FormEvent } from "react";
import { Pending } from "../components/motion";
import { GitBranch, Sparkles, ArrowRight } from "lucide-react";
import type { Diagnostic, Recommendation, Assessment } from "../types";
import { api, post } from "../services/api";
import { isJudgeToken } from "../services/judgePreview";
import { useResource } from "../hooks/useResource";
import {
  ErrorNotice,
  Notice,
  Pill,
  SectionTitle,
  pretty,
  percent,
} from "../components/ui";
const advisoryTasks = {
  intervention_suggestions: "Suggest learning activities",
  student_explanation: "Explain the result to the learner",
  reasoning_analysis: "Review reasoning evidence",
  misconception_suggestions: "Suggest misconceptions to verify",
  verification_candidate: "Draft a verification question",
};
type AdvisoryTask = keyof typeof advisoryTasks;
type CatalogModel = {
  id: string;
  name: string;
  price_class: "free" | "paid" | "unknown";
  supports_advisory: boolean;
};
const families = {
  all: "All models",
  nemotron: "NVIDIA Nemotron 3 Ultra",
  qwen: "Qwen",
  deepseek: "DeepSeek",
  mistral: "Mistral",
  llama: "Llama",
  cohere: "Cohere",
  other: "Other catalog models",
};
type Family = keyof typeof families;
function modelFamily(id: string): Family {
  if (id.startsWith("nvidia/nemotron-3-ultra")) return "nemotron";
  if (id.startsWith("meta-llama/")) return "llama";
  if (id.startsWith("mistralai/")) return "mistral";
  for (const family of ["qwen", "deepseek", "cohere"] as const) {
    if (id.startsWith(family + "/")) return family;
  }
  return "other";
}

export function EvidencePanel({
  run,
  token,
  teacher,
  studentId,
  onVerify,
  onChange,
  baseline,
}: {
  run: Diagnostic;
  token: string;
  teacher: boolean;
  studentId: string;
  baseline: Assessment;
  onVerify: () => Promise<void>;
  onChange: () => void;
}) {
  const readOnly = isJudgeToken(token);
  const [busy, setBusy] = useState(false);
  const [task, setTask] = useState<AdvisoryTask>("intervention_suggestions");
  const [family, setFamily] = useState<Family>("all");
  const [modelChoices, setModelChoices] = useState<Partial<Record<AdvisoryTask, string>>>({});
  const [allowPaid, setAllowPaid] = useState(false);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const catalog = useResource<CatalogModel[]>(teacher ? "/ai/models" : null, token, catalogRevision);
  const modelId = modelChoices[task] || "";
  const model = catalog.data?.find((entry) => entry.id === modelId);
  const choices = catalog.data?.filter((entry) =>
    family === "all" || modelFamily(entry.id) === family || entry.id === modelId
  ) ?? [];
  const [assisting, setAssisting] = useState(false);
  const [error, setError] = useState("");
  const [ai, setAi] = useState<{
    explanation: string;
    suggestions: string[];
    fallback: boolean;
    model: string;
    requestedModel?: string | null;
    candidate?: { prompt: string; options: string[] } | null;
  } | null>(null);
  const {
    data: recs,
    loading: loadingRecommendations,
    error: recommendationError,
  } = useResource<Recommendation[]>(
    teacher ? `/diagnostics/${run.id}/recommendations` : null,
    token,
  );
  async function verify() {
    setBusy(true);
    setError("");
    try {
      await onVerify();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function assist(gemini = false) {
    setBusy(true);
    setAssisting(true);
    setAi(null);
    setError("");
    try {
      const result = await api<{
        provider: string;
        model_id: string;
        fallback: boolean;
        fallback_reason?: string;
        requested_model_id?: string | null;
        suggestion: { explanation: string; suggestions: string[]; candidate?: { prompt: string; options: string[] } | null };
      }>(
        `/diagnostics/${run.id}/ai-assist`,
        token,
        post(gemini ? { operation: "reasoning_analysis", gemini_analysis: true } : { operation: task, ...(modelId ? { model_id: modelId, allow_paid: allowPaid } : { auto_model: true }) }),
      );
      setAi({
        ...result.suggestion,
        fallback: result.fallback,
        requestedModel: result.requested_model_id,
        model: result.fallback
          ? result.fallback_reason || "Deterministic assistance"
          : result.model_id,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAssisting(false);
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <div className="section-title">
        <div>
          <div className="eyebrow">FOLLOW THE EVIDENCE</div>
          <h2>Possible explanations, open to revision.</h2>
        </div>
        <button className="primary" onClick={verify} disabled={busy || readOnly}>
          <GitBranch size={17} />
          Next verification
        </button>
      </div>
      <Notice>
        {run.interpretation} Engine: {run.engine_version}.
      </Notice>
      <ErrorNotice message={error} />
      <div className="evidence-grid">
        {run.evidence.map((e) => (
          <section className="panel" key={e.id}>
            <Pill>{pretty(e.concept_id.split(".")[1])}</Pill>
            <h3>Observed evidence</h3>
            <p>{e.explanation}</p>
            <div className="mini-stats">
              <span>
                Strength <b>{percent(e.evidence_strength)}</b>
              </span>
              <span>
                Uncertainty <b>{percent(e.uncertainty)}</b>
              </span>
            </div>
            <details>
              <summary>
                Trace observations ({e.source_response_ids.length} responses)
              </summary>
              <p>
                Incorrect:{" "}
                {e.supporting_observations.incorrect_ids.join(", ") || "None"}
              </p>
              <p>
                Correct / contradicting a gap:{" "}
                {e.contradictory_observations.correct_ids.join(", ") || "None"}
              </p>
              <p>
                Lexical rubric flags:{" "}
                {e.supporting_observations.rubric_flag_ids.join(", ") || "None"}
              </p>
            </details>
          </section>
        ))}
      </div>
      <SourceResponses assessment={baseline} />
      <SectionTitle
        aside={<Pill tone="amber">Heuristic, unvalidated scores</Pill>}
      >
        Competing hypotheses
      </SectionTitle>
      <div className="hypothesis-list">
        {run.hypotheses.map((h) => (
          <section className="panel hypothesis" key={h.id}>
            <div className="score-block">
              <strong>{h.priority.score}</strong>
              <span>priority / 100</span>
            </div>
            <div className="hypothesis-body">
              <div className="hypothesis-heading">
                <h3>{pretty(h.kind)}</h3>
                <Pill>{pretty(h.verification_status)}</Pill>
              </div>
              <span className="muted">{pretty(h.concept_id)}</span>
              <p>{h.explanation}</p>
              <details>
                <summary>Why this inference? Inspect score and sources</summary>
                <p>
                  Sources: {h.source_response_ids.join(", ") || "No responses"}
                </p>
                <p>
                  Uncertainty: {percent(h.uncertainty)}. Support index:{" "}
                  {h.support.toFixed(2)} (heuristic, not a probability).
                </p>
                <p>
                  Prerequisites to explore:{" "}
                  {h.prerequisites_to_explore.map(pretty).join(", ") ||
                    "None in this pack"}
                  . Graph paths do not establish causes.
                </p>
                <table>
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>Value</th>
                      <th>Weight</th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(h.priority.components).map(([k, c]) => (
                      <tr key={k}>
                        <td>{pretty(k)}</td>
                        <td>{c.value}</td>
                        <td>{c.weight}</td>
                        <td>{c.contribution}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          </section>
        ))}
      </div>
      <SectionTitle>Verification history</SectionTitle>
      {run.verifications.length ? (
        run.verifications.map((v) => (
          <div className="panel" key={v.id}>
            <h3>{pretty(v.selection.concept_id)}</h3>
            <p>{v.selection.distinguishing_evidence}</p>
            {v.result ? (
              v.result.updates.map((u, i) => (
                <p key={i}>
                  <Pill>{u.verification_status}</Pill> {pretty(u.kind)} ·{" "}
                  {u.explanation}
                </p>
              ))
            ) : (
              <p>
                Awaiting response or evaluation. Use “Next verification” to
                resume.
              </p>
            )}
          </div>
        ))
      ) : (
        <p className="muted">
          No verification completed. A distinct question can help test these
          explanations.
        </p>
      )}
      {teacher && (
        <>
          <SectionTitle
            aside={
              <button className="secondary" disabled={busy || readOnly || (!!modelId && (!model?.supports_advisory || model.price_class === "unknown" || (model.price_class === "paid" && !allowPaid)))} onClick={() => assist()}>
                <Sparkles size={15} />
                Advisory assistance
              </button>
            }
          >
            Plan a targeted next step
          </SectionTitle>
          <fieldset className="panel stack" disabled={busy}>
            <legend>Advisory task and model</legend>
            <label>
              Task
              <select value={task} onChange={(event) => {
                setTask(event.target.value as AdvisoryTask);
                setAllowPaid(false);
                setAi(null);
              }}>
                {Object.entries(advisoryTasks).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label>
              Model family
              <select value={family} onChange={(event) => setFamily(event.target.value as Family)}>
                {Object.entries(families).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label>
              Model for this task
              <select value={modelId} onChange={(event) => {
                setModelChoices({ ...modelChoices, [task]: event.target.value });
                setAllowPaid(false);
                setAi(null);
              }}>
                <option value="">Automatic · free models only</option>
                {modelId && !model && <option value={modelId} disabled>{modelId} · unavailable</option>}
                {choices.map((entry) => (
                  <option key={entry.id} value={entry.id} disabled={!entry.supports_advisory || entry.price_class === "unknown"}>
                    {entry.name} · {!entry.supports_advisory ? "no structured text support" : entry.price_class}
                  </option>
                ))}
              </select>
            </label>
            {catalog.loading && <Pending label="Loading model catalog…" />}
            {catalog.error && <ErrorNotice message={catalog.error} />}
            {catalog.data && choices.length === 0 && <p>No catalog models in this family.</p>}
            <button type="button" className="secondary" onClick={() => setCatalogRevision((value) => value + 1)}>
              Refresh model catalog
            </button>
            {model?.price_class === "paid" && (
              <label>
                <input type="checkbox" checked={allowPaid} onChange={(event) => setAllowPaid(event.target.checked)} />
                Confirm that this model may incur charges
              </label>
            )}
            <p className="muted">Model availability can vary. Advisory results require review and do not change the assessment score.</p>
          </fieldset>
          <button className="secondary" disabled={busy || readOnly} onClick={() => assist(true)}>Analyze learning gaps with Gemini</button>
          {assisting && <Pending label="Requesting advisory assistance…" />}
          {ai && !assisting && (
            <div className="panel motion-feedback" role="status">
              <Pill>
                {ai.fallback
                  ? "Deterministic fallback"
                  : "AI suggestion · review required"}
              </Pill>
              {ai.requestedModel && ai.requestedModel !== ai.model && <p>Requested model: {ai.requestedModel}</p>}
              <p>{ai.model}</p>
              <p>{ai.explanation}</p>
              {ai.candidate && (
                <div>
                  <h3>Draft verification question</h3>
                  <p className="assessment-prompt">{ai.candidate.prompt}</p>
                  <ul>{ai.candidate.options.map((option, index) => <li key={index}>{option}</li>)}</ul>
                </div>
              )}
              <ul>
                {ai.suggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {loadingRecommendations ? (
            <Pending label="Loading recommendations…" skeleton />
          ) : recommendationError ? (
            <ErrorNotice message={recommendationError} />
          ) : recs?.length ? (
            recs.map((rec) => (
              <InterventionForm
                key={rec.concept_id}
                rec={rec}
                token={token}
                studentId={studentId}
                baseline={baseline}
                onChange={onChange}
              />
            ))
          ) : recs ? (
            <Notice>
              No active sample recommendation. Review contradictory evidence
              before assigning a teacher-selected intervention.
            </Notice>
          ) : null}
        </>
      )}
    </div>
  );
}
function InterventionForm({
  rec,
  token,
  studentId,
  baseline,
  onChange,
}: {
  rec: Recommendation;
  token: string;
  studentId: string;
  baseline: Assessment;
  onChange: () => void;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api(
        "/interventions",
        token,
        post({
          student_id: studentId,
          subject_id: baseline.subject_id,
          baseline_assessment_id: baseline.id,
          concept_id: rec.concept_id,
          activity: form.get("activity"),
          expected_outcome: form.get("outcome"),
          review_note: form.get("review"),
        }),
      );
      setMessage("Teacher-reviewed activity assigned.");
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel intervention-form" onSubmit={submit}>
      <h3>{pretty(rec.concept_id)}</h3>
      <p>
        Edit this sample recommendation or replace it with your own activity.
      </p>
      <label>
        Learning activity
        <textarea
          name="activity"
          required
          minLength={10}
          maxLength={2000}
          defaultValue={rec.activity}
        />
      </label>
      <label>
        Expected outcome
        <input
          name="outcome"
          required
          minLength={10}
          maxLength={1000}
          defaultValue={rec.expected_outcome}
        />
      </label>
      <label>
        Teacher review / override rationale
        <input
          name="review"
          required
          minLength={5}
          maxLength={1000}
          placeholder="Why is this appropriate for the observed evidence?"
        />
      </label>
      <ErrorNotice message={error} />
      {message ? (
        <div className="notice motion-feedback" role="status">
          {message}
        </div>
      ) : (
        <button className="primary" disabled={busy || isJudgeToken(token)}>
          {busy ? "Assigning…" : "Approve & assign"}
          <ArrowRight size={16} />
        </button>
      )}
    </form>
  );
}

function SourceResponses({ assessment }: { assessment: Assessment }) {
  return (
    <section className="panel table-wrap">
      <SectionTitle>Original source responses</SectionTitle>
      <table>
        <thead>
          <tr>
            <th>Source / task</th>
            <th>Answer</th>
            <th>Reasoning</th>
            <th>Observations</th>
          </tr>
        </thead>
        <tbody>
          {assessment.responses.map((r) => (
            <tr key={r.id}>
              <td>
                <code>{r.id}</code>
                <small>
                  {assessment.items.find((i) => i.id === r.item_id)?.prompt}
                </small>
              </td>
              <td>
                {r.answer}
                <small>{r.correct ? "Correct" : "Incorrect"}</small>
              </td>
              <td>{r.reasoning}</td>
              <td>
                Rubric: {r.rubric?.alignment}
                <small>Confidence: {r.confidence}/5</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="caption">{assessment.responses[0]?.rubric?.limitation}</p>
    </section>
  );
}
