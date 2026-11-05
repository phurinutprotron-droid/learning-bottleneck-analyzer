import type { ReactNode } from "react";
import { StatValue } from "./motion";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  CircleCheck,
} from "lucide-react";
export function Brand() {
  return (
    <div className="brand">
      <img className="brand-logo" src={import.meta.env.BASE_URL + "lba-logo.svg"} alt="" width={42} height={42} />
      <span>
        LBA<span className="brand-sub">Learning Bottleneck Analyzer</span>
      </span>
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <BookOpen size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice">{children}</div>;
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <div className="error motion-feedback" role="alert">
      {message}
    </div>
  ) : null;
}
export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="stat">
      <div className="stat-label">
        {label}
        <ArrowUpRight size={16} />
      </div>
      <StatValue value={value} />
      <span>{detail}</span>
    </div>
  );
}
export function Pill({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"pill " + tone}>{children}</span>;
}
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
export function SectionTitle({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {aside}
    </div>
  );
}
export const pretty = (s: string) =>
  s.replaceAll("_", " ").replaceAll(".", " / ");
export const percent = (n: number | null | undefined) =>
  n == null ? "—" : `${Math.round(n * 100)}%`;
export { ArrowRight, CircleCheck };
