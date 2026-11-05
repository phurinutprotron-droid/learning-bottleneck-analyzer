import { Check, Circle, GitBranch, Play, Sprout } from "lucide-react";
import { subjectLabel, useLanguage } from "../i18n";
import type { Assessment, Profile, Subject } from "../types";

const thaiConceptNames: Record<string, string> = {
  "Equivalent fractions": "เศษส่วนที่เท่ากัน",
  "Proportional reasoning": "การคิดเชิงสัดส่วน",
  "One-step equations": "สมการขั้นเดียว",
  "Particle model": "แบบจำลองอนุภาค",
  "Thermal energy transfer": "การถ่ายโอนพลังงานความร้อน",
  "Energy conservation": "การอนุรักษ์พลังงาน",
  "Variable state": "สถานะของตัวแปร",
  "Loop boundaries": "ขอบเขตการวนซ้ำ",
};

export function SubjectTree({ profile, subjects, busy, onOpen }: {
  profile: Profile;
  subjects: Subject[];
  busy: boolean;
  onOpen: (subject: Subject, open?: Assessment) => void;
}) {
  const { language, t } = useLanguage();
  return (
    <section className="learning-tree panel" aria-labelledby="learning-tree-title">
      <header className="learning-tree-heading">
        <Sprout aria-hidden="true" />
        <div>
          <h2 id="learning-tree-title">{t("Your learning tree", "ต้นไม้การเรียนรู้ของคุณ")}</h2>
          <p>{t("Choose a subject here to start or resume. A marked branch means an answer was saved.", "เลือกวิชาจากต้นไม้เพื่อเริ่มหรือทำต่อ กิ่งที่มีเครื่องหมายคือหัวข้อที่บันทึกคำตอบแล้ว")}</p>
        </div>
      </header>
      <ul className="learning-tree-subjects">
        {subjects.map(subject => {
          const assessments = profile.assessments.filter(a => a.subject_id === subject.id);
          const open = assessments.find(a => a.stage === "pre" && a.status === "open");
          const answered = new Set(assessments.flatMap(a => {
            const ids = new Set(a.responses.map(r => r.item_id));
            return a.items.filter(i => ids.has(i.id)).map(i => i.concept_id);
          }));
          const name = subjectLabel(subject.id, subject.name, language);
          const done = subject.concepts.filter(concept => answered.has(concept.id)).length;
          return (
            <li className="learning-tree-subject" key={subject.id}>
              <button className="secondary learning-tree-root" type="button"
                disabled={!profile.consent || busy || (!open && subject.baseline_item_count === 0)}
                onClick={() => onOpen(subject, open)}>
                <GitBranch aria-hidden="true" size={19} />
                <span><b>{name}</b><small>{open ? t("Resume assessment", "ทำแบบประเมินต่อ") : t("Start assessment", "เริ่มแบบประเมิน")}</small></span>
                <Play aria-hidden="true" size={16} />
              </button>
              <p className="learning-tree-count">{done}/{subject.concepts.length} {t("topics answered", "หัวข้อที่ตอบแล้ว")}</p>
              <ul className="learning-tree-branches" aria-label={name}>
                {subject.concepts.map(concept => {
                  const hasAnswer = answered.has(concept.id);
                  return (
                    <li key={concept.id} data-answered={hasAnswer}>
                      {hasAnswer ? <Check aria-hidden="true" size={16} /> : <Circle aria-hidden="true" size={14} />}
                      <span>{t(concept.name, thaiConceptNames[concept.name] ?? concept.name)}</span>
                      <small>{hasAnswer ? t("Answered", "ตอบแล้ว") : t("Not attempted", "ยังไม่ได้ทำ")}</small>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
