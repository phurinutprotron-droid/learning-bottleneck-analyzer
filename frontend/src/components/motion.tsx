import { useEffect, useRef, useState, type ReactNode } from "react";

export const dataMotionMs = 320;
const reducedQuery = "(prefers-reduced-motion: reduce)";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.(reducedQuery).matches ?? false,
  );
  useEffect(() => {
    const query = window.matchMedia?.(reducedQuery);
    const update = () => setReduced(query.matches);
    query?.addEventListener("change", update);
    return () => query?.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function MotionSection({ children }: { children: ReactNode }) {
  return <div className="motion-enter">{children}</div>;
}

export function Pending({
  label,
  skeleton = false,
}: {
  label: string;
  skeleton?: boolean;
}) {
  return (
    <div
      className={skeleton ? "motion-pending motion-skeleton" : "motion-pending"}
      role="status"
    >
      {label}
      <span className="motion-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {skeleton && <span className="motion-placeholder" aria-hidden="true" />}
    </div>
  );
}

export function StatValue({ value }: { value: number | string }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const from = current.current;
    if (
      reduced ||
      typeof from !== "number" ||
      typeof value !== "number" ||
      from === value
    ) {
      current.current = value;
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(tick);
    function tick(now: number) {
      const fraction = Math.min(1, (now - start) / dataMotionMs);
      current.current =
        fraction === 1
          ? value
          : Math.round(
              Number(from) +
                (Number(value) - Number(from)) * (1 - (1 - fraction) ** 3),
            );
      setDisplay(current.current);
      if (fraction < 1) frame = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return (
    <strong>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true">
        {reduced || typeof value !== "number" ? value : display}
      </span>
    </strong>
  );
}
