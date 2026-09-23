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
    const key = env["VITE_GOOGLE_MAPS_API_KEY"];

    if (!key) {
      reject(new Error("Chave do mapa não configurada"));
      return;
    }

    const w = window as unknown as Record<string, unknown>;
    w["__initLampMap"] = () => resolve((w["google"] as AnyMaps).maps);

    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&loading=async&callback=__initLampMap&language=pt-BR&region=BR`;
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

/* Almenara, Minas Gerais */
export const ALMENARA_CENTER = { lat: -16.1836, lng: -40.6947 };
