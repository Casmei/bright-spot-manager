import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import { Clock, Expand, MapPin, X } from "lucide-react";
import { AffectedButton } from "@/components/AffectedButton";
import { ShareReport } from "@/components/ShareReport";
import { reportTypes } from "@/lib/report-types";
import {
  daysOpen,
  formatReportedOn,
  shareMessage,
  shortAddress,
  urgencyOf,
  type PublicReport,
  type Urgency,
} from "@/lib/reports";
import { useAffected } from "@/lib/use-affected";

const urgencyIconClass: Record<Urgency, string> = {
  recente: "bg-muted text-foreground",
  atrasada: "bg-secondary text-primary",
  esquecida: "bg-primary text-primary-foreground",
};

const urgencyTextClass: Record<Urgency, string> = {
  recente: "text-foreground",
  atrasada: "text-primary",
  esquecida: "text-primary-deep",
};

/* On phones a bottom sheet about two thirds tall, leaving the page above it to tap away. */
function DialogShell({
  onClose,
  className,
  bodyClassName,
  children,
}: {
  onClose: () => void;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          /* Focus the dialog itself: landing on a button would show its ring before any keyboard use. */
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
          className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[65dvh] flex-col overflow-hidden rounded-t-2xl bg-card shadow-float outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-8 md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[min(760px,90dvh)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:data-[state=open]:slide-in-from-bottom-0 md:data-[state=open]:zoom-in-95 ${className ?? ""}`}
        >
          <div className={`min-h-0 flex-1 overflow-y-auto ${bodyClassName ?? ""}`}>{children}</div>
          <DialogPrimitive.Close
            aria-label="Fechar"
            className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
          >
            <X className="h-5 w-5" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* The photo is the evidence: shown whole, never cropped. */
export function ReportDialog({
  report,
  url,
  onClose,
}: {
  report: PublicReport;
  url: string;
  onClose: () => void;
}) {
  const meta = reportTypes[report.type];
  const days = daysOpen(report);
  const urgency = urgencyOf(report);
  const street = shortAddress(report.address);
  const { count: affectedCount } = useAffected(report);

  return (
    <DialogShell
      onClose={onClose}
      className="md:w-[min(1040px,calc(100vw-3rem))]"
      bodyClassName="md:grid md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:overflow-hidden"
    >
      <a
        href={report.photoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative flex items-center justify-center overflow-hidden bg-neutral-950 md:h-[min(760px,90dvh)]"
      >
        {/* Blurred copy fills the bars around photos that don't match the frame */}
        <img
          src={report.photoUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl"
        />
        <img
          src={report.photoUrl}
          alt={`Foto da denúncia: ${meta.label} em ${street}`}
          className="relative max-h-[38dvh] w-full object-contain md:h-full md:max-h-none"
        />
        <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white opacity-80 backdrop-blur transition-opacity group-hover:opacity-100">
          <Expand className="h-3.5 w-3.5" />
          Ver foto original
        </span>
      </a>

      <div className="flex flex-col gap-5 p-5 md:overflow-y-auto md:p-7">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <span aria-hidden="true">{meta.emoji}</span>
            {meta.label}
          </p>
          <DialogPrimitive.Title className="mt-1 text-xl leading-snug font-bold text-foreground">
            {street}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Denúncia {report.protocol} registrada em {formatReportedOn(report)}.
          </DialogPrimitive.Description>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${urgencyIconClass[urgency]}`}
          >
            <Clock className="h-5 w-5" />
          </span>
          <div>
            <p className={`text-base leading-tight font-bold ${urgencyTextClass[urgency]}`}>
              {days === 0
                ? "Denunciado hoje"
                : `${days} ${days === 1 ? "dia" : "dias"} sem solução`}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {days === 0 ? "Aguardando a prefeitura" : `Denunciado em ${formatReportedOn(report)}`}
            </p>
          </div>
        </div>

        {report.description ? (
          <p className="border-l-2 border-accent pl-3 text-sm text-foreground italic">
            “{report.description}”
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Protocolo <span className="font-semibold text-foreground">{report.protocol}</span>
          </span>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${report.lat},${report.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 font-semibold text-primary hover:underline"
          >
            <MapPin className="h-4 w-4" />
            Abrir no Google Maps
          </a>
        </div>

        <div className="mt-auto grid gap-5 border-t border-border pt-5">
          <AffectedButton report={report} variant="full" />
          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">
              Quanto mais gente vê, mais difícil ignorar.
            </p>
            <ShareReport url={url} message={shareMessage(report, affectedCount)} />
          </div>
        </div>
      </div>
    </DialogShell>
  );
}

export function ReportNotFoundDialog({ onClose }: { onClose: () => void }) {
  return (
    <DialogShell onClose={onClose} className="md:w-[min(440px,calc(100vw-3rem))]">
      <div className="p-7 text-center">
        <DialogPrimitive.Title className="text-lg font-bold text-foreground">
          Denúncia não encontrada
        </DialogPrimitive.Title>
        <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
          Confira se o link está completo. As demais denúncias continuam no mapa.
        </DialogPrimitive.Description>
        <Link
          to="/denuncias"
          className="mt-5 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          Ver todas as denúncias
        </Link>
      </div>
    </DialogShell>
  );
}
