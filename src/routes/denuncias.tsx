/* eslint-disable @typescript-eslint/no-explicit-any -- Google Maps JS API é carregada sem tipos */
import { Link, Outlet, createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { DaysOpenBadge } from "@/components/DaysOpenBadge";
import { Header } from "@/components/Header";
import { ALMENARA_CENTER, MAP_STYLES, loadGoogleMaps } from "@/lib/google-maps-loader";
import { REPORT_TYPES, reportTypes, type ReportType } from "@/lib/report-types";
import { daysOpen, shortAddress, type PublicReport } from "@/lib/reports";
import { listPublicReports } from "@/lib/reports.functions";

export const Route = createFileRoute("/denuncias")({
  head: () => ({
    meta: [
      { title: "Denúncias em Almenara — Almenara Vigia" },
      {
        name: "description",
        content:
          "Mapa público das denúncias de problemas urbanos em Almenara e há quantos dias cada uma espera uma resposta da prefeitura.",
      },
      { property: "og:title", content: "Denúncias em Almenara — Almenara Vigia" },
      {
        property: "og:description",
        content:
          "Buracos, entulho, lâmpadas queimadas: veja no mapa o que a população denunciou e há quantos dias está sem solução.",
      },
    ],
  }),
  loader: () => listPublicReports(),
  component: ReportsPage,
});

const BRAND_HEX = "#a51212";

function waitingSummary(reports: PublicReport[], oldest: PublicReport | undefined) {
  if (!oldest) return "Nenhuma denúncia registrada ainda.";
  const days = daysOpen(oldest);
  const since = days === 1 ? "há 1 dia" : `há ${days} dias`;
  if (reports.length === 1) {
    return `1 problema aguardando a prefeitura, denunciado ${days === 0 ? "hoje" : since}.`;
  }
  return `${reports.length} problemas aguardando a prefeitura — o mais antigo ${days === 0 ? "foi denunciado hoje" : `espera ${since}`}.`;
}

function ReportsPage() {
  const reports = Route.useLoaderData();
  const navigate = useNavigate();
  const openProtocol = useParams({ strict: false, select: (params) => params.protocol });
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<any>(null);
  const mapsApi = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  const cardRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<ReportType | "todos">("todos");

  const selected = useMemo(() => {
    const protocol = openProtocol?.toUpperCase();
    return reports.find((report) => report.protocol === protocol)?.id ?? null;
  }, [reports, openProtocol]);

  // Latest navigate for marker listeners, which are bound once per marker
  const openReport = useRef((protocol: string) => {
    void navigate({
      to: "/denuncias/$protocol",
      params: { protocol },
      state: { fromList: true },
      resetScroll: false,
    });
  });

  const ordered = useMemo(
    () =>
      [...reports].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [reports],
  );

  const visible = useMemo(
    () => ordered.filter((report) => filter === "todos" || report.type === filter),
    [ordered, filter],
  );

  const counts = useMemo(() => {
    const base = Object.fromEntries(REPORT_TYPES.map((key) => [key, 0])) as Record<
      ReportType,
      number
    >;
    for (const report of reports) base[report.type] += 1;
    return base;
  }, [reports]);

  const oldest = ordered[0];

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapRef.current) return;
        mapsApi.current = maps;
        mapObj.current = new maps.Map(mapRef.current, {
          center: ALMENARA_CENTER,
          zoom: 14,
          styles: MAP_STYLES,
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
        });
        setReady(true);
      })
      .catch(() => setReady(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Reconcile markers with the visible reports
  useEffect(() => {
    const maps = mapsApi.current;
    const map = mapObj.current;
    if (!ready || !maps || !map) return;

    const keep = new Set(visible.map((report) => report.id));
    for (const [id, marker] of markers.current) {
      if (!keep.has(id)) {
        marker.setMap(null);
        markers.current.delete(id);
      }
    }

    for (const report of visible) {
      const isSelected = selected === report.id;
      const meta = reportTypes[report.type];
      const icon = {
        path: maps.SymbolPath.CIRCLE,
        scale: isSelected ? 18 : 14,
        fillColor: "#ffffff",
        fillOpacity: 1,
        strokeColor: BRAND_HEX,
        strokeWeight: isSelected ? 4 : 2,
      };
      const label = { text: meta.emoji, fontSize: isSelected ? "20px" : "16px" };

      const existing = markers.current.get(report.id);
      if (existing) {
        existing.setIcon(icon);
        existing.setLabel(label);
        existing.setZIndex(isSelected ? 999 : 1);
        continue;
      }

      const marker = new maps.Marker({
        map,
        position: { lat: report.lat, lng: report.lng },
        icon,
        label,
        title: `${meta.label} · ${report.protocol}`,
      });
      marker.addListener("click", () => openReport.current(report.protocol));
      markers.current.set(report.id, marker);
    }
  }, [ready, visible, selected]);

  // Focus the map on the selected report
  useEffect(() => {
    const map = mapObj.current;
    if (!ready || !map || !selected) return;
    const report = reports.find((item) => item.id === selected);
    if (!report) return;
    map.panTo({ lat: report.lat, lng: report.lng });
    map.setZoom(16);
  }, [ready, selected, reports]);

  // Bring the selected card into view when a marker is clicked
  useEffect(() => {
    if (!selected) return;
    cardRefs.current.get(selected)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header variant="denuncias" />

      <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Denúncias em Almenara</h1>
            <p className="mt-1 text-sm text-muted-foreground">{waitingSummary(reports, oldest)}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_minmax(0,420px)]">
          <div className="relative h-[420px] overflow-hidden rounded-2xl border border-border bg-muted shadow-card lg:h-[calc(100vh-13rem)]">
            <div ref={mapRef} className="absolute inset-0" />
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-card shadow-card lg:h-[calc(100vh-13rem)]">
            <div className="flex flex-wrap gap-2 border-b border-border p-4">
              {(["todos", ...REPORT_TYPES] as const).map((key) => {
                const count = key === "todos" ? reports.length : counts[key];
                const active = filter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    disabled={count === 0 && !active}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-default disabled:opacity-45 ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground enabled:hover:bg-secondary"
                    }`}
                  >
                    {key === "todos"
                      ? "Todos"
                      : `${reportTypes[key].emoji} ${reportTypes[key].label}`}
                    <span
                      className={`rounded-full px-1.5 text-[11px] ${
                        active ? "bg-primary-foreground/20" : "bg-card"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {visible.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {filter === "todos"
                    ? "Nenhuma denúncia registrada ainda."
                    : "Nenhuma denúncia deste tipo."}
                </p>
              ) : null}

              {visible.map((report) => {
                const meta = reportTypes[report.type];
                const isSelected = selected === report.id;
                return (
                  <Link
                    key={report.id}
                    ref={(node) => {
                      if (node) cardRefs.current.set(report.id, node);
                      else cardRefs.current.delete(report.id);
                    }}
                    to="/denuncias/$protocol"
                    params={{ protocol: report.protocol }}
                    state={{ fromList: true }}
                    resetScroll={false}
                    className={`group block overflow-hidden rounded-xl border transition-shadow ${
                      isSelected
                        ? "border-primary shadow-float"
                        : "border-border bg-card hover:shadow-float"
                    }`}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-neutral-900">
                      <img
                        src={report.photoUrl}
                        alt={`Foto da denúncia: ${meta.label} em ${shortAddress(report.address)}`}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <div className="absolute top-2.5 right-2.5">
                        <DaysOpenBadge report={report} />
                      </div>
                    </div>
                    <div className="p-3.5">
                      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <span aria-hidden="true">{meta.emoji}</span>
                        {meta.label}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {shortAddress(report.address)}
                      </p>
                      {report.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground italic">
                          “{report.description}”
                        </p>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      <Outlet />
    </div>
  );
}
