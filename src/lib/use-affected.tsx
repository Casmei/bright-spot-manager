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
import { AFFECTED_ERROR_MESSAGE, type PublicReport } from "@/lib/reports";

type Entry = { count: number; byMe: boolean; error: string | null };

type Store = {
  entries: ReadonlyMap<string, Entry>;
  toggle: (report: PublicReport) => Promise<void>;
  dismissError: (reportId: string) => void;
};

const AffectedContext = createContext<Store | null>(null);

function entryOf(report: PublicReport, local: Entry | undefined): Entry {
  return local ?? { count: report.affectedCount, byMe: report.affectedByMe, error: null };
}

/* Local overrides on top of the loader data, so the card and the open report always agree. */
export function AffectedProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ReadonlyMap<string, Entry>>(new Map());
  const latest = useRef(entries);
  latest.current = entries;
  const sequence = useRef(new Map<string, number>());
  const send = useServerFn(setAffected);

  const put = useCallback((reportId: string, entry: Entry) => {
    setEntries((prev) => new Map(prev).set(reportId, entry));
  }, []);

  const toggle = useCallback(
    async (report: PublicReport) => {
      const before = entryOf(report, latest.current.get(report.id));
      const wanted = !before.byMe;
      const call = (sequence.current.get(report.id) ?? 0) + 1;
      sequence.current.set(report.id, call);

      put(report.id, {
        count: Math.max(0, before.count + (wanted ? 1 : -1)),
        byMe: wanted,
        error: null,
      });

      const result = await send({ data: { reportId: report.id, affected: wanted } }).catch(
        () => null,
      );
      // A newer click owns the button now
      if (sequence.current.get(report.id) !== call) return;
      if (result?.ok) {
        put(report.id, { count: result.affectedCount, byMe: result.affectedByMe, error: null });
      } else {
        put(report.id, { ...before, error: result?.message ?? AFFECTED_ERROR_MESSAGE });
      }
    },
    [put, send],
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
  const toggle = useCallback(() => void toggleReport(report), [toggleReport, report]);
  const dismissError = useCallback(
    () => dismissReportError(report.id),
    [dismissReportError, report.id],
  );
  return { ...entry, toggle, dismissError };
}
