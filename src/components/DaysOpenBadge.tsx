import { formatDaysOpen, urgencyOf, type PublicReport, type Urgency } from "@/lib/reports";

const urgencyClass: Record<Urgency, string> = {
  recente: "bg-muted text-foreground",
  atrasada: "bg-primary text-primary-foreground",
  esquecida: "bg-primary-deep text-primary-foreground",
};

export function DaysOpenBadge({ report }: { report: Pick<PublicReport, "createdAt"> }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wide uppercase ${urgencyClass[urgencyOf(report)]}`}
    >
      {formatDaysOpen(report)}
    </span>
  );
}
