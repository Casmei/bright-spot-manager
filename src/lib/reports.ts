import type { ReportType } from "@/lib/report-types";

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
};

const DAY = 24 * 60 * 60 * 1000;

export function reportAgeInDays(report: Pick<PublicReport, "createdAt">) {
  return (Date.now() - new Date(report.createdAt).getTime()) / DAY;
}

export function formatDaysOpen(report: Pick<PublicReport, "createdAt">) {
  const days = Math.floor(reportAgeInDays(report));
  if (days <= 0) return "Hoje";
  return days === 1 ? "Há 1 dia" : `Há ${days} dias`;
}

export function formatProtocol(protocolSeq: number) {
  return `AV-${protocolSeq}`;
}

export function photoUrl(reportId: string) {
  return `/fotos/${reportId}`;
}
