import { useState } from "react";
import { dataMotionMs, Pending, useReducedMotion } from "../components/motion";
import { Download, FlaskConical } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useResource } from "../hooks/useResource";
import { exportReport, api, post } from "../services/api";
import type { Research } from "../types";
import {
  PageHeader,
  Stat,
  Notice,
  Empty,
  SectionTitle,
  ErrorNotice,
  percent,
} from "../components/ui";
export function ResearchDashboard({
  token,
  revision,
  demo = false,
}: {
  token: string;
  revision: number;
  demo?: boolean;
}) {
  const [includeDemo, setIncludeDemo] = useState(demo);
  const reduced = useReducedMotion();
  const { data, error, loading } = useResource<Research>(
    `/research/summary?include_demo=${includeDemo}`,
    token,
    revision,
  );
  const [actionError, setActionError] = useState("");
  const [labels, setLabels] = useState("");
  const [evaluation, setEvaluation] = useState("");
  async function download() {
    try {
      await exportReport(token, includeDemo);
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  async function evaluate() {
    try {
      const rows = labels
        .trim()
        .split("\n")
        .map((r) => r.split(",").map((c) => c.trim()));
      if (rows.some((r) => r.length !== 2 || r.some((v) => !v)))
        throw new Error("Enter one reference,predicted pair per line.");
      const result = await api(
        "/research/evaluate",
        token,
        post({
          reference_labels: rows.map((r) => r[0]),
          predicted_labels: rows.map((r) => r[1]),
        }),
      );
      setEvaluation(JSON.stringify(result, null, 2));
      setActionError("");
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="RESEARCH WORKSPACE"
        title="Make the evidence visible."
        subtitle="Descriptive outcomes, transparent denominators, and questions still open."
        action={
          <button className="secondary" onClick={download}>
            <Download size={16} />
            Export aggregate report
          </button>
        }
      />
      <ErrorNotice message={error || actionError} />
      <label className="dataset-toggle">
        <input
          type="checkbox"
          checked={includeDemo}
          onChange={(e) => setIncludeDemo(e.target.checked)}
        />
        <span>Include demonstration accounts in this view and export</span>
      </label>
      {loading && <Pending label="Loading research records…" skeleton />}
      {data && (
        <>
          <div className="stats-grid">
            <Stat
              label="Learner records"
              value={data.students}
              detail="Anonymous local accounts"
            />
            <Stat
              label="Recorded responses"
              value={data.responses}
              detail="Original assessment observations"
            />
            <Stat
              label="Completed baselines"
              value={data.completed_baselines}
              detail="May include repeated learners"
            />
            <Stat
              label="Verification observations"
              value={data.verification.evaluated}
              detail={`${data.verification.with_contradictions} included a contradiction`}
            />
          </div>
          <Notice>
            {data.data_status}. {data.interpretation}
          </Notice>
          <div className="two-columns">
            <section className="panel">
              <SectionTitle>Follow-up performance</SectionTitle>
              {Object.values(data.stages).some((s) => s.performance.n) ? (
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={Object.entries(data.stages).map(([stage, s]) => ({
                        stage,
                        performance:
                          s.performance.mean == null
                            ? null
                            : s.performance.mean * 100,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="stage" />
                      <YAxis domain={[0, 100]} unit="%" />
                      <Tooltip />
                      <Bar
                        dataKey="performance"
                        isAnimationActive={!reduced}
                        animationDuration={dataMotionMs}
                        animationEasing="ease-out"
                        fill="var(--accent)"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty title="No follow-up results yet">
                  Completed post, transfer, and retention tasks will appear
                  here.
                </Empty>
              )}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Stage</th>
                      <th>n</th>
                      <th>Mean</th>
                      <th>Descriptive difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.stages).map(([stage, s]) => (
                      <tr key={stage}>
                        <td>{stage}</td>
                        <td>{s.performance.n}</td>
                        <td>{percent(s.performance.mean)}</td>
                        <td>
                          {s.descriptive_difference.mean == null
                            ? "—"
                            : `${(s.descriptive_difference.mean * 100).toFixed(1)} pp`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="caption">
                Different uncalibrated tasks. Differences are not equated
                learning gains or treatment effects.
              </p>
            </section>
            <section className="panel">
              <div className="section-icon">
                <FlaskConical size={21} />
              </div>
              <h2>What can we claim?</h2>
              <p>
                Verification may support or contradict an initial explanation.
                That does not establish accuracy without an independent
                reference.
              </p>
              <div className="research-callout">
                <b>Expert agreement</b>
                <span>Not collected in the local dataset</span>
              </div>
              <div className="research-callout">
                <b>Usability</b>
                <span>No participant ratings collected</span>
              </div>
              <div className="research-callout">
                <b>Causal effectiveness</b>
                <span>Requires an appropriate comparison design</span>
              </div>
              <h3>Exploratory reliability</h3>
              {data.reliability.length ? (
                data.reliability.map((r) => (
                  <p key={r.subject_version}>
                    {r.subject_version} · n={r.n} · α=
                    {r.cronbach_alpha?.toFixed(3) ?? "undefined"}
                  </p>
                ))
              ) : (
                <p>No complete baseline response matrix yet.</p>
              )}
            </section>
          </div>
          <section className="panel">
            <SectionTitle>Compute reference agreement</SectionTitle>
            <p>
              Supply deidentified category pairs from an independent reviewer.
              Inputs are used for this calculation only; they are not added to
              the dataset.
            </p>
            <label>
              Reference and predicted labels, one pair per line
              <textarea
                rows={4}
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
                placeholder="reference_label,predicted_label"
              />
            </label>
            <button
              className="secondary"
              onClick={evaluate}
              disabled={!labels.trim()}
            >
              Calculate agreement
            </button>
            {evaluation && <pre>{evaluation}</pre>}
          </section>
        </>
      )}
    </>
  );
}
