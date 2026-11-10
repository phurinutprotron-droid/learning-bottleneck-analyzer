import { LanguagePicker, useLanguage } from "../i18n";
import { useId, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  GitBranch,
  Layers3,
  Microscope,
} from "lucide-react";
import { Brand } from "../components/ui";
import { LoadingMark } from "../components/motion";
import { JudgeLogin } from "./JudgeLogin";
import {
  collectIssues,
  FormFeedback,
  type FieldIssue,
} from "../components/FormFeedback";
import { api, post } from "../services/api";
import type { Session } from "../types";
const portals = ["student", "teacher", "researcher"] as const;

const portalStories = {
  student: {
    motto: "SMALL STEPS. REAL PROGRESS.",
    lead: "Find your footing.",
    emphasis: "Keep moving forward.",
    description:
      "See what you understand today and find one thing to work on next.",
    mottoTh: "ก้าวเล็ก ๆ สู่ความก้าวหน้า",
    leadTh: "เริ่มจากสิ่งที่เข้าใจ",
    emphasisTh: "แล้วค่อย ๆ ไปต่อ",
    descriptionTh: "ดูว่าวันนี้เข้าใจเรื่องไหน และเลือกหัวข้อที่จะฝึกต่อ",
  },
  teacher: {
    motto: "LESS GUESSWORK. BETTER QUESTIONS.",
    lead: "See where learning stalls.",
    emphasis: "Know what to ask next.",
    description:
      "Connect classroom evidence and choose a next step you can verify.",
    mottoTh: "เข้าใจจุดติดขัด ตั้งคำถามได้ตรงจุด",
    leadTh: "ดูว่านักเรียนติดตรงไหน",
    emphasisTh: "เลือกคำถามต่อไป",
    descriptionTh: "เชื่อมหลักฐานในชั้นเรียนกับขั้นตอนที่ตรวจสอบได้",
  },
  researcher: {
    motto: "CLEAR EVIDENCE. CAREFUL CONCLUSIONS.",
    lead: "Follow the evidence.",
    emphasis: "Test what holds up.",
    description:
      "Compare learning patterns, check assumptions, and keep the limits of the data in view.",
    mottoTh: "หลักฐานชัด สรุปอย่างรอบคอบ",
    leadTh: "ตามหลักฐาน",
    emphasisTh: "ทดสอบว่าสิ่งใดยืนยันได้",
    descriptionTh: "เปรียบเทียบรูปแบบการเรียนรู้และพิจารณาข้อจำกัดของข้อมูล",
  },
  judge: {
    motto: "EXPLORE THE LEARNING JOURNEY.",
    lead: "A closer look at LBA.",
    emphasis: "Prepared for the judges.",
    description:
      "Explore the student, teacher and research views using clearly labelled example data.",
    mottoTh: "ชมเส้นทางการเรียนรู้ไปด้วยกัน",
    leadTh: "ทำความรู้จัก LBA",
    emphasisTh: "พื้นที่สำหรับคณะกรรมการ",
    descriptionTh:
      "เลือกชมมุมนักเรียน ครู และนักวิจัย ผ่านข้อมูลตัวอย่างที่เตรียมไว้",
  },
} as const;

