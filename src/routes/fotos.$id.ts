import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { reportPhotos } from "@/db/schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Serves a report photo straight from Postgres. Photos never change, so browsers may cache them forever. */
export const Route = createFileRoute("/fotos/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!UUID.test(params.id)) return new Response("Foto não encontrada", { status: 404 });
        const [photo] = await getDb()
          .select({ contentType: reportPhotos.contentType, data: reportPhotos.data })
          .from(reportPhotos)
          .where(eq(reportPhotos.reportId, params.id));
        if (!photo) return new Response("Foto não encontrada", { status: 404 });
        return new Response(new Uint8Array(photo.data), {
          headers: {
            "Content-Type": photo.contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
