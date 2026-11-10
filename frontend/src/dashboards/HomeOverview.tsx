import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Sprout,
} from "lucide-react";
import { StatValue } from "../components/motion";
import { subjectLabel, useLanguage } from "../i18n";
import type { Assessment, Profile, Subject } from "../types";

function activityBuckets(
  assessments: Assessment[],
  months: boolean,
  language: string,
) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const locale = language === "th" ? "th-TH" : "en-GB";
  return Array.from({ length: 6 }, (_, i) => {
    const start = months
      ? new Date(today.getFullYear(), today.getMonth() - 5 + i, 1)
      : new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - today.getDay() - 35 + i * 7,
        );
    const end = months
      ? new Date(start.getFullYear(), start.getMonth() + 1, 1)
      : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    const count = assessments.filter((a) => {
      const date = new Date(a.created_at);
      return date >= start && date < end;
    }).length;
    const label = start.toLocaleDateString(
      locale,
      months ? { month: "short" } : { day: "numeric", month: "short" },
    );
    return { label, count };
  });
}

export function HomeOverview({
  profile,
  subjects,
  onResume,
  children,
}: {
  profile: Profile;
  subjects: Subject[];
  onResume: (assessment: Assessment) => void;
  children: ReactNode;
}) {
  const { language, t } = useLanguage();
  const [period, setPeriod] = useState<"weeks" | "months">("weeks");
  const completed = profile.assessments.filter(
    (a) => a.status === "completed",
  ).length;
  const saved = profile.assessments.reduce(
    (sum, a) => sum + a.responses.length,
    0,
  );
  const answered = new Set(
    profile.assessments.flatMap((a) => {
      const ids = new Set(a.responses.map((r) => r.item_id));
      return a.items
        .filter((item) => ids.has(item.id))
        .map((item) => `${a.subject_id}:${item.concept_id}`);
    }),
  );
  const total = subjects.reduce((sum, s) => sum + s.concepts.length, 0);
  const attempted = subjects.reduce(
    (sum, s) =>
      sum + s.concepts.filter((c) => answered.has(`${s.id}:${c.id}`)).length,
    0,
  );
  const progress = total ? Math.round((attempted / total) * 100) : 0;
  const buckets = activityBuckets(
    profile.assessments,
    period === "months",
    language,
  );
  const maximum = Math.max(1, ...buckets.map((b) => b.count));
  const history = [...profile.assessments].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  const recent = history.slice(0, 4);
  const open = history.find((a) => a.status === "open");

  return (
    <>
      <div className="home-overview">
        <section
          className="home-card home-summary"
          aria-labelledby="home-summary-title"
        >
          <div className="home-card-heading">
            <span className="home-kicker">
              <Sprout size={18} aria-hidden="true" /> LBA /{" "}
              {t("YOUR LEARNING", "การเรียนรู้ของคุณ")}
            </span>
            <ArrowUpRight size={19} aria-hidden="true" />
          </div>
          <div>
            <h2 id="home-summary-title">
              {t("One step further.", "เรียนรู้ไปอีกขั้น")}
            </h2>
            <p>
              {t(
                "A little more understanding, one question at a time.",
                "ค่อย ๆ เข้าใจมากขึ้น ทีละคำถาม",
              )}
            </p>
          </div>
          <div className="home-summary-number">
            <StatValue value={completed} />
            <span>{t("assessments completed", "แบบประเมินที่ทำเสร็จ")}</span>
          </div>
          <div className="home-summary-footer">
            <span>{t("Saved answers", "คำตอบที่บันทึกแล้ว")}</span>
            <b>
              {saved}
              <Check size={14} aria-hidden="true" />
            </b>
          </div>
        </section>

        <section
          className="home-card home-activity"
          aria-labelledby="home-activity-title"
        >
          <div className="home-card-heading">
            <h2 id="home-activity-title">
              <CalendarDays size={18} aria-hidden="true" />
              {t("Learning activity", "กิจกรรมการเรียนรู้")}
            </h2>
            <div
              className="home-period"
              role="group"
              aria-label={t("Activity period", "ช่วงเวลากิจกรรม")}
            >
              <button
                type="button"
                data-period="weeks"
                aria-pressed={period === "weeks"}
                onClick={() => setPeriod("weeks")}
              >
                {t("Weekly", "รายสัปดาห์")}
              </button>
              <button
                type="button"
                data-period="months"
                aria-pressed={period === "months"}
                onClick={() => setPeriod("months")}
              >
                {t("Monthly", "รายเดือน")}
              </button>
            </div>
          </div>
          <p className="home-card-caption">
            {t("Assessments started in the last six", "แบบประเมินที่เริ่มใน 6")}
            {period === "weeks"
              ? t(" weeks", " สัปดาห์ล่าสุด")
              : t(" months", " เดือนล่าสุด")}
          </p>
          <div
            className="home-chart"
            role="img"
            aria-label={buckets.map((b) => `${b.label}: ${b.count}`).join("; ")}
          >
            <div className="home-chart-grid" aria-hidden="true">
              <span>{maximum}</span>
              <span>{t("Assessments", "แบบประเมิน")}</span>
              <span>0</span>
            </div>
            <div className="home-bars" aria-hidden="true">
              {buckets.map((bucket, i) => (
                <div className="home-bar-column" key={i}>
                  <div
                    className="home-bar-space"
                  >
                    <b>{bucket.count}</b>
                    <div
                      className="home-bar-fill"
                      data-current={i === 5}
                      style={{ transform: `scaleY(${bucket.count / maximum})` }}
                    />
                  </div>
                  <span>{bucket.label}</span>
                </div>
              ))}
            </div>
          </div>
          {!profile.assessments.length && (
            <p className="home-chart-empty">
              {t(
                "Your first assessment will appear here.",
                "เมื่อเริ่มทำแบบประเมิน กิจกรรมจะแสดงที่นี่",
              )}
            </p>
          )}
        </section>

        <section
          className="home-card home-coverage"
          aria-labelledby="home-coverage-title"
        >
          <div className="home-card-heading">
            <h2 id="home-coverage-title">
              {t("Topics explored", "หัวข้อที่ได้ลองทำ")}
            </h2>
            <BookOpen size={18} aria-hidden="true" />
          </div>
          <div
            className="home-ring"
            role="img"
            aria-label={`${attempted}/${total} ${t("topics with saved answers", "หัวข้อที่บันทึกคำตอบแล้ว")}`}
          >
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle className="home-ring-track" cx="60" cy="60" r="50" />
              <circle
                className="home-ring-value"
                cx="60"
                cy="60"
                r="50"
                pathLength="100"
                strokeDasharray={`${progress} 100`}
              />
            </svg>
            <div>
              <strong>
                {progress}
                <small>%</small>
              </strong>
              <span>
                {attempted} / {total} {t("topics", "หัวข้อ")}
              </span>
            </div>
          </div>
          <p>
            {t(
              "Topics with a saved answer. Understanding is reviewed in your learning profile.",
              "นับหัวข้อที่บันทึกคำตอบแล้ว ดูผลความเข้าใจได้ในหน้าโปรไฟล์การเรียน",
            )}
          </p>
          <a className="home-resume" href="#learning-tree-title">
            {t("Choose a subject", "เลือกรายวิชา")}
            <ChevronRight size={17} aria-hidden="true" />
          </a>
          {open && (
            <button
              type="button"
              className="home-continue"
              onClick={() => onResume(open)}
            >
              {t("Continue assessment", "ทำแบบประเมินต่อ")}
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          )}
        </section>
      </div>
      {children}
      {recent.length > 0 && (
        <section
          className="home-card home-recent"
          aria-labelledby="home-recent-title"
        >
          <div className="home-card-heading">
            <div>
              <h2 id="home-recent-title">
                {t("Recent assessments", "แบบประเมินล่าสุด")}
              </h2>
              <p>
                {t(
                  "Your latest learning sessions",
                  "กลับมาดูสิ่งที่คุณได้ลองทำ",
                )}
              </p>
            </div>
            <span className="home-kicker">
              {profile.assessments.length} {t("TOTAL", "ทั้งหมด")}
            </span>
          </div>
          <div className="home-history-list">
            {recent.map((a) => (
              <div className="home-history-row" key={a.id}>
                <span className="home-subject-icon">
                  <BookOpen size={18} aria-hidden="true" />
                </span>
                <div>
                  <b>
                    {subjectLabel(
                      a.subject_id,
                      subjects.find((s) => s.id === a.subject_id)?.name ??
                        a.subject_id,
                      language,
                    )}
                  </b>
                  <small>
                    {new Date(a.created_at).toLocaleDateString(
                      language === "th" ? "th-TH" : "en-GB",
                      { day: "numeric", month: "short", year: "numeric" },
                    )}
                  </small>
                </div>
                <span className="home-history-count">
                  {a.responses.length}/{a.items.length}{" "}
                  {t("saved", "บันทึกแล้ว")}
                </span>
                {a.status === "open" ? (
                  <button
                    type="button"
                    className="home-history-action"
                    onClick={() => onResume(a)}
                  >
                    {t("Resume", "ทำต่อ")}
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                ) : (
                  <span className="home-complete">
                    <i />
                    {t("Completed", "เสร็จแล้ว")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
