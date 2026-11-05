import { SubjectTree } from "./SubjectTree";
import { useLanguage, subjectLabel } from "../i18n";
import { useState } from "react";
import { BookOpen, Check, ArrowRight, GitBranch } from "lucide-react";
import type { Profile, Assessment, Subject } from "../types";
import { api, post } from "../services/api";
import {
  SectionTitle,
  Empty,
  Notice,
  Pill,
  ErrorNotice,
  pretty,
  percent,
} from "../components/ui";
export function LearningProfile({
  profile,
  token,
  teacher,
  subjects,
  onAssessment,
  onDiagnose,
  onChange,
  home = false,
}: {
  profile: Profile;
  token: string;
  teacher: boolean;
  subjects: Subject[];
  onAssessment: (a: Assessment) => void;
  onDiagnose: (a: Assessment) => Promise<void>;
  onChange: () => void;
  home?: boolean;
}) {
  const { language, t } = useLanguage();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function start(
    subject_id: string,
    stage = "pre",
    intervention_id?: string,
  ) {
    onAssessment(
      await api<Assessment>(
        `/students/${profile.id}/assessments`,
        token,
        post({ subject_id, stage, intervention_id }),
      ),
    );
  }
  return (
    <div className="stack">
      <ErrorNotice message={error} />
      {!profile.consent && (
        <div className="consent-card">
          <div>
            <h3>{t("Before collecting any answers", "ก่อนเริ่มทำแบบประเมิน")}</h3>
            <p>
              Record assent for this local software demonstration. Use
              anonymous, fictional responses. Use with real learners requires
              reviewed school and guardian authorization.
            </p>
          </div>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              action(async () => {
                await api(
                  `/students/${profile.id}/consent`,
                  token,
                  post({ granted: true }),
                );
                onChange();
              })
            }
          >
            Record demo assent
            <Check size={16} />
          </button>
        </div>
      )}
      {home ? (
        <SubjectTree profile={profile} subjects={subjects} busy={busy} onOpen={(subject, open) => {
          if (open) onAssessment(open);
          else void action(() => start(subject.id));
        }} />
      ) : <>
      <SectionTitle
        aside={
          <Pill>
            {profile.anonymous_id} · Grade {profile.grade}
          </Pill>
        }
      >
        Explore your understanding
      </SectionTitle>
      <div className="subject-grid">
        {subjects.map((s, i) => (
          <section className={"subject-card subject-" + i} key={s.id}>
            <div className="subject-card-top">
              <span className="section-icon">
                <BookOpen size={22} />
              </span>
              <Pill>Sample pack</Pill>
            </div>
            <h2>{subjectLabel(s.id, s.name, language)}</h2>
            <p>{s.concepts.map((c) => c.name).join(" · ")}</p>
            <div className="subject-meta">
              <span>{s.concepts.length} concepts</span>
              {s.baseline_item_count != null && <span>{s.baseline_item_count} baseline questions</span>}
            </div>
            <button
              className="secondary"
              disabled={!profile.consent || busy}
              onClick={() => action(() => start(s.id))}
            >
              {t("Start assessment", "เริ่มแบบประเมิน")}
              <ArrowRight size={16} />
            </button>
          </section>
        ))}
      </div>
      <SectionTitle>{t("Assessment history", "ประวัติการทำแบบประเมิน")}</SectionTitle>
      {profile.assessments.length ? (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Subject / stage</th>
                <th>Progress</th>
                <th>Observed answers</th>
                <th>Next step</th>
              </tr>
            </thead>
            <tbody>
              {profile.assessments.map((a) => (
                <tr key={a.id}>
                  <td>
                    <b>{pretty(a.subject_id)}</b>
                    <small>
                      {pretty(a.stage)} ·{" "}
                      {new Date(a.created_at).toLocaleDateString()}
                    </small>
                  </td>
                  <td>
                    <Pill tone={a.status === "completed" ? "" : "amber"}>
                      {a.status}
                    </Pill>
                    <small>
                      {a.responses.length}/{a.items.length} saved
                    </small>
                  </td>
                  <td>
                    {a.status === "completed"
                      ? `${a.responses.filter((r) => r.correct).length}/${a.items.length} correct`
                      : "Feedback after completion"}
                  </td>
                  <td>
                    {a.status === "open" ? (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => onAssessment(a)}
                      >
                        Resume
                        <ArrowRight size={14} />
                      </button>
                    ) : a.stage === "pre" ? (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => action(() => onDiagnose(a))}
                      >
                        Explore evidence
                        <GitBranch size={14} />
                      </button>
                    ) : (
                      <details>
                        <summary>View responses</summary>
                        {a.responses.map((r) => (
                          <p key={r.id}>
                            <code>{r.id}</code>
                            <br />
                            {r.answer} · {r.correct ? "correct" : "incorrect"}
                            <br />
                            {r.reasoning}
                            <br />
                            Confidence: {r.confidence}; rubric:{" "}
                            {r.rubric?.alignment}
                          </p>
                        ))}
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="Your first observation starts here">
          Choose a subject above. There is no learner performance data yet.
        </Empty>
      )}
      <SectionTitle>{t("Targeted learning activities", "กิจกรรมเสริมการเรียน")}</SectionTitle>
      {profile.interventions.length ? (
        profile.interventions.map((i) => (
          <div className="panel activity" key={i.id}>
            <div>
              <Pill>{i.status}</Pill>
              <h3>{pretty(i.concept_id)}</h3>
              <p>{i.activity}</p>
              <p>
                <b>Expected outcome:</b> {i.expected_outcome}
              </p>
              <small>Teacher review: {i.review_note}</small>
            </div>
            <div className="activity-actions">
              {teacher && i.status === "assigned" && (
                <>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        await api(`/interventions/${i.id}`, token, {
                          method: "PATCH",
                          body: JSON.stringify({
                            status: "completed",
                            review_note:
                              "Teacher confirmed activity completion; ready for independent retest.",
                          }),
                        });
                        onChange();
                      })
                    }
                  >
                    Confirm completion
                    <Check size={16} />
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        await api(`/interventions/${i.id}`, token, {
                          method: "PATCH",
                          body: JSON.stringify({
                            status: "cancelled",
                            review_note:
                              "Teacher cancelled activity after review.",
                          }),
                        });
                        onChange();
                      })
                    }
                  >
                    Cancel activity
                  </button>
                </>
              )}
              {i.status === "completed" &&
                ["post", "transfer", "retention"].map((stage) => {
                  const existing = profile.assessments.find(
                    (a) => a.intervention_id === i.id && a.stage === stage,
                  );
                  return (
                    <button
                      className="secondary"
                      disabled={busy || existing?.status === "completed"}
                      key={stage}
                      onClick={() =>
                        existing
                          ? onAssessment(existing)
                          : action(() => start(i.subject_id, stage, i.id))
                      }
                    >
                      {existing?.status === "completed"
                        ? "Completed"
                        : existing
                          ? "Resume"
                          : "Start"}{" "}
                      {stage}
                      <ArrowRight size={14} />
                    </button>
                  );
                })}
            </div>
          </div>
        ))
      ) : (
        <Notice>
          No activities assigned. A teacher can review diagnostic evidence, edit
          a recommendation, and assign a targeted activity.
        </Notice>
      )}
      <SectionTitle>Learning and transfer observations</SectionTitle>
      {profile.outcomes.length ? (
        <div className="evidence-grid">
          {profile.outcomes.map((o, i) => (
            <div className="panel" key={i}>
              <Pill>{o.stage}</Pill>
              <h3>{pretty(o.concept_id)}</h3>
              <div className="outcome-numbers">
                <span>
                  {percent(o.pre_performance)}
                  <small>Baseline · n={o.pre_n}</small>
                </span>
                <ArrowRight size={20} />
                <span>
                  {percent(o.followup_performance)}
                  <small>Follow-up · n={o.followup_n}</small>
                </span>
              </div>
              <p className="caption">{o.interpretation}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          Follow-up observations appear after a completed intervention and
          retest. Retention opens after seven days.
        </p>
      )}
      {profile.consent && (
        <button
          className="text-button muted"
          disabled={busy}
          onClick={() =>
            action(async () => {
              await api(
                `/students/${profile.id}/consent`,
                token,
                post({ granted: false }),
              );
              onChange();
            })
          }
        >
          Withdraw demo assent and stop further collection
        </button>
      )}
      </>}
    </div>
  );
}
