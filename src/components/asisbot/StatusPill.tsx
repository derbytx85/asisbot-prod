import { STATUS_LABEL, statusPillClass } from "./types";

export function StatusPill({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  return <span className={`${statusPillClass(status)} ${className}`}>{STATUS_LABEL[status] ?? status}</span>;
}
