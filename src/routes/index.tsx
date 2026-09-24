/* eslint-disable @typescript-eslint/no-explicit-any -- Google Maps JS API é carregada sem tipos */
import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Header } from "@/components/Header";
import { ALMENARA_CENTER, MAP_STYLES, loadGoogleMaps } from "@/lib/google-maps-loader";
import { REPORT_TYPES, reportTypes, type ReportType } from "@/lib/report-types";
import { PHOTO_REQUIRED_MESSAGE, reportFormSchema } from "@/lib/report-schema";
import { createReport } from "@/lib/reports.functions";
import {
  geocodeAddress,
  placeDetails,
  reverseGeocode,
  suggestAddresses,
  type AddressSuggestion,
} from "@/lib/geocoding.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fazer denúncia — Almenara Vigia" },
      {
        name: "description",
        content:
          "Denuncie buracos, entulho, lâmpadas queimadas e outros problemas de Almenara. A denúncia fica pública no mapa, com a contagem de dias sem solução.",
      },
      { property: "og:title", content: "Almenara Vigia — Denuncie e cobre a prefeitura" },
      {
        property: "og:description",
        content:
          "Tire uma foto do problema, marque no mapa e pressione a prefeitura por uma solução.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicPage,
});

type LocationStatus = "idle" | "locating" | "found" | "manual";

const locationHints: Record<LocationStatus, string> = {
  idle: "Comece pela foto do problema — a gente tenta achar o local sozinho.",
  locating: "Buscando sua localização...",
  found: "Local encontrado. Confira e complete a denúncia.",
  manual: "Digite o endereço ou toque no mapa para marcar o local.",
};

/* Shrinks a camera photo so it can be kept alongside the report. */
async function shrinkPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1000;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.75);
}

/* Asks the browser for the device location; resolves null when denied or unavailable. */
function browserLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

const inputClass =
  "mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25";
const labelClass = "text-xs font-semibold tracking-wide text-muted-foreground uppercase";

function PublicPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<any>(null);
  const markerObj = useRef<any>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const sessionToken = useRef<string>("");
  const suggestRequest = useRef(0);
  /* Bumped whenever the location is chosen another way, so late GPS/geocoding answers are ignored. */
  const locationRequest = useRef(0);

  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [type, setType] = useState<ReportType | "">("");
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const findAddress = useServerFn(geocodeAddress);
  const findPoint = useServerFn(reverseGeocode);
  const findSuggestions = useServerFn(suggestAddresses);
  const findPlace = useServerFn(placeDetails);
  const sendReport = useServerFn(createReport);

  function ensureSession() {
    if (!sessionToken.current) sessionToken.current = crypto.randomUUID();
    return sessionToken.current;
  }

  const placeMarker = useCallback((coords: { lat: number; lng: number }, zoom = 17) => {
    setPoint(coords);
    const map = mapObj.current;
    if (!map) return;
    map.setCenter(coords);
    map.setZoom(zoom);
    markerObj.current?.setVisible(true);
    markerObj.current?.setPosition(coords);
  }, []);

  /* Fills the address for a point; falls back to typing when it cannot be resolved. */
  const resolveAddress = useCallback(
    async (coords: { lat: number; lng: number }, request: number) => {
      try {
        const result = await findPoint({ data: coords });
        if (request !== locationRequest.current) return;
        if (result) {
          setAddress(result.address);
          setLocationStatus("found");
          return;
        }
      } catch {
        // handled below
      }
      if (request !== locationRequest.current) return;
      setAddress("");
      setLocationStatus("manual");
      setError("Não conseguimos identificar o endereço deste ponto. Digite-o abaixo.");
    },
    [findPoint],
  );

  // Load the map
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapRef.current) return;
        const map = new maps.Map(mapRef.current, {
          center: ALMENARA_CENTER,
          zoom: 15,
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
            fillColor: "#a51212",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
        markerObj.current = marker;
        marker.setVisible(false);

        const apply = (coords: { lat: number; lng: number }) => {
          setPoint(coords);
          setShowSuggestions(false);
          setError(null);
          void resolveAddress(coords, ++locationRequest.current);
        };

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          apply({ lat: pos.lat(), lng: pos.lng() });
        });

        map.addListener("click", (event: any) => {
          const coords = { lat: event.latLng.lat(), lng: event.latLng.lng() };
          marker.setVisible(true);
          marker.setPosition(coords);
          apply(coords);
        });
      })
      .catch(() => setError("Não foi possível carregar o mapa agora."));

    return () => {
      cancelled = true;
    };
  }, [resolveAddress]);

  // Address suggestions while typing
  useEffect(() => {
    const term = address.trim();
    if (term.length < 3 || !showSuggestions) {
      setSuggestions([]);
      return;
    }
    const id = ++suggestRequest.current;
    const timer = setTimeout(() => {
      void findSuggestions({ data: { input: term, sessionToken: ensureSession() } })
        .then((results) => {
          if (id === suggestRequest.current) setSuggestions(results);
        })
        .catch(() => {
          if (id === suggestRequest.current) setSuggestions([]);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [address, showSuggestions, findSuggestions]);

  async function chooseSuggestion(suggestion: AddressSuggestion) {
    const request = ++locationRequest.current;
    setShowSuggestions(false);
    setSuggestions([]);
    setAddress(suggestion.label);
    setError(null);
    try {
      const result = await findPlace({
        data: { placeId: suggestion.placeId, sessionToken: ensureSession() },
      });
      sessionToken.current = "";
      if (request !== locationRequest.current) return;
      if (!result) {
        setError("Não conseguimos localizar esse endereço no mapa.");
        return;
      }
      if (result.address) setAddress(result.address);
      placeMarker({ lat: result.lat, lng: result.lng });
      setLocationStatus("found");
    } catch {
      setError("Não conseguimos confirmar esse endereço agora.");
    }
  }

  async function handleSearch(): Promise<{ lat: number; lng: number } | null> {
    setError(null);
    setShowSuggestions(false);
    if (address.trim().length < 5) {
      setError("Digite um endereço mais completo para buscar.");
      return null;
    }
    const request = ++locationRequest.current;
    setSearching(true);
    try {
      const result = await findAddress({ data: { address: address.trim() } });
      if (request !== locationRequest.current) return null;
      if (!result) {
        setError("Endereço não encontrado. Tente incluir número e bairro.");
        return null;
      }
      const coords = { lat: result.lat, lng: result.lng };
      setAddress(result.address);
      placeMarker(coords);
      setLocationStatus("found");
      return coords;
    } catch {
      setError("Não conseguimos consultar o endereço agora. Tente novamente.");
      return null;
    } finally {
      setSearching(false);
    }
  }

  async function handlePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const request = ++locationRequest.current;
    setError(null);
    setPhotoNote("Lendo a foto...");

    let gps: { latitude?: number; longitude?: number } | null = null;
    try {
      const exifr = await import("exifr");
      gps = await exifr.gps(file).catch(() => null);
      setPhoto(await shrinkPhoto(file));
    } catch {
      setPhotoNote(null);
      setError("Não conseguimos ler essa foto. Tente outra imagem.");
      return;
    }

    // 1. Location saved in the photo itself
    if (gps && typeof gps.latitude === "number" && typeof gps.longitude === "number") {
      const coords = { lat: gps.latitude, lng: gps.longitude };
      if (request !== locationRequest.current) return;
      setPhotoNote("Foto anexada — usamos a localização registrada na própria foto.");
      placeMarker(coords, 18);
      await resolveAddress(coords, request);
      return;
    }

    // A location is already set: swapping the photo must not move it
    if (point) {
      setPhotoNote("Foto anexada.");
      return;
    }

    // 2. Device location (phones often strip GPS from uploaded photos)
    setPhotoNote("A foto não tem localização. Pedindo a localização do seu aparelho...");
    setLocationStatus("locating");
    const coords = await browserLocation();
    // The person picked the location another way (or reset the form) while we waited
    if (request !== locationRequest.current) return;
    if (coords) {
      setPhotoNote("Foto anexada — usamos a localização do seu aparelho.");
      placeMarker(coords, 18);
      await resolveAddress(coords, request);
      return;
    }

    // 3. Typed address
    setPhotoNote("Foto anexada, mas não conseguimos a localização. Informe o endereço abaixo.");
    setLocationStatus("manual");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    if (!photo) {
      setError(PHOTO_REQUIRED_MESSAGE);
      return;
    }
    let target = point;
    // A typed address that was never searched still counts: look it up now
    if (!target && address.trim().length >= 5) target = await handleSearch();
    if (!target) {
      if (address.trim().length < 5) {
        setError("Marque o local do problema no mapa ou informe o endereço.");
      }
      return;
    }
    const parsed = reportFormSchema.safeParse({ type, description, address, name, whatsapp });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifique os dados informados.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await sendReport({
        data: { ...parsed.data, lat: target.lat, lng: target.lng, photo },
      });
      setProtocol(result.protocol);
    } catch (err) {
      // Keeps everything the person typed so they can just try again
      console.error(err);
      setError("Não foi possível enviar agora. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    locationRequest.current += 1;
    setProtocol(null);
    setPoint(null);
    setAddress("");
    setLocationStatus("idle");
    setType("");
    setDescription("");
    setName("");
    setWhatsapp("");
    setPhoto(null);
    setPhotoNote(null);
    setError(null);
    markerObj.current?.setVisible(false);
    mapObj.current?.setCenter(ALMENARA_CENTER);
    mapObj.current?.setZoom(15);
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
            Almenara Vigia · Denúncia comunitária
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl leading-tight font-bold sm:text-4xl">
            Viu um problema na cidade? Denuncie e cobre a prefeitura.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-primary-foreground/80">
            Cada denúncia fica pública no mapa, com a contagem de dias sem solução. Comece pela foto
            — a gente tenta achar o local sozinho.
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
              <h2 className="mt-4 text-xl font-bold text-foreground">Denúncia registrada!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Seu protocolo é <span className="font-semibold text-primary">{protocol}</span>. Ela
                já aparece no mapa público, contando os dias até a prefeitura resolver.
              </p>
              <Link
                to="/denuncias"
                className="mt-6 block w-full rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Ver no mapa de denúncias
              </Link>
              <button
                onClick={resetForm}
                className="mt-3 w-full rounded-xl border border-primary/25 bg-secondary px-4 py-3 text-sm font-semibold text-primary"
              >
                Fazer outra denúncia
              </button>
            </div>
          ) : (
            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Nova denúncia</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {locationHints[locationStatus]}
                </p>
              </div>

              <div>
                <span className={labelClass}>Foto do problema</span>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(event) => void handlePhoto(event)}
                  className="hidden"
                />
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="flex-1 rounded-xl border border-dashed border-primary/40 bg-secondary/60 px-3 py-4 text-sm font-semibold text-primary"
                  >
                    {photo ? "📷 Trocar foto" : "📷 Tirar foto ou escolher da galeria"}
                  </button>
                  {photo ? (
                    <img
                      src={photo}
                      alt="Foto do problema enviada"
                      className="h-14 w-14 rounded-xl border border-border object-cover"
                    />
                  ) : null}
                </div>
                {photoNote ? (
                  <p className="mt-2 text-xs text-muted-foreground">{photoNote}</p>
                ) : null}
                {locationStatus === "idle" || locationStatus === "locating" ? (
                  <button
                    type="button"
                    onClick={() => {
                      locationRequest.current += 1;
                      setLocationStatus("manual");
                    }}
                    className="mt-2 text-xs font-semibold text-primary underline underline-offset-2"
                  >
                    {locationStatus === "locating"
                      ? "Prefiro informar o endereço"
                      : "Sem foto? Informar o endereço"}
                  </button>
                ) : null}
              </div>

              {locationStatus === "found" ? (
                <div>
                  <span className={labelClass}>Local do problema</span>
                  <div className="mt-2 rounded-xl bg-muted px-3 py-2.5 text-sm text-foreground">
                    📍 Local encontrado: {address}
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocationStatus("manual")}
                    className="mt-2 text-xs font-semibold text-primary underline underline-offset-2"
                  >
                    Não é aqui? Digitar endereço
                  </button>
                </div>
              ) : null}

              {locationStatus === "manual" ? (
                <div>
                  <label htmlFor="address" className={labelClass}>
                    Local do problema
                  </label>
                  <div className="mt-2 flex gap-2">
                    <div className="relative min-w-0 flex-1">
                      <input
                        id="address"
                        autoFocus
                        value={address}
                        onChange={(event) => {
                          setAddress(event.target.value);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        autoComplete="off"
                        placeholder="Rua, número e bairro"
                        maxLength={250}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                      />
                      {showSuggestions && suggestions.length > 0 ? (
                        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-float">
                          {suggestions.map((suggestion) => (
                            <li key={suggestion.placeId}>
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => void chooseSuggestion(suggestion)}
                                className="w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-secondary"
                              >
                                {suggestion.label}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSearch()}
                      disabled={searching}
                      className="rounded-xl border border-primary/25 bg-secondary px-3 py-2.5 text-sm font-semibold text-primary disabled:opacity-60"
                    >
                      {searching ? "..." : "Buscar"}
                    </button>
                  </div>
                  <p className="mt-2 rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
                    {point
                      ? `Ponto marcado: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
                      : "Nenhum ponto marcado no mapa ainda."}
                  </p>
                </div>
              ) : null}

              <div>
                <label htmlFor="type" className={labelClass}>
                  Tipo do problema
                </label>
                <select
                  id="type"
                  value={type}
                  onChange={(event) => setType(event.target.value as ReportType | "")}
                  className={inputClass}
                >
                  <option value="" disabled>
                    Selecione o tipo do problema
                  </option>
                  {REPORT_TYPES.map((key) => (
                    <option key={key} value={key}>
                      {reportTypes[key].emoji} {reportTypes[key].label}
                    </option>
                  ))}
                </select>
              </div>

              {type === "outro" ? (
                <div>
                  <label htmlFor="description" className={labelClass}>
                    Descreva o problema
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Ex.: placa de trânsito caída na esquina"
                    rows={3}
                    maxLength={280}
                    className={`${inputClass} resize-none`}
                  />
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    {description.trim().length}/280
                  </p>
                </div>
              ) : null}

              <div>
                <label htmlFor="name" className={labelClass}>
                  Seu nome
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nome completo"
                  maxLength={100}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="whatsapp" className={labelClass}>
                  WhatsApp
                </label>
                <input
                  id="whatsapp"
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(event.target.value)}
                  placeholder="(33) 99999-0000"
                  inputMode="tel"
                  maxLength={20}
                  className={inputClass}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Seu nome e WhatsApp não aparecem publicamente.
                </p>
              </div>

              {error ? (
                <p className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? "Enviando..." : "Enviar denúncia"}
              </button>
            </form>
          )}
        </div>

        <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-border bg-muted shadow-card lg:min-h-[560px]">
          <div ref={mapRef} className="absolute inset-0" />
          <div className="pointer-events-none absolute top-4 left-4 rounded-full bg-card/95 px-4 py-2 text-xs font-semibold text-foreground shadow-float">
            Toque no mapa para ajustar o local
          </div>
        </div>
      </main>
    </div>
  );
}
