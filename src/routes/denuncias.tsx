/* eslint-disable @typescript-eslint/no-explicit-any -- Google Maps JS API é carregada sem tipos */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { ALMENARA_CENTER, MAP_STYLES, loadGoogleMaps } from "@/lib/google-maps-loader";
import { REPORT_TYPES, reportTypes, type ReportType } from "@/lib/report-types";
import { formatDaysOpen, usePublicTickets } from "@/lib/tickets";

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
  component: ReportsPage,
});

const BRAND_HEX = "#a51212";

/* Address and description come from the public form; never inject them as HTML. */
function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ReportsPage() {
  const tickets = usePublicTickets();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<any>(null);
  const mapsApi = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  const infoWindow = useRef<any>(null);
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReportType | "todos">("todos");

  const ordered = useMemo(
    () =>
      [...tickets].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [tickets],
  );

  const visible = useMemo(
    () => ordered.filter((ticket) => filter === "todos" || ticket.type === filter),
    [ordered, filter],
  );

  const counts = useMemo(() => {
    const base = Object.fromEntries(REPORT_TYPES.map((key) => [key, 0])) as Record<
      ReportType,
      number
    >;
    for (const ticket of tickets) base[ticket.type] += 1;
    return base;
  }, [tickets]);

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
        infoWindow.current = new maps.InfoWindow();
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

    const keep = new Set(visible.map((ticket) => ticket.id));
    for (const [id, marker] of markers.current) {
      if (!keep.has(id)) {
        marker.setMap(null);
        markers.current.delete(id);
      }
    }

    for (const ticket of visible) {
      const isSelected = selected === ticket.id;
      const meta = reportTypes[ticket.type];
      const icon = {
        path: maps.SymbolPath.CIRCLE,
        scale: isSelected ? 18 : 14,
        fillColor: "#ffffff",
        fillOpacity: 1,
        strokeColor: BRAND_HEX,
        strokeWeight: isSelected ? 4 : 2,
      };
      const label = { text: meta.emoji, fontSize: isSelected ? "20px" : "16px" };

      const existing = markers.current.get(ticket.id);
      if (existing) {
        existing.setIcon(icon);
        existing.setLabel(label);
        existing.setZIndex(isSelected ? 999 : 1);
        continue;
      }

      const marker = new maps.Marker({
        map,
        position: { lat: ticket.lat, lng: ticket.lng },
        icon,
        label,
        title: `${meta.label} · ${ticket.protocol}`,
      });
      marker.addListener("click", () => setSelected(ticket.id));
      markers.current.set(ticket.id, marker);
    }
  }, [ready, visible, selected]);

  // Focus the map on the selected report
  useEffect(() => {
    const map = mapObj.current;
    if (!ready || !map || !selected) return;
    const ticket = visible.find((item) => item.id === selected);
    if (!ticket) {
      infoWindow.current?.close();
      return;
    }
    map.panTo({ lat: ticket.lat, lng: ticket.lng });
    map.setZoom(16);
    const marker = markers.current.get(ticket.id);
    if (marker && infoWindow.current) {
      const meta = reportTypes[ticket.type];
      infoWindow.current.setContent(
        `<div style="font-family:inherit;font-size:12px;max-width:240px">` +
          `<strong>${meta.emoji} ${escapeHtml(meta.label)}</strong> · ${escapeHtml(ticket.protocol)}<br/>` +
          `${escapeHtml(ticket.address)}<br/>` +
          `<span style="color:${BRAND_HEX};font-weight:700">${formatDaysOpen(ticket)}</span>` +
          `</div>`,
      );
      infoWindow.current.open({ anchor: marker, map });
    }
  }, [ready, selected, visible]);

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
            <p className="mt-1 text-sm text-muted-foreground">
              {oldest
                ? `${tickets.length} ${tickets.length === 1 ? "problema aguardando" : "problemas aguardando"} a prefeitura — a mais antiga foi feita ${formatDaysOpen(oldest).toLowerCase()}.`
                : "Nenhuma denúncia registrada ainda."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {REPORT_TYPES.filter((key) => counts[key] > 0).map((key) => (
              <div
                key={key}
                title={reportTypes[key].label}
                aria-label={`${reportTypes[key].label}: ${counts[key]}`}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-card"
              >
                <span aria-hidden="true">{reportTypes[key].emoji}</span>
                <span aria-hidden="true">{counts[key]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_minmax(0,420px)]">
          <div className="relative h-[420px] overflow-hidden rounded-2xl border border-border bg-muted shadow-card lg:h-[calc(100vh-13rem)]">
            <div ref={mapRef} className="absolute inset-0" />
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-card shadow-card lg:h-[calc(100vh-13rem)]">
            <div className="flex flex-wrap gap-2 border-b border-border p-4">
              {(["todos", ...REPORT_TYPES] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    filter === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {key === "todos"
                    ? "Todos"
                    : `${reportTypes[key].emoji} ${reportTypes[key].label}`}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {visible.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {filter === "todos"
                    ? "Nenhuma denúncia registrada ainda."
                    : "Nenhuma denúncia deste tipo."}
                </p>
              ) : null}

              {visible.map((ticket) => {
                const meta = reportTypes[ticket.type];
                const isSelected = selected === ticket.id;
                return (
                  <button
                    key={ticket.id}
                    ref={(node) => {
                      if (node) cardRefs.current.set(ticket.id, node);
                      else cardRefs.current.delete(ticket.id);
                    }}
                    onClick={() => setSelected(ticket.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-shadow ${
                      isSelected
                        ? "border-primary bg-secondary shadow-float"
                        : "border-border bg-card hover:shadow-card"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span aria-hidden="true" className="text-lg">
                          {meta.emoji}
                        </span>
                        <span className="text-sm font-bold text-foreground">{meta.label}</span>
                      </div>
                      <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-primary-foreground uppercase">
                        {formatDaysOpen(ticket)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {ticket.protocol}
                    </p>
                    {ticket.photo ? (
                      <img
                        src={ticket.photo}
                        alt={`Foto da denúncia ${ticket.protocol}`}
                        className="mt-3 h-28 w-full rounded-lg border border-border object-cover"
                      />
                    ) : null}
                    <p className="mt-2 text-sm text-foreground">{ticket.address}</p>
                    {ticket.description ? (
                      <p className="mt-1 text-sm text-muted-foreground italic">
                        “{ticket.description}”
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
