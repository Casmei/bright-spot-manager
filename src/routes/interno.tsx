import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { ALMENARA_CENTER, MAP_STYLES, loadGoogleMaps } from "@/lib/google-maps-loader";
import {
  formatAge,
  ticketUrgency,
  urgencyMeta,
  useTickets,
  type Urgency,
} from "@/lib/tickets";

export const Route = createFileRoute("/interno")({
  head: () => ({
    meta: [
      { title: "Painel interno de chamados — Cemig Iluminação Pública" },
      {
        name: "description",
        content:
          "Mapa e lista dos postes com lâmpadas queimadas aguardando manutenção, priorizados pelo tempo de espera.",
      },
      { property: "og:title", content: "Painel interno de chamados — Cemig" },
      {
        property: "og:description",
        content: "Visualize no mapa todos os chamados de troca de lâmpada por tempo de espera.",
      },
    ],
  }),
  component: InternalPage,
});

const filters: Array<{ key: Urgency | "todos"; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "novo", label: "Recentes" },
  { key: "atencao", label: "Atenção" },
  { key: "critico", label: "Críticos" },
];

function InternalPage() {
  const tickets = useTickets();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<any>(null);
  const mapsApi = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  const infoWindow = useRef<any>(null);

  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Urgency | "todos">("todos");

  const visible = useMemo(
    () =>
      tickets
        .filter((ticket) => filter === "todos" || ticketUrgency(ticket) === filter)
        .sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
    [tickets, filter],
  );

  const counts = useMemo(() => {
    const base: Record<Urgency, number> = { novo: 0, atencao: 0, critico: 0 };
    for (const ticket of tickets) base[ticketUrgency(ticket)] += 1;
    return base;
  }, [tickets]);

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

  // Reconcile markers with the visible tickets
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
      const urgency = ticketUrgency(ticket);
      const isSelected = selected === ticket.id;
      const icon = {
        path: maps.SymbolPath.CIRCLE,
        scale: isSelected ? 13 : 9,
        fillColor: urgencyMeta[urgency].hex,
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: isSelected ? 4 : 2,
      };

      const existing = markers.current.get(ticket.id);
      if (existing) {
        existing.setIcon(icon);
        existing.setZIndex(isSelected ? 999 : 1);
        continue;
      }

      const marker = new maps.Marker({
        map,
        position: { lat: ticket.lat, lng: ticket.lng },
        icon,
        title: ticket.protocol,
      });
      marker.addListener("click", () => setSelected(ticket.id));
      markers.current.set(ticket.id, marker);
    }
  }, [ready, visible, selected]);

  // Focus the map on the selected ticket
  useEffect(() => {
    const map = mapObj.current;
    if (!ready || !map || !selected) return;
    const ticket = visible.find((item) => item.id === selected);
    if (!ticket) return;
    map.panTo({ lat: ticket.lat, lng: ticket.lng });
    map.setZoom(16);
    const marker = markers.current.get(ticket.id);
    if (marker && infoWindow.current) {
      infoWindow.current.setContent(
        `<div style="font-family:inherit;font-size:12px;max-width:220px"><strong>${ticket.protocol}</strong><br/>${ticket.address}</div>`,
      );
      infoWindow.current.open({ anchor: marker, map });
    }
  }, [ready, selected, visible]);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header variant="interno" />

      <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Chamados de iluminação</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tickets.length} postes aguardando manutenção — priorize os mais antigos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(urgencyMeta) as Urgency[]).map((key) => (
              <div
                key={key}
                className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-card"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: urgencyMeta[key].hex }}
                />
                {urgencyMeta[key].label}
                <span className="text-muted-foreground">{counts[key]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_minmax(0,420px)]">
          <div className="relative h-[420px] overflow-hidden rounded-2xl border border-border bg-muted shadow-card lg:h-[calc(100vh-13rem)]">
            <div ref={mapRef} className="absolute inset-0" />
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-card shadow-card lg:h-[calc(100vh-13rem)]">
            <div className="flex gap-2 border-b border-border p-4">
              {filters.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    filter === item.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {visible.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum chamado neste filtro.
                </p>
              ) : null}

              {visible.map((ticket) => {
                const urgency = ticketUrgency(ticket);
                const isSelected = selected === ticket.id;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => setSelected(ticket.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-shadow ${
                      isSelected
                        ? "border-primary bg-secondary shadow-float"
                        : "border-border bg-card hover:shadow-card"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: urgencyMeta[urgency].hex }}
                        />
                        <span className="text-sm font-bold text-foreground">
                          {ticket.protocol}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {formatAge(ticket)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-foreground">{ticket.address}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ticket.name} · {ticket.whatsapp}
                    </p>
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
