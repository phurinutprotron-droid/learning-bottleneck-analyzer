import { useState, type FormEvent } from "react";
import { ErrorNotice, Notice } from "../components/ui";
import { Pending } from "../components/motion";
import { useResource } from "../hooks/useResource";
import { api, post } from "../services/api";

type Indicator = {
  id: string;
  code: string;
  topic: string;
  grade: string;
  subject: string;
  curriculum_revision_be: number;
  source_url: string;
};

type Draft = {
  indicator: Indicator;
  seed: number | string;
  model?: string;
  template_version: string;
  items: { prompt: string; options: string[]; answer_index: number; explanation: string }[];
};
type AIDraft = {
  id: string;
  model: string;
  indicator: { code: string; excerpt: string; source_url: string };
  items: Draft["items"];
};
const subjects = {
  thai: "ภาษาไทย", math: "คณิตศาสตร์", science: "วิทยาศาสตร์และเทคโนโลยี",
  social: "สังคมศึกษา ศาสนา และวัฒนธรรม", history: "ประวัติศาสตร์",
  health: "สุขศึกษาและพลศึกษา", arts: "ศิลปะ", career: "การงานอาชีพ",
  language: "ภาษาต่างประเทศ",
};
const officialSources = [
  "https://www.academic.obec.go.th/web/news/view/75",
  "https://www.academic.obec.go.th/web/mission/view/34",
];

const letters = ["ก", "ข", "ค", "ง"];

