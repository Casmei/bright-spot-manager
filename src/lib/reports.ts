import { reportTypes, type ReportType } from "@/lib/report-types";

/* What anyone can see: the reporter's name and WhatsApp never leave the server. */
export type PublicReport = {
  id: string;
  protocol: string;
  type: ReportType;
  description?: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: string;
  photoUrl: string;
  /* "Me afeta também": how many people marked it, and whether this visitor did. */
  affectedCount: number;
  affectedByMe: boolean;
};

const DAY = 24 * 60 * 60 * 1000;

/* Calendar day in Almenara, so "registrada dia 22" and "há 2 dias" agree on the 24th. */
const calendarDayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

function calendarDay(date: Date) {
  return Date.parse(calendarDayFormat.format(date)) / DAY;
}

export function daysOpen(report: Pick<PublicReport, "createdAt">) {
  return Math.max(0, calendarDay(new Date()) - calendarDay(new Date(report.createdAt)));
}

export function formatDaysOpen(report: Pick<PublicReport, "createdAt">) {
  const days = daysOpen(report);
  if (days === 0) return "Hoje";
  return days === 1 ? "Há 1 dia" : `Há ${days} dias`;
}

/* The longer a report waits, the louder it asks for attention. */
export type Urgency = "recente" | "atrasada" | "esquecida";

export function urgencyOf(report: Pick<PublicReport, "createdAt">): Urgency {
  const days = daysOpen(report);
  if (days < 7) return "recente";
  return days < 30 ? "atrasada" : "esquecida";
}

/* Fixed time zone so server and browser render the same date. */
const reportedOnFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

export function formatReportedOn(report: Pick<PublicReport, "createdAt">) {
  return reportedOnFormat.format(new Date(report.createdAt));
}

/* Every report is in Almenara: drop the city, CEP and country Google appends. */
export function shortAddress(address: string) {
  const short = address
    .replace(/,\s*Brasil$/i, "")
    .replace(/,?\s*\d{5}-?\d{3}$/, "")
    .replace(/\s*[-,]\s*Almenara\s*[-,]\s*MG$/i, "")
    .trim();
  return short || address;
}

export function waitingSentence(report: Pick<PublicReport, "createdAt">) {
  const days = daysOpen(report);
  if (days === 0) return "Denunciado hoje no Almenara Vigia.";
  return `Há ${days} ${days === 1 ? "dia" : "dias"} esperando a prefeitura.`;
}

/* Message that goes along with the report's link when someone shares it. */
export function shareMessage(report: Pick<PublicReport, "type" | "address" | "createdAt">) {
  const meta = reportTypes[report.type];
  return `${meta.emoji} ${meta.label} — ${shortAddress(report.address)}. ${waitingSentence(report)} Veja e cobre:`;
}

export function formatProtocol(protocolSeq: number) {
  return `AV-${protocolSeq}`;
}

export function photoUrl(reportId: string) {
  return `/fotos/${reportId}`;
}

export const AFFECTED_LIMIT_MESSAGE =
  "Muitas pessoas já marcaram esta denúncia a partir da mesma rede. Tente mais tarde por outra conexão.";
export const AFFECTED_NOT_FOUND_MESSAGE = "Denúncia não encontrada.";
export const AFFECTED_ERROR_MESSAGE = "Não foi possível registrar agora. Tente de novo.";
