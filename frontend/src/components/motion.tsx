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

export function MotionSection({
  children,
  direction = "forward",
}: {
  children: ReactNode;
  direction?: "forward" | "backward";
}) {
  return (
    <div className="motion-enter pane-slide" data-direction={direction}>
      {children}
    </div>
  );
}

export function LoadingMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`loading-mark${compact ? " loading-mark-compact" : ""}`}
      aria-hidden="true"
    >
      <span className="loading-orbit" />
      <img
        src={import.meta.env.BASE_URL + "lba-logo.svg"}
        alt=""
        width={24}
        height={24}
      />
    </span>
  );
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
      className={`motion-pending loading-state${skeleton ? " motion-skeleton" : ""}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <LoadingMark />
      <span className="loading-label">{label}</span>
      {skeleton && (
        <span className="loading-skeletons" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
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