export function ExamDraftPanel({ token }: { token: string }) {
  const catalog = useResource<Indicator[]>("/curriculum/exam-indicators", token);
  const [mode, setMode] = useState<"qwen" | "template">("qwen");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setReviewed(false);
    setDraft(null);
    try {
      if (mode === "qwen") {
        const grade = Number(data.get("grade"));
        const subject = data.get("subject") as keyof typeof subjects;
        const result = await api<AIDraft>("/curriculum/ai-exam-drafts", token, post({
          grade, subject, code: data.get("code"), excerpt: data.get("excerpt"),
          source_url: data.get("source"), count: Number(data.get("count")),
          allow_paid: data.get("allow_paid") === "on",
        }));
        setDraft({
          seed: result.id, model: result.model, template_version: result.model, items: result.items,
          indicator: {
            id: result.indicator.code, code: result.indicator.code, topic: result.indicator.excerpt,
            subject: subjects[subject], grade: "ม." + (grade - 6),
            source_url: result.indicator.source_url, curriculum_revision_be: 2551,
          },
        });
      } else {
        setDraft(await api<Draft>("/curriculum/exam-drafts", token, post({
          indicator_id: data.get("indicator"), count: Number(data.get("count")),
        })));
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function download(includeAnswers: boolean) {
    if (!draft || !reviewed) return;
    const { indicator, items } = draft;
    const lines = [
      includeAnswers ? "เฉลยข้อสอบ" : "ข้อสอบปรนัย",
      indicator.subject + " " + indicator.grade + " · " + indicator.code,
      indicator.topic,
      draft.model ? "อ้างอิงตัวชี้วัด สพฐ. ที่ครูระบุ" : "อ้างอิง สพฐ. ฉบับปรับปรุง พ.ศ. " + indicator.curriculum_revision_be,
      indicator.source_url,
      "รหัสชุดข้อสอบ: " + draft.template_version + " / " + draft.seed,
      "",
    ];
    items.forEach((item, index) => {
      lines.push((index + 1) + ". " + item.prompt);
      if (includeAnswers) {
        lines.push("คำตอบ: " + letters[item.answer_index] + ". " + item.options[item.answer_index], item.explanation);
      } else {
        item.options.forEach((option, choice) => lines.push(letters[choice] + ". " + option));
      }
      lines.push("");
    });
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = (includeAnswers ? "lba-answers-" : "lba-exam-") + draft.seed + ".txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="panel stack" lang="th">
      <h2>สร้างข้อสอบตามตัวชี้วัด สพฐ.</h2>
      <Notice>เลือกชั้น ม.1–ม.3 และกลุ่มสาระ แล้วใส่รหัสและข้อความตัวชี้วัดจากเอกสาร สพฐ. ร่างจาก AI ต้องตรวจความตรงกับหลักสูตรและความถูกต้องของเฉลยก่อนใช้</Notice>
      <ErrorNotice message={error || (mode === "template" ? catalog.error : "")} />
      <label>วิธีสร้างข้อสอบ
        <select value={mode} disabled={busy} onChange={event => {
          setMode(event.target.value as typeof mode);
          setDraft(null);
          setReviewed(false);
          setError("");
        }}>
          <option value="qwen">Qwen 3.6 27B · ม.1–ม.3</option>
          <option value="template">แม่แบบคณิตศาสตร์ ม.1</option>
        </select>
      </label>
      {mode === "template" && catalog.loading && <Pending label="กำลังโหลดตัวชี้วัด…" />}
      <form key={mode} className="stack" onSubmit={submit}>
        <fieldset className="stack" disabled={busy}>
          {mode === "qwen" ? (
            <>
              <label>ระดับชั้น<select name="grade">{[7, 8, 9].map(grade => <option key={grade} value={grade}>ม.{grade - 6}</option>)}</select></label>
              <label>กลุ่มสาระ / รายวิชา<select name="subject">{Object.entries(subjects).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
              <label>แหล่งอ้างอิง สพฐ.
                <select name="source">
                  <option value={officialSources[0]}>ตัวชี้วัดระหว่างทางและปลายทาง</option>
                  <option value={officialSources[1]}>หลักสูตรแกนกลางและเอกสารรายกลุ่มสาระ</option>
                </select>
              </label>
              <p><a href={officialSources[0]} target="_blank" rel="noreferrer">เปิดหน้าตัวชี้วัด</a> · <a href={officialSources[1]} target="_blank" rel="noreferrer">เปิดเอกสารหลักสูตร</a></p>
              <label>รหัสตัวชี้วัด<input name="code" required minLength={3} maxLength={60} /></label>
              <label>ข้อความตัวชี้วัดจากเอกสาร<textarea name="excerpt" required minLength={12} maxLength={2500} rows={4} /></label>
              <label><input type="checkbox" name="allow_paid" required /> ยืนยันการเรียก Qwen ซึ่งอาจมีค่าใช้จ่าย</label>
            </>
          ) : (
            <label>ตัวชี้วัด<select name="indicator" required>
              {catalog.data?.map(indicator => <option key={indicator.id} value={indicator.id}>{indicator.code} · {indicator.topic}</option>)}
            </select></label>
          )}
          <label>จำนวนข้อ (1–{mode === "qwen" ? 10 : 20})
            <input name="count" type="number" required min={1} max={mode === "qwen" ? 10 : 20} defaultValue={3} />
          </label>
          <button className="primary" disabled={busy || (mode === "template" && !catalog.data?.length)}>สร้างร่างข้อสอบ</button>
        </fieldset>
      </form>
      {busy && <Pending label="กำลังสร้างร่างข้อสอบ…" />}
      {draft && (
        <div className="stack motion-enter">
          <p>{draft.indicator.code} · {draft.model || "ฉบับปรับปรุง พ.ศ. " + draft.indicator.curriculum_revision_be} · รหัสชุด {draft.seed}</p>
          <a href={draft.indicator.source_url} target="_blank" rel="noreferrer">เปิดเอกสารหลักสูตรของ สพฐ.</a>
          <ol className="stack">
            {draft.items.map(item => (
              <li key={item.prompt}>
                <p>{item.prompt}</p>
                <ul>{item.options.map((option, i) => <li key={option}>{letters[i]}. {option}</li>)}</ul>
                <details>
                  <summary>ดูเฉลยและวิธีคิด</summary>
                  <p>{letters[item.answer_index]}. {item.options[item.answer_index]} · {item.explanation}</p>
                </details>
              </li>
            ))}
          </ol>
          <label>
            <input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />
            ฉันตรวจทานข้อสอบและเฉลยชุดนี้แล้ว
          </label>
          <div className="row">
            <button className="secondary" disabled={!reviewed} onClick={() => download(false)}>ดาวน์โหลดข้อสอบ</button>
            <button className="secondary" disabled={!reviewed} onClick={() => download(true)}>ดาวน์โหลดเฉลย</button>
          </div>
        </div>
      )}
    </section>
  );
}
