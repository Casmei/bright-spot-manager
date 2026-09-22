/* Loads the Google Maps JavaScript API once, asynchronously. */

type AnyMaps = any;

let loader: Promise<AnyMaps> | null = null;

export function loadGoogleMaps(): Promise<AnyMaps> {
  if (loader) return loader;

  loader = new Promise<AnyMaps>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Google Maps só pode ser carregado no navegador"));
      return;
    }

    const env = import.meta.env as Record<string, string | undefined>;
    const key = env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    const channel = env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] ?? "";

    if (!key) {
      reject(new Error("Chave do mapa não configurada"));
      return;
    }

    const w = window as unknown as Record<string, unknown>;
    w["__initLampMap"] = () => resolve((w["google"] as AnyMaps).maps);

    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&loading=async&callback=__initLampMap&language=pt-BR&region=BR` +
      (channel ? `&channel=${encodeURIComponent(channel)}` : "");
    script.async = true;
    script.onerror = () => reject(new Error("Falha ao carregar o mapa"));
    document.head.appendChild(script);
  });

  return loader;
}

export const MAP_STYLES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export const BH_CENTER = { lat: -19.9245, lng: -43.9352 };
