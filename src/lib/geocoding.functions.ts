import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/* Almenara, Minas Gerais — search results are biased to this region. */
const SEARCH_CENTER = { latitude: -16.1836, longitude: -40.6947 };
const SEARCH_RADIUS_METERS = 60000;

function credentials() {
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!mapsKey) {
    throw new Error("Serviço de endereços não configurado");
  }
  return { mapsKey };
}

type GeocodeResult = { address: string; lat: number; lng: number };

async function callGeocode(params: Record<string, string>): Promise<GeocodeResult | null> {
  const { mapsKey } = credentials();
  const query = new URLSearchParams({ language: "pt-BR", region: "br", key: mapsKey, ...params });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${query.toString()}`,
  );

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
    z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(data),
  )
  .handler(async ({ data }) => callGeocode({ latlng: `${data.lat},${data.lng}` }));

export type AddressSuggestion = { placeId: string; label: string };

/* Address autocomplete while the person types. */
export const suggestAddresses = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        input: z.string().trim().min(3).max(200),
        sessionToken: z.string().trim().min(8).max(80),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<AddressSuggestion[]> => {
    const { mapsKey } = credentials();

    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": mapsKey,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
      },
      body: JSON.stringify({
        input: data.input,
        sessionToken: data.sessionToken,
        languageCode: "pt-BR",
        regionCode: "BR",
        locationBias: {
          circle: { center: SEARCH_CENTER, radius: SEARCH_RADIUS_METERS },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Autocomplete falhou [${response.status}]: ${body}`);
      return [];
    }

    const payload = (await response.json()) as {
      suggestions?: Array<{
        placePrediction?: { placeId?: string; text?: { text?: string } };
      }>;
    };

    return (payload.suggestions ?? [])
      .map((item) => ({
        placeId: item.placePrediction?.placeId ?? "",
        label: item.placePrediction?.text?.text ?? "",
      }))
      .filter((item) => item.placeId && item.label)
      .slice(0, 6);
  });

/* Resolve a chosen suggestion into a formatted address plus coordinates. */
export const placeDetails = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        placeId: z.string().trim().min(3).max(300),
        sessionToken: z.string().trim().min(8).max(80),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<GeocodeResult | null> => {
    const { mapsKey } = credentials();
    const query = new URLSearchParams({
      sessionToken: data.sessionToken,
      languageCode: "pt-BR",
      regionCode: "BR",
    });

    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(data.placeId)}?${query.toString()}`,
      {
        headers: {
          "X-Goog-Api-Key": mapsKey,
          "X-Goog-FieldMask": "formattedAddress,location",
        },
      },
    );

    if (!response.ok) {
      const body = await response.text();
      console.error(`Detalhes do local falharam [${response.status}]: ${body}`);
      throw new Error("Não foi possível confirmar o endereço escolhido");
    }

    const payload = (await response.json()) as {
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
    };

    const lat = payload.location?.latitude;
    const lng = payload.location?.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") return null;

    return { address: payload.formattedAddress ?? "", lat, lng };
  });
