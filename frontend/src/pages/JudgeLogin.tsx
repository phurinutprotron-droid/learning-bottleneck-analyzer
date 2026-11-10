import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Presentation } from "lucide-react";
import { useLanguage } from "../i18n";
import { createJudgeSession, judgeCredentials } from "../services/judgePreview";
import { ErrorNotice } from "../components/ui";
import type { Session, User } from "../types";

export function JudgeLogin({
  onSession,
  onBack,
}: {
  onSession: (session: Session) => void;
  onBack: () => void;
}) {
  const { t } = useLanguage();
  const [role, setRole] = useState<User["role"]>("student");
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (
      data.get("judge_handle") !== judgeCredentials.handle ||
      data.get("judge_password") !== judgeCredentials.password
    ) {
      setError(
        t(
          "Use the public preview credentials shown on this page.",
          "ใช้ชื่อผู้ใช้และรหัสสำหรับพื้นที่สาธิตที่แสดงในหน้านี้",
        ),
      );
      return;
    }
    onSession(createJudgeSession(role));
  }
  return (
    <section className="judge-login motion-enter" aria-labelledby="judge-title">
      <span className="judge-heading-icon">
        <Presentation size={26} aria-hidden="true" />
      </span>
      <h2 id="judge-title">{t("Welcome, judges", "ยินดีต้อนรับคณะกรรมการ")}</h2>
      <p>
        {t(
          "Public, read-only demonstration with example data. Your sign-in details are already filled in.",
          "พื้นที่สาธิตสาธารณะสำหรับชมข้อมูลตัวอย่าง ใส่ข้อมูลเข้าสู่ระบบไว้ให้แล้ว",
        )}
      </p>
      <ErrorNotice message={error} />
      <form onSubmit={submit}>
        <label>
          {t("Preview username", "ชื่อผู้ใช้สำหรับกรรมการ")}
          <input
            name="judge_handle"
            defaultValue={judgeCredentials.handle}
            required
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          {t("Preview password", "รหัสผ่านสำหรับกรรมการ")}
          <span className="judge-password">
            <input
              name="judge_password"
              defaultValue={judgeCredentials.password}
              type={visible ? "text" : "password"}
              required
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="icon-button"
              aria-label={
                visible
                  ? t("Hide password", "ซ่อนรหัสผ่าน")
                  : t("Show password", "แสดงรหัสผ่าน")
              }
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        <label>
          {t("Choose a view", "เลือกมุมมองที่ต้องการชม")}
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as User["role"])}
          >
            <option value="student">
              {t("Student portal", "มุมนักเรียน")}
            </option>
            <option value="teacher">{t("Teacher portal", "มุมครู")}</option>
            <option value="researcher">
              {t("Research dashboard", "มุมนักวิจัย")}
            </option>
          </select>
        </label>
        <button type="submit" className="primary wide">
          {t("Open judge preview", "เข้าสู่พื้นที่สำหรับกรรมการ")}
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      </form>
      <button type="button" className="text-button" onClick={onBack}>
        {t("Return to normal sign in", "กลับไปหน้าเข้าสู่ระบบทั่วไป")}
      </button>
      <p className="judge-login-note">
        {t(
          "Preview data is fixed and illustrative. Saving answers, generating AI content and exporting records are disabled.",
          "ข้อมูลเป็นตัวอย่างที่เตรียมไว้ การบันทึกคำตอบ การเรียก AI และการส่งออกข้อมูลถูกปิดในพื้นที่นี้",
        )}
      </p>
    </section>
  );
}
