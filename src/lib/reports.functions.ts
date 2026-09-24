import { createServerFn } from "@tanstack/react-start";
import { getDb } from "@/db/client";
import { reportPhotos, reports } from "@/db/schema";
import { insertAuthorMark } from "@/lib/affected";
import { selectPublicReports } from "@/lib/public-reports";
import { PHOTO_REQUIRED_MESSAGE, reportInputSchema } from "@/lib/report-schema";
import { formatProtocol, type PublicReport } from "@/lib/reports";
import { ensureVoterId, readVoterId, requestIpHash } from "@/lib/voter-request";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const JPEG_PREFIX = "data:image/jpeg;base64,";

/* The form always sends a shrunk JPEG; anything else is refused. */
function decodeJpegDataUrl(photo: string) {
  if (!photo.startsWith(JPEG_PREFIX)) throw new Error(PHOTO_REQUIRED_MESSAGE);
  const bytes = Buffer.from(photo.slice(JPEG_PREFIX.length), "base64");
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isJpeg) throw new Error("A foto enviada não é uma imagem JPEG válida.");
  if (bytes.length > MAX_PHOTO_BYTES)
    throw new Error("A foto é grande demais. Tente outra imagem.");
  return bytes;
}

/* Best effort: a misconfigured secret must never stop someone from reporting. */
function authorMark() {
  try {
    return { voterId: ensureVoterId(), ipHash: requestIpHash() };
  } catch (err) {
    console.error("Marca do autor ignorada:", err);
    return null;
  }
}

export const createReport = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const parsed = reportInputSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Verifique os dados informados.");
    }
    return parsed.data;
  })
  .handler(async ({ data }) => {
    const photo = decodeJpegDataUrl(data.photo);
    const author = authorMark();
    const created = await getDb().transaction(async (tx) => {
      const [row] = await tx
        .insert(reports)
        .values({
          type: data.type,
          description: data.type === "outro" ? data.description : null,
          name: data.name,
          whatsapp: data.whatsapp,
          address: data.address,
          lat: data.lat,
          lng: data.lng,
        })
        .returning({ id: reports.id, protocolSeq: reports.protocolSeq });
      if (!row) throw new Error("Não foi possível registrar a denúncia.");
      await tx
        .insert(reportPhotos)
        .values({ reportId: row.id, contentType: "image/jpeg", data: photo });
      if (author) await insertAuthorMark(tx, { reportId: row.id, ...author });
      return row;
    });
    return { protocol: formatProtocol(created.protocolSeq) };
  });

export const listPublicReports = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicReport[]> => selectPublicReports(getDb(), readVoterId()),
);
