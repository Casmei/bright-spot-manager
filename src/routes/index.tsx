import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Header } from "@/components/Header";
import { BH_CENTER, MAP_STYLES, loadGoogleMaps } from "@/lib/google-maps-loader";
import { addTicket } from "@/lib/tickets";
import { geocodeAddress, reverseGeocode } from "@/lib/geocoding.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Solicitar troca de lâmpada — Cemig Iluminação Pública" },
      {
        name: "description",
        content:
          "Informe o local de um poste com lâmpada queimada ou apagada e acompanhe a solicitação junto à Cemig.",
      },
      { property: "og:title", content: "Solicitar troca de lâmpada — Cemig" },
      {
        property: "og:description",
        content: "Marque no mapa o poste com lâmpada apagada e registre sua solicitação.",
      },
    ],
  }),
  component: PublicPage,
});

const formSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo").max(100),
  whatsapp: z
    .string()
    .trim()
    .min(10, "Informe um WhatsApp com DDD")
    .max(20)
    .regex(/^[0-9()+\-\s]+$/, "Use apenas números, espaços e parênteses"),
  address: z.string().trim().min(5, "Informe ou confirme o endereço").max(250),
});

function PublicPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<any>(null);
  const markerObj = useRef<any>(null);

  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [locating, setLocating] = useState(true);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<string | null>(null);

  const findAddress = useServerFn(geocodeAddress);
  const findPoint = useServerFn(reverseGeocode);

  const placeMarker = useCallback((coords: { lat: number; lng: number }, zoom = 17) => {
    setPoint(coords);
    const map = mapObj.current;
    if (!map) return;
    map.setCenter(coords);
    map.setZoom(zoom);
    if (markerObj.current) {
      markerObj.current.setPosition(coords);
    }
  }, []);

  // Load the map
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapRef.current) return;
        const map = new maps.Map(mapRef.current, {
          center: BH_CENTER,
          zoom: 13,
          styles: MAP_STYLES,
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
        });
        mapObj.current = map;

        const marker = new maps.Marker({
          map,
          draggable: true,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 11,
            fillColor: "#0f6b4f",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
        markerObj.current = marker;
        marker.setVisible(false);

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          const coords = { lat: pos.lat(), lng: pos.lng() };
          setPoint(coords);
          void findPoint({ data: coords }).then((result) => {
            if (result) setAddress(result.address);
          });
        });

        map.addListener("click", (event: any) => {
          const coords = { lat: event.latLng.lat(), lng: event.latLng.lng() };
          marker.setVisible(true);
          marker.setPosition(coords);
          setPoint(coords);
          void findPoint({ data: coords }).then((result) => {
            if (result) setAddress(result.address);
          });
        });
      })
      .catch(() => setError("Não foi possível carregar o mapa agora."));

    return () => {
      cancelled = true;
    };
  }, [findPoint]);

  // Ask for the browser location as soon as the page opens
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        markerObj.current?.setVisible(true);
        placeMarker(coords);
        setLocating(false);
        setMessage("Encontramos você no mapa. Confirme o poste ou ajuste o ponto.");
        void findPoint({ data: coords }).then((result) => {
          if (result) setAddress(result.address);
        });
      },
      () => {
        setLocating(false);
        setMessage("Sem acesso à sua localização — digite o endereço do poste abaixo.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [findPoint, placeMarker]);

  async function handleSearch() {
    setError(null);
    if (address.trim().length < 5) {
      setError("Digite um endereço mais completo para buscar.");
      return;
    }
    setSearching(true);
    try {
      const result = await findAddress({ data: { address: address.trim() } });
      if (!result) {
        setError("Endereço não encontrado. Tente incluir número, bairro e cidade.");
        return;
      }
      setAddress(result.address);
      markerObj.current?.setVisible(true);
      placeMarker({ lat: result.lat, lng: result.lng });
      setMessage("Endereço localizado. Ajuste o ponto no mapa se precisar.");
    } catch {
      setError("Não conseguimos consultar o endereço agora. Tente novamente.");
    } finally {
      setSearching(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!point) {
      setError("Marque o local do poste no mapa ou busque o endereço.");
      return;
    }
    const parsed = formSchema.safeParse({ name, whatsapp, address });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifique os dados informados.");
      return;
    }
    const ticket = addTicket({
      name: parsed.data.name,
      whatsapp: parsed.data.whatsapp,
      address: parsed.data.address,
      lat: point.lat,
      lng: point.lng,
    });
    setProtocol(ticket.protocol);
  }

  function resetForm() {
    setProtocol(null);
    setName("");
    setWhatsapp("");
    setMessage(null);
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <section
        className="px-4 py-10 text-primary-foreground sm:px-6"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="mx-auto w-full max-w-[1400px]">
          <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">
            Iluminação pública
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl leading-tight font-bold sm:text-4xl">
            Lâmpada queimada ou apagada? Avise a Cemig em um minuto.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-primary-foreground/80">
            Confirme o ponto do poste no mapa, informe seu nome e WhatsApp. Avisamos você pelo
            WhatsApp quando a equipe concluir a troca.
          </p>
        </div>
      </section>

      <main className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          {protocol ? (
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-2xl">
                ✓
              </div>
              <h2 className="mt-4 text-xl font-bold text-foreground">Solicitação registrada</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Seu protocolo é{" "}
                <span className="font-semibold text-primary">{protocol}</span>. Guarde esse número
                para acompanhar o atendimento.
              </p>
              <button
                onClick={resetForm}
                className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Registrar outro poste
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Dados da solicitação</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {locating
                    ? "Buscando sua localização..."
                    : (message ?? "Clique no mapa ou digite o endereço do poste.")}
                </p>
              </div>

              <div>
                <label
                  htmlFor="address"
                  className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  Endereço do poste
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Rua, número, bairro e cidade"
                    maxLength={250}
                    className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                  />
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={searching}
                    className="rounded-xl border border-primary/25 bg-secondary px-3 py-2.5 text-sm font-semibold text-primary disabled:opacity-60"
                  >
                    {searching ? "..." : "Buscar"}
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
                {point
                  ? `Ponto confirmado: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
                  : "Nenhum ponto marcado no mapa ainda."}
              </div>

              <div>
                <label
                  htmlFor="name"
                  className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  Seu nome
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nome completo"
                  maxLength={100}
                  className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                />
              </div>

              <div>
                <label
                  htmlFor="whatsapp"
                  className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  WhatsApp
                </label>
                <input
                  id="whatsapp"
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(event.target.value)}
                  placeholder="(31) 99999-0000"
                  inputMode="tel"
                  maxLength={20}
                  className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                />
              </div>

              {error ? (
                <p className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Enviar solicitação
              </button>
            </form>
          )}
        </div>

        <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-border bg-muted shadow-card lg:min-h-[560px]">
          <div ref={mapRef} className="absolute inset-0" />
          <div className="pointer-events-none absolute top-4 left-4 rounded-full bg-card/95 px-4 py-2 text-xs font-semibold text-foreground shadow-float">
            Toque no mapa para marcar o poste
          </div>
        </div>
      </main>
    </div>
  );
}
