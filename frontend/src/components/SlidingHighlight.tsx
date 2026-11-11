import { useLayoutEffect, useRef } from "react";

/** One persistent highlight follows the selected button within its own group. */
export function SlidingHighlight({ activeKey }: { activeKey: string }) {
  const markerRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const marker = markerRef.current;
    const group = marker?.parentElement;
    if (!marker || !group) return;
    let alive = true;
    let frame = 0;
    function measure() {
      if (!alive || !marker || !group) return;
      const selected = group.querySelector<HTMLElement>(
        'button[data-slide-active="true"]',
      );
      marker.dataset.visible = String(!!selected);
      if (!selected) return;
      const bounds = selected.getBoundingClientRect();
      const origin = group.getBoundingClientRect();
      marker.style.transform = `translate3d(${bounds.left - origin.left + group.scrollLeft - group.clientLeft}px, ${bounds.top - origin.top + group.scrollTop - group.clientTop}px, 0)`;
      marker.style.width = `${bounds.width}px`;
      marker.style.height = `${bounds.height}px`;
      if (!marker.dataset.ready) {
        marker.dataset.ready = "true";
        frame = requestAnimationFrame(() => {
          if (alive) marker.dataset.animate = "true";
        });
      }
    }
    measureRef.current = measure;
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    group
      .querySelectorAll("button")
      .forEach((button) => observer.observe(button));
    measure();
    void document.fonts?.ready.then(() => {
      if (alive) measure();
    });
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      measureRef.current = null;
      delete marker.dataset.ready;
      delete marker.dataset.animate;
    };
  }, []);

  useLayoutEffect(() => {
    measureRef.current?.();
  }, [activeKey]);

  return (
    <span className="sliding-highlight" ref={markerRef} aria-hidden="true" />
  );
}
