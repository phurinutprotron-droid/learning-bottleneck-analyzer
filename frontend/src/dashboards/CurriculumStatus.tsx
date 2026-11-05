import { Pending } from "../components/motion";
import { Empty, ErrorNotice, Notice, PageHeader } from "../components/ui";
import { ExamDraftPanel } from "./ExamDraftPanel";
import { useResource } from "../hooks/useResource";

type Source = {
  title: string;
  source_url: string;
  status: string;
  year_be: number;
  revision: string;
  sha256: string | null;
  pages: number;
  needs_ocr: number;
  candidate_pages: number;
  revision_conflict: boolean;
};

export function CurriculumStatus({ token, teacher }: { token: string; teacher: boolean }) {
  const { data, loading, error } = useResource<{
    sources: Source[];
    verified_indicators: number;
    priority_grades: number[];
  }>("/curriculum/status", token);

  return (
    <>
      <PageHeader eyebrow="OFFICIAL SOURCE REVIEW" title="Curriculum intake" subtitle="Track source downloads and review readiness." />
      {teacher && <ExamDraftPanel token={token} />}
      <ErrorNotice message={error} />
      {loading && <Pending label="Loading curriculum intake…" skeleton />}
      {data && (
        <>
          <Notice>
            Priority grades: {data.priority_grades.join(", ")}. Verified indicators: {data.verified_indicators}.
            The exam generator uses only the reviewed indicator mappings.
          </Notice>
          {data.sources.length === 0 && <Empty title="No ingestion reports yet">Run the OBEC PDF intake to stage source pages.</Empty>}
          {data.sources.map(source => (
            <section className="panel" key={source.source_url + (source.sha256 ?? source.status)}>
              <h2>{source.title}</h2>
              <p>B.E. {source.year_be} · {source.revision} · {source.status.replaceAll("_", " ")}</p>
              <p>{source.pages} pages processed · {source.candidate_pages} pages with candidate codes · {source.needs_ocr} pages awaiting OCR</p>
              {source.revision_conflict && <Notice>The same PDF was retrieved for multiple claimed revisions. Confirm the edition from the source pages before review.</Notice>}
              <a href={source.source_url} target="_blank" rel="noreferrer">Open OBEC source</a>
            </section>
          ))}
        </>
      )}
    </>
  );
}
