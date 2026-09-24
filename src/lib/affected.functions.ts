import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  AffectedLimitError,
  ReportNotFoundError,
  affectedSummary,
  markAffected,
  unmarkAffected,
} from "@/lib/affected";
import {
  AFFECTED_ERROR_MESSAGE,
  AFFECTED_LIMIT_MESSAGE,
  AFFECTED_NOT_FOUND_MESSAGE,
} from "@/lib/reports";
import { maxPerIp } from "@/lib/voter";
import { ensureVoterId, readVoterId, requestIpHash } from "@/lib/voter-request";

const setAffectedInput = z.object({ reportId: z.string().uuid(), affected: z.boolean() });

export type SetAffectedResult =
  { ok: true; affectedCount: number; affectedByMe: boolean } | { ok: false; message: string };

/* Takes the wanted state, not a toggle: a double click or a slow network cannot flip it the wrong way. */
export const setAffected = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => setAffectedInput.parse(data))
  .handler(async ({ data }): Promise<SetAffectedResult> => {
    const db = getDb();
    try {
      let voterId: string | null;
      if (data.affected) {
        voterId = ensureVoterId();
        await markAffected(db, {
          reportId: data.reportId,
          voterId,
          ipHash: requestIpHash(),
          maxPerIp: maxPerIp(process.env),
        });
      } else {
        voterId = readVoterId();
        if (voterId) await unmarkAffected(db, { reportId: data.reportId, voterId });
      }
      return { ok: true, ...(await affectedSummary(db, { reportId: data.reportId, voterId })) };
    } catch (err) {
      if (err instanceof AffectedLimitError) return { ok: false, message: AFFECTED_LIMIT_MESSAGE };
      if (err instanceof ReportNotFoundError)
        return { ok: false, message: AFFECTED_NOT_FOUND_MESSAGE };
      console.error(err);
      return { ok: false, message: AFFECTED_ERROR_MESSAGE };
    }
  });
