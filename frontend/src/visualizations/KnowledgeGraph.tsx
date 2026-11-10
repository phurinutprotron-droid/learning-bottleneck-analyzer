import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type ReactFlowInstance,
  type Node,
  type Edge,
} from "@xyflow/react";
import { useEffect, useId, useRef, useState } from "react";
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
  const graphContainer = useRef<HTMLDivElement>(null);
  const flow = useRef<ReactFlowInstance | null>(null);
  const [selection, setSelection] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const container = graphContainer.current;
    if (!container) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        void flow.current?.fitView({
          padding: 0.2,
          minZoom: 0.01,
          maxZoom: 1.4,
        });
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  const selected = data.nodes.find((node) => node.id === selection);
  const path = selected
    ? tracePath(data.edges, selected.id)
    : new Set<number>();
  const highlighted = new Set<string>([selection]);
  for (const index of path) {
    highlighted.add(data.edges[index].source_id);
    highlighted.add(data.edges[index].target_id);
  }
  const nodes: Node[] = data.nodes.map((n, i) => ({
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
      borderRadius: "var(--ds-radius-16)",
      padding: 18,
      width: 210,
      fontSize: 14,
    },
  }));
  const edges: Edge[] = data.edges.map((e, i) => ({
    id: `${i}`,
    source: e.source_id,
    target: e.target_id,
    label: e.relationship_type,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: path.has(i) ? "var(--accent)" : "var(--muted)",
    },
    style: {
      stroke: path.has(i) ? "var(--accent)" : "var(--muted)",
      strokeWidth: path.has(i) ? 4 : 2,
      strokeDasharray: selected && !path.has(i) ? "4 4" : undefined,
    },
    labelStyle: { fill: "var(--text)", fontSize: 12 },
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
        ref={graphContainer}
        role="region"
        aria-label="Prerequisite concept graph"
      >
        <ReactFlow
          onInit={(instance) => {
            flow.current = instance;
          }}
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.2, minZoom: 0.01, maxZoom: 1.4 }}
          minZoom={0.01}
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeClick={(_, node) => setSelection(node.id)}
          onPaneClick={() => setSelection("")}
          edgesFocusable={false}
          elementsSelectable={false}
        >
          <Background color="var(--line)" gap={24} />
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
