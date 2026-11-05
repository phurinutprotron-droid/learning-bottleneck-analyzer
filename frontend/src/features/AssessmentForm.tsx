import { useLanguage } from "../i18n";
import { useId, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import type { Assessment, SavedResponse } from "../types";
import { api, post } from "../services/api";
import { Pill, pretty } from "../components/ui";
import {
  collectIssues,
  FormFeedback,
  type FieldIssue,
} from "../components/FormFeedback";
export function AssessmentForm({
  assessment,
  token,
  onComplete,
  onBack,
}: {
  assessment: Assessment;
  token: string;
  onComplete: (a: Assessment) => Promise<void>;
  onBack: () => void;
}) {
  const { t } = useLanguage();
  const [saved, setSaved] = useState<SavedResponse[]>(assessment.responses);
  const [answer, setAnswer] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [confidence, setConfidence] = useState(3);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const formId = useId();
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const fieldError = (name: string) =>
    issues.find((issue) => issue.fieldId === `${formId}-${name}`)?.message;
  const item = assessment.items.find(
    (i) => !saved.some((r) => r.item_id === i.id),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = collectIssues(event.currentTarget);
    setIssues(validation);
    setError("");
    if (validation.length) return;
    setBusy(true);
    setError("");
    try {
      let next = saved;
      if (item) {
        const r = await api<{ id: string }>(
          `/assessments/${assessment.id}/responses`,
          token,
          post({ item_id: item.id, answer, reasoning, confidence }),
        );
        next = [
          ...saved,
          { id: r.id, item_id: item.id, answer, reasoning, confidence },
        ];
        setSaved(next);
        setAnswer("");
        setReasoning("");
        setConfidence(3);
        setIssues([]);
      }
      if (next.length === assessment.items.length) {
        const completed = await api<Assessment>(
          `/assessments/${assessment.id}/complete`,
          token,
          post(),
        );
        await onComplete(completed);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="assessment-shell">
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={16} />
        {t("Back to workspace", "กลับไปหน้าหลัก")}
      </button>
      <div className="assessment-top">
        <Pill>{pretty(assessment.stage)} assessment</Pill>
        <span>
          {Math.min(saved.length + 1, assessment.items.length)} /{" "}
          {assessment.items.length} questions
        </span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={t("Assessment completion", "ความคืบหน้าของแบบประเมิน")}
        aria-valuemin={0}
        aria-valuemax={assessment.items.length}
        aria-valuenow={saved.length}
      >
        <div
          style={{
            transform: `scaleX(${assessment.items.length ? saved.length / assessment.items.length : 0})`,
          }}
        />
      </div>
      <form
        className="panel assessment-card"
        onSubmit={submit}
        noValidate
        aria-busy={busy}
      >
        <FormFeedback issues={issues} message={error} />
        {item ? (
          <>
            <div className="eyebrow">{pretty(item.concept_id)}</div>
            <h1 className="motion-feedback assessment-prompt" key={item.id}>
              {item.prompt}
            </h1>
            <p>
              {t("Take your time. Your explanation helps us understand your approach.", "ค่อย ๆ ทำได้ คำอธิบายจะช่วยให้เราเข้าใจวิธีคิดของคุณ")}
            </p>
            {item.kind === "multiple_choice" ? (
              <fieldset>
                <legend>{t("Choose your answer", "เลือกคำตอบ")}</legend>
                <div className="answer-options">
                  {item.options.map((option, i) => (
                    <label
                      className={
                        "answer-option " + (answer === option ? "selected" : "")
                      }
                      key={option}
                    >
                      <input
                        type="radio"
                        name="answer"
                        data-error-label={t("Choose your answer", "เลือกคำตอบ")}
                        id={`${formId}-answer${i ? "-" + i : ""}`}
                        aria-invalid={!!fieldError("answer")}
                        aria-describedby={
                          fieldError("answer")
                            ? `${formId}-answer-error`
                            : undefined
                        }
                        required
                        value={option}
                        checked={answer === option}
                        onChange={() => setAnswer(option)}
                      />
                      <span className="option-letter">
                        {String.fromCharCode(65 + i)}
                      </span>
                      {option}
                    </label>
                  ))}
                </div>
                {fieldError("answer") && (
                  <span className="field-error" id={`${formId}-answer-error`}>
                    {fieldError("answer")}
                  </span>
                )}
              </fieldset>
            ) : (
              <label>
                {t("Your answer", "คำตอบของคุณ")}
                <input
                  aria-label={t("Your answer", "คำตอบของคุณ")}
                  id={`${formId}-answer`}
                  aria-invalid={!!fieldError("answer")}
                  aria-describedby={
                    fieldError("answer") ? `${formId}-answer-error` : undefined
                  }
                  required
                  maxLength={2000}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
                {fieldError("answer") && (
                  <span className="field-error" id={`${formId}-answer-error`}>
                    {fieldError("answer")}
                  </span>
                )}
              </label>
            )}
            <label>
              <span id={`${formId}-reasoning-label`}>
                {t("Explain your thinking", "อธิบายวิธีคิด")}
              </span>
              <textarea
                id={`${formId}-reasoning`}
                aria-labelledby={`${formId}-reasoning-label`}
                data-error-label={t("Explain your thinking", "อธิบายวิธีคิด")}
                aria-invalid={!!fieldError("reasoning")}
                aria-describedby={
                  fieldError("reasoning")
                    ? `${formId}-reasoning-error`
                    : undefined
                }
                required
                maxLength={4000}
                rows={4}
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                placeholder={t("What steps did you take, and why?", "ทำอย่างไรและเพราะอะไร")}
              />
              {fieldError("reasoning") && (
                <span className="field-error" id={`${formId}-reasoning-error`}>
                  {fieldError("reasoning")}
                </span>
              )}
            </label>
            <fieldset>
              <legend>{t("How confident do you feel?", "มั่นใจแค่ไหน")}</legend>
              <div className="confidence-options">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label className={confidence === n ? "selected" : ""} key={n}>
                    <input
                      type="radio"
                      name="confidence"
                      value={n}
                      checked={confidence === n}
                      onChange={() => setConfidence(n)}
                    />
                    <b>{n}</b>
                    <span>
                      {
                        [
                          t("Unsure", "ไม่แน่ใจ"),
                          t("A little", "เล็กน้อย"),
                          t("Somewhat", "ปานกลาง"),
                          t("Confident", "มั่นใจ"),
                          t("Very sure", "มั่นใจมาก"),
                        ][n - 1]
                      }
                    </span>
                  </label>
                ))}
              </div>
              <small>
                {t("Confidence describes how you feel; it does not prove understanding.", "ความมั่นใจสะท้อนความรู้สึกของคุณ และใช้ร่วมกับหลักฐานจากคำตอบ")}
              </small>
            </fieldset>
          </>
        ) : (
          <>
            <h1>{t("All answers saved.", "บันทึกคำตอบครบแล้ว")}</h1>
            <p>{t("Finish to see your observations.", "ส่งแบบประเมินเพื่อดูผล")}</p>
          </>
        )}
        <div className="assessment-actions">
          <span>
            <LockKeyhole size={14} />
            {t("Original answers are preserved", "ระบบเก็บคำตอบต้นฉบับไว้")}
          </span>
          <button className="primary" disabled={busy}>
            {busy
              ? t("Saving…", "กำลังบันทึก…")
              : !item || saved.length + 1 === assessment.items.length
                ? t("Finish assessment", "ส่งแบบประเมิน")
                : t("Save & continue", "บันทึกและทำต่อ")}
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </div>
  );
}
