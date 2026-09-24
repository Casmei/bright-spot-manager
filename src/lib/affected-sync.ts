import type { SetAffectedResult } from "@/lib/affected.functions";
import { AFFECTED_ERROR_MESSAGE } from "@/lib/reports";

export type AffectedView = { count: number; byMe: boolean; error: string | null };

type Send = (wanted: boolean) => Promise<SetAffectedResult | null>;

/* One report's button. At most one request in flight, so the server applies clicks in order;
   clicks made while waiting only change what gets sent next. */
export class AffectedSync {
  private confirmedCount: number;
  private confirmed: boolean;
  private wanted: boolean;
  private busy = false;

  constructor(
    initial: { count: number; byMe: boolean },
    private readonly send: Send,
    private readonly onChange: (view: AffectedView) => void,
  ) {
    this.confirmedCount = initial.count;
    this.confirmed = initial.byMe;
    this.wanted = initial.byMe;
  }

  toggle() {
    this.wanted = !this.wanted;
    this.emit(null);
    if (!this.busy) void this.flush();
  }

  private view(error: string | null): AffectedView {
    const pending = this.wanted === this.confirmed ? 0 : this.wanted ? 1 : -1;
    return {
      count: Math.max(0, this.confirmedCount + pending),
      byMe: this.wanted,
      error,
    };
  }

  private emit(error: string | null) {
    this.onChange(this.view(error));
  }

  private async flush() {
    this.busy = true;
    let error: string | null = null;
    while (this.wanted !== this.confirmed) {
      const sent = this.wanted;
      const result = await this.send(sent).catch(() => null);
      if (!result?.ok) {
        error = result?.message ?? AFFECTED_ERROR_MESSAGE;
        this.wanted = this.confirmed;
        break;
      }
      this.confirmedCount = result.affectedCount;
      this.confirmed = result.affectedByMe;
      // The server disagreed with what we asked: believe it rather than insisting
      if (result.affectedByMe !== sent) this.wanted = this.confirmed;
    }
    this.busy = false;
    this.emit(error);
  }
}