export function AuthPage({
  onSession,
}: {
  onSession: (session: Session) => void;
}) {
  const { t } = useLanguage();
  const [judgeMode, setJudgeMode] = useState(
    () =>
      new URLSearchParams(window.location.search).get("portal") === "judge" ||
      window.location.pathname.endsWith("/judge/login"),
  );
  const [portal, setPortal] = useState<(typeof portals)[number]>(() =>
    window.location.pathname.endsWith("/teacher/login")
      ? "teacher"
      : window.location.pathname.endsWith("/researcher/login")
        ? "researcher"
        : "student",
  );
  const names = {
    student: t("Student", "นักเรียน"),
    teacher: t("Teacher", "ครู"),
    researcher: t("Researcher", "นักวิจัย"),
  };
  const title = names[portal];
  const activePortal = judgeMode ? "judge" : portal;
  function openJudgeMode(value: boolean) {
    setJudgeMode(value);
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("portal", "judge");
    else url.searchParams.delete("portal");
    if (url.pathname.endsWith("/judge/login"))
      url.pathname = import.meta.env.BASE_URL;
    window.history.replaceState(null, "", url);
  }
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const formId = useId();
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const fieldError = (name: string) =>
    issues.find((issue) => issue.fieldId === `${formId}-${name}`)?.message;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = collectIssues(event.currentTarget);
    setIssues(validation);
    setError("");
    if (validation.length) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      onSession(
        await api<Session>(
          register ? "/auth/register" : `/auth/login/${portal}`,
          undefined,
          post({
            handle: form.get("handle"),
            password: form.get("password"),
            ...(register ? { grade: Number(form.get("grade")) } : {}),
          }),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout motion-enter" data-portal={activePortal}>
      <section className="auth-story">
        <Brand />
        <div className="auth-copy">
          <div className="portal-stories">
            {([...portals, "judge"] as const).map((choice) => {
              const story = portalStories[choice];
              return (
                <div
                  className="portal-story-copy"
                  key={choice}
                  aria-hidden={activePortal !== choice}
                >
                  <div className="eyebrow">{t(story.motto, story.mottoTh)}</div>
                  <h1>
                    {t(story.lead, story.leadTh)}
                    <br />
                    <em>{t(story.emphasis, story.emphasisTh)}</em>
                  </h1>
                  <p>{t(story.description, story.descriptionTh)}</p>
                </div>
              );
            })}
          </div>
          <div className="story-path">
            <span>
              <Layers3 />
              Observe
            </span>
            <i />
            <span>
              <GitBranch />
              Verify
            </span>
            <i />
            <span>
              <Microscope />
              Evaluate
            </span>
          </div>
        </div>
        <div className="auth-footer">
          An evidence-driven approach to learning · Research MVP
        </div>
      </section>
      <main className="auth-form">
        <Preamble />
        <div className="auth-language">
          <LanguagePicker />
        </div>
        <div className="auth-box">
          {judgeMode ? (
            <JudgeLogin
              onSession={onSession}
              onBack={() => openJudgeMode(false)}
            />
          ) : (
            <>
              <nav
                className="portal-picker"
                aria-label={t("Sign-in portal", "ประเภทผู้ใช้")}
              >
                {portals.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={portal === choice}
                    disabled={busy}
                    onClick={() => {
                      setPortal(choice);
                      setRegister(false);
                      setError("");
                      setIssues([]);
                    }}
                  >
                    {names[choice]}
                  </button>
                ))}
              </nav>
              <div className="portal-content motion-enter" key={portal}>
                <h2>
                  {register
                    ? t("Create a learner account", "สร้างบัญชีนักเรียน")
                    : t(`${title} sign in`, `เข้าสู่ระบบสำหรับ${title}`)}
                </h2>
                <p>
                  {portal === "student"
                    ? t(
                        "Sign in to resume your assessments, or create a learner account.",
                        "เข้าสู่ระบบเพื่อทำแบบประเมินต่อ หรือสมัครบัญชีนักเรียน",
                      )
                    : t(
                        "Sign in with the staff account provided by your administrator.",
                        "ใช้บัญชีที่ผู้ดูแลระบบจัดให้",
                      )}
                </p>
                <form onSubmit={submit} noValidate aria-busy={busy}>
                  <FormFeedback issues={issues} message={error} />
                  <label>
                    <span id={`${formId}-handle-label`}>
                      {t("Anonymous handle", "ชื่อผู้ใช้")}
                    </span>
                    <input
                      name="handle"
                      id={`${formId}-handle`}
                      aria-labelledby={`${formId}-handle-label`}
                      data-error-label={t("Anonymous handle", "ชื่อผู้ใช้")}
                      aria-invalid={!!fieldError("handle")}
                      aria-describedby={
                        fieldError("handle")
                          ? `${formId}-handle-error`
                          : undefined
                      }
                      autoComplete="username"
                      required
                      minLength={3}
                      maxLength={64}
                      pattern="[A-Za-z0-9_-]+"
                      placeholder={
                        portal === "student"
                          ? "e.g. learner_07"
                          : `e.g. demo_${portal}`
                      }
                    />
                    {fieldError("handle") && (
                      <span
                        className="field-error"
                        id={`${formId}-handle-error`}
                      >
                        {fieldError("handle")}
                      </span>
                    )}
                  </label>
                  <label>
                    <span id={`${formId}-password-label`}>
                      {t("Password", "รหัสผ่าน")}
                    </span>
                    <input
                      name="password"
                      id={`${formId}-password`}
                      aria-labelledby={`${formId}-password-label`}
                      data-error-label={t("Password", "รหัสผ่าน")}
                      aria-invalid={!!fieldError("password")}
                      aria-describedby={
                        fieldError("password")
                          ? `${formId}-password-error`
                          : undefined
                      }
                      type="password"
                      autoComplete={
                        register ? "new-password" : "current-password"
                      }
                      required
                      minLength={10}
                      maxLength={128}
                      placeholder={t(
                        "At least 10 characters",
                        "อย่างน้อย 10 ตัวอักษร",
                      )}
                    />
                    {fieldError("password") && (
                      <span
                        className="field-error"
                        id={`${formId}-password-error`}
                      >
                        {fieldError("password")}
                      </span>
                    )}
                  </label>
                  {register && (
                    <label>
                      {t("Grade", "ระดับชั้น")}
                      <select name="grade" defaultValue="7">
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i} value={i + 1}>
                            {i + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button className="primary wide" disabled={busy}>
                    {busy
                      ? t("Connecting…", "กำลังเข้าสู่ระบบ…")
                      : register
                        ? t("Create learner account", "สมัครบัญชีนักเรียน")
                        : t("Sign in", "เข้าสู่ระบบ")}
                    {busy ? <LoadingMark compact /> : <ArrowRight size={17} />}
                  </button>
                </form>
                {portal === "student" && (
                  <button
                    disabled={busy}
                    className="text-button"
                    onClick={() => {
                      setRegister(!register);
                      setError("");
                      setIssues([]);
                    }}
                  >
                    {register
                      ? t(
                          "Already have an account? Sign in",
                          "มีบัญชีแล้ว? เข้าสู่ระบบ",
                        )
                      : t(
                          "New learner? Create an account",
                          "นักเรียนใหม่? สมัครบัญชี",
                        )}
                  </button>
                )}
              </div>
              <a
                className="judge-entry"
                href={`${import.meta.env.BASE_URL}?portal=judge`}
                onClick={(event) => {
                  event.preventDefault();
                  openJudgeMode(true);
                }}
              >
                {t(
                  "For judges · preview sign-in ready",
                  "สำหรับคณะกรรมการ · เตรียมรหัสให้แล้ว",
                )}
                <ArrowRight size={17} aria-hidden="true" />
              </a>
              <div className="auth-note">
                <Check size={16} />
                <span>
                  Use a nickname. No student name or email is needed. Staff
                  accounts are provisioned by your administrator.
                </span>
              </div>
            </>
          )}
        </div>
        <footer>
          Sample educational content is unvalidated. This software does not
          establish a causal or clinical diagnosis.
        </footer>
      </main>
    </div>
  );
}
function Preamble() {
  return (
    <div className="auth-topline">
      LEARNING BOTTLENECK ANALYZER <span>v0.1 / PILOT BUILD</span>
    </div>
  );
}
