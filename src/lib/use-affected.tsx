import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { setAffected } from "@/lib/affected.functions";
import { AffectedSync, type AffectedView } from "@/lib/affected-sync";
import type { PublicReport } from "@/lib/reports";

type Store = {
  entries: ReadonlyMap<string, AffectedView>;
  toggle: (report: PublicReport) => void;
  dismissError: (reportId: string) => void;
};

const AffectedContext = createContext<Store | null>(null);

function entryOf(report: PublicReport, local: AffectedView | undefined): AffectedView {
  return local ?? { count: report.affectedCount, byMe: report.affectedByMe, error: null };
}

/* Local overrides on top of the loader data, so the card and the open report always agree. */
export function AffectedProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ReadonlyMap<string, AffectedView>>(new Map());
  const syncs = useRef(new Map<string, AffectedSync>());
  const send = useServerFn(setAffected);

  const toggle = useCallback(
    (report: PublicReport) => {
      let sync = syncs.current.get(report.id);
      if (!sync) {
        sync = new AffectedSync(
          { count: report.affectedCount, byMe: report.affectedByMe },
          (wanted) => send({ data: { reportId: report.id, affected: wanted } }),
          (view) => setEntries((prev) => new Map(prev).set(report.id, view)),
        );
        syncs.current.set(report.id, sync);
      }
      sync.toggle();
    },
    [send],
  );

  const dismissError = useCallback((reportId: string) => {
    setEntries((prev) => {
      const entry = prev.get(reportId);
      if (!entry?.error) return prev;
      return new Map(prev).set(reportId, { ...entry, error: null });
    });
  }, []);

  const store = useMemo(() => ({ entries, toggle, dismissError }), [entries, toggle, dismissError]);
  return <AffectedContext.Provider value={store}>{children}</AffectedContext.Provider>;
}

export function useAffected(report: PublicReport) {
  const store = useContext(AffectedContext);
  if (!store) throw new Error("useAffected precisa estar dentro de AffectedProvider");
  const { toggle: toggleReport, dismissError: dismissReportError } = store;
  const entry = entryOf(report, store.entries.get(report.id));
  const toggle = useCallback(() => toggleReport(report), [toggleReport, report]);
  const dismissError = useCallback(
    () => dismissReportError(report.id),
    [dismissReportError, report.id],
  );
  return { ...entry, toggle, dismissError };
}
