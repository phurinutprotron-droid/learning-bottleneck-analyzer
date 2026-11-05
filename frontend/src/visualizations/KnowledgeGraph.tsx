import { ReactFlow, Background, Controls, MarkerType } from "@xyflow/react";
import { useId, useRef, useState } from "react";
import { Pending } from "../components/motion";
import "@xyflow/react/dist/style.css";
import { useResource } from "../hooks/useResource";
import type { GraphData } from "../types";
import { ErrorNotice, Notice, Pill, SectionTitle } from "../components/ui";

function tracePath(edges: GraphData["edges"], start: string) {
  const path = new Set<number>();
  for (const direction of ["upstream", "downstream"]) {
    const visited = new Set<string>([start]);
    const pending = [start];
    while (pending.length) {
      const current = pending.pop();
      edges.forEach((edge, index) => {
        const upstream = direction === "upstream";
        if (
          edge.relationship_type !== "prerequisite" ||
          (upstream ? edge.target_id : edge.source_id) !== current
        )
          return;
        const next = upstream ? edge.source_id : edge.target_id;
        path.add(index);
        if (!visited.has(next)) {
          visited.add(next);
          pending.push(next);
        }
      });
    }
  }
  return path;
}
export function KnowledgeGraph({
  subject,
  token,
}: {
  subject: string;
  token: string;
}) {
  const { data, error, loading } = useResource<GraphData>(
    subject === "all" ? "/graph" : `/subjects/${subject}/graph`,
    token,
  );
  if (!data)
    return (
      <>
        <ErrorNotice message={error} />
        {loading && <Pending label="Loading concept relationships…" skeleton />}
      </>
    );
  return <InteractiveGraph key={subject} data={data} />;
}

function InteractiveGraph({ data }: { data: GraphData }) {
  const [selection, setSelection] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const selected = data.nodes.find((node) => node.id === selection);
  const path = selected
    ? tracePath(data.edges, selected.id)
    : new Set<number>();
  const highlighted = new Set<string>([selection]);
  for (const index of path) {
    highlighted.add(data.edges[index].source_id);
    highlighted.add(data.edges[index].target_id);
  }
  const nodes = data.nodes.map((n, i) => ({
    id: n.id,
    selected: n.id === selection,
    className:
      selected && !highlighted.has(n.id)
        ? "graph-node graph-node-muted"
        : "graph-node",
    position: { x: i * 260, y: (i % 2) * 95 },
    data: { label: n.name },
    style: {
      background: "var(--panel)",
      color: "var(--text)",
      border: highlighted.has(n.id)
        ? "2px solid var(--accent)"
        : "1px solid var(--line)",
      borderRadius: 12,
      padding: 18,
      width: 210,
      fontSize: 14,
    },
  }));
  const edges = data.edges.map((e, i) => ({
    id: `${i}`,
    source: e.source_id,
    target: e.target_id,
    label: e.relationship_type,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: path.has(i) ? "var(--accent)" : "#568775",
    },
    style: {
      stroke: path.has(i) ? "var(--accent)" : "#568775",
      strokeWidth: path.has(i) ? 4 : 2,
      strokeDasharray: selected && !path.has(i) ? "4 4" : undefined,
    },
    labelStyle: { fill: "#204b40", fontSize: 12 },
  }));
  return (
    <>
      <SectionTitle aside={<Pill>Sample graph · v1</Pill>}>
        How the concepts connect
      </SectionTitle>
      <div className="graph-controls">
        <label>
          Highlight a prerequisite path
          <select
            value={selection}
            onChange={(event) => setSelection(event.target.value)}
          >
            <option value="">All concepts</option>
            {data.nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary"
          type="button"
          disabled={!selected}
          onClick={() => dialog.current?.showModal()}
        >
          Concept details
        </button>
      </div>
      {selected && (
        <p
          className="graph-path motion-feedback"
          key={selected.id}
          role="status"
        >
          {selected.name} · {path.size} prerequisite connections highlighted.
        </p>
      )}
      <dialog
        className="panel motion-dialog"
        ref={dialog}
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>{selected?.name}</h2>
        <p>Topic: {selected?.topic}</p>
        <p>Skills: {selected?.skills.join(", ") || "No skills listed"}</p>
        <p>{data.validation.interpretation}</p>
        <form method="dialog">
          <button className="secondary" autoFocus>
            Close details
          </button>
        </form>
      </dialog>
      <div
        className="panel graph"
        role="region"
        aria-label="Prerequisite concept graph"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeClick={(_, node) => setSelection(node.id)}
          onPaneClick={() => setSelection("")}
          edgesFocusable={false}
          elementsSelectable={false}
        >
          <Background color="#9ba99f" gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <Notice>{data.validation.interpretation}</Notice>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Relationship</th>
              <th>Source</th>
              <th>Evidence status</th>
              <th>Review / version</th>
            </tr>
          </thead>
          <tbody>
            {data.edges.map((e, i) => (
              <tr key={i}>
                <td>
                  {e.source_id.split(".")[1]} → {e.target_id.split(".")[1]}
                  {path.has(i) && <span className="pill">Highlighted</span>}
                </td>
                <td>{e.source}</td>
                <td>{e.evidence_status}</td>
                <td>
                  {e.reviewer_status} / {e.version}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
