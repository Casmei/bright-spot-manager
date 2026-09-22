import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function credentials() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) {
    throw new Error("Serviço de endereços não configurado");
  }
  return { lovableKey, mapsKey };
}

type GeocodeResult = { address: string; lat: number; lng: number };

async function callGeocode(params: Record<string, string>): Promise<GeocodeResult | null> {
  const { lovableKey, mapsKey } = credentials();
  const query = new URLSearchParams({ language: "pt-BR", region: "br", ...params });

  const response = await fetch(`${GATEWAY_URL}/maps/api/geocode/json?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": mapsKey,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Geocoding falhou [${response.status}]: ${body}`);
    throw new Error(`Não foi possível consultar o endereço (${response.status})`);
  }

  const data = (await response.json()) as {
    status: string;
    results?: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }>;
  };

  const first = data.results?.[0];
  if (data.status !== "OK" || !first) return null;

  return {
    address: first.formatted_address,
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
  };
}

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ address: z.string().trim().min(5).max(250) }).parse(data),
  )
  .handler(async ({ data }) => callGeocode({ address: data.address }));

export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
      .parse(data),
  )
  .handler(async ({ data }) => callGeocode({ latlng: `${data.lat},${data.lng}` }));
