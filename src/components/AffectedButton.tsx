import { useEffect } from "react";
import { Check, Users } from "lucide-react";
import { useAffected } from "@/lib/use-affected";
import { affectedAriaLabel, affectedSentence, type PublicReport } from "@/lib/reports";

const ERROR_VISIBLE_MS = 5000;

export function AffectedButton({
  report,
  variant,
}: {
  report: PublicReport;
  variant: "compact" | "full";
}) {
  const { count, byMe, error, toggle, dismissError } = useAffected(report);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(dismissError, ERROR_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [error, dismissError]);

  const state = byMe
    ? "border-primary bg-primary text-primary-foreground hover:opacity-90"
    : "border-border bg-card text-foreground hover:bg-muted";

  const errorLine = (
    <p aria-live="polite" className="text-xs font-medium text-primary empty:hidden">
      {error}
    </p>
  );

  if (variant === "compact") {
    return (
      <div className="grid justify-items-start gap-1.5">
        <button
          type="button"
          aria-pressed={byMe}
          aria-label={affectedAriaLabel(count)}
          onClick={toggle}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${state}`}
        >
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="tabular-nums">{count}</span>
          <span aria-hidden="true">·</span>
          Me afeta
          {byMe ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
        </button>
        {errorLine}
      </div>
    );
  }

  const sentence = affectedSentence({ count, byMe });
  return (
    <div className="grid gap-2">
      <button
        type="button"
        aria-pressed={byMe}
        onClick={toggle}
        className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${state}`}
      >
        <Users className="h-4 w-4" aria-hidden="true" />
        {byMe ? "Me afeta" : "Me afeta também"}
        {byMe ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
      </button>
      <p className="text-sm text-muted-foreground">
        {sentence.lead ? <strong className="text-foreground">{sentence.lead}</strong> : null}
        {sentence.rest}
      </p>
      {errorLine}
    </div>
  );
}
