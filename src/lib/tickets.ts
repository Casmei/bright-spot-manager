import { useMemo, useSyncExternalStore } from "react";
import type { ReportType } from "@/lib/report-types";

export type Ticket = {
  id: string;
  protocol: string;
  type: ReportType;
  description?: string;
  name: string;
  whatsapp: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: string;
  photo?: string;
};

/* What anyone can see: never carries the reporter's name or WhatsApp. */
export type PublicTicket = Omit<Ticket, "name" | "whatsapp">;

const DAY = 24 * 60 * 60 * 1000;

export function ticketAgeInDays(ticket: Pick<Ticket, "createdAt">) {
  return (Date.now() - new Date(ticket.createdAt).getTime()) / DAY;
}

export function formatDaysOpen(ticket: Pick<Ticket, "createdAt">) {
  const days = Math.floor(ticketAgeInDays(ticket));
  if (days <= 0) return "Hoje";
  return days === 1 ? "Há 1 dia" : `Há ${days} dias`;
}

/* Allowlist on purpose: new private fields stay out of the public view by default. */
export function toPublic(ticket: Ticket): PublicTicket {
  return {
    id: ticket.id,
    protocol: ticket.protocol,
    type: ticket.type,
    address: ticket.address,
    lat: ticket.lat,
    lng: ticket.lng,
    createdAt: ticket.createdAt,
    ...(ticket.description ? { description: ticket.description } : {}),
    ...(ticket.photo ? { photo: ticket.photo } : {}),
  };
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY).toISOString();
}

let counter = 1042;

function makeProtocol() {
  counter += 1;
  return `AV-${counter}`;
}

let tickets: Ticket[] = [
  {
    id: "1",
    protocol: "AV-1021",
    type: "buraco",
    name: "Marina Alves",
    whatsapp: "(33) 99812-4410",
    address: "Av. Nossa Senhora do Amparo, 300 - Centro, Almenara - MG",
    lat: -16.1836,
    lng: -40.6947,
    createdAt: daysAgo(0.2),
  },
  {
    id: "2",
    protocol: "AV-1024",
    type: "lampada",
    name: "Carlos Teixeira",
    whatsapp: "(33) 99120-7788",
    address: "Rua Cel. Jonas Loures, 120 - Centro, Almenara - MG",
    lat: -16.1801,
    lng: -40.6903,
    createdAt: daysAgo(1.1),
  },
  {
    id: "3",
    protocol: "AV-1029",
    type: "entulho",
    name: "Juliana Prado",
    whatsapp: "(33) 98444-1201",
    address: "Rua Manoel Esteves, 45 - Vila Nova, Almenara - MG",
    lat: -16.1888,
    lng: -40.6885,
    createdAt: daysAgo(2.6),
  },
  {
    id: "4",
    protocol: "AV-1031",
    type: "esgoto",
    name: "Rafael Souza",
    whatsapp: "(33) 99666-3040",
    address: "Rua Joaquim Pedro, 890 - São Geraldo, Almenara - MG",
    lat: -16.1769,
    lng: -40.7004,
    createdAt: daysAgo(3.4),
  },
  {
    id: "5",
    protocol: "AV-1035",
    type: "mato",
    name: "Beatriz Lima",
    whatsapp: "(33) 99001-5522",
    address: "Rua das Palmeiras, 210 - Bela Vista, Almenara - MG",
    lat: -16.1922,
    lng: -40.7011,
    createdAt: daysAgo(5.2),
  },
  {
    id: "6",
    protocol: "AV-1038",
    type: "buraco",
    name: "Eduardo Nunes",
    whatsapp: "(33) 98777-9090",
    address: "Av. Pedro Versiani, 1500 - Jardim Vitória, Almenara - MG",
    lat: -16.1745,
    lng: -40.6862,
    createdAt: daysAgo(12.5),
  },
  {
    id: "7",
    protocol: "AV-1040",
    type: "outro",
    description: "Placa de 'Pare' caída na esquina; os carros estão passando direto.",
    name: "Sandra Rocha",
    whatsapp: "(33) 99433-1188",
    address: "Rua Santo Antônio, 77 - Santo Antônio, Almenara - MG",
    lat: -16.1867,
    lng: -40.7062,
    createdAt: daysAgo(0.8),
  },
];

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addTicket(input: Omit<Ticket, "id" | "protocol" | "createdAt">) {
  const ticket: Ticket = {
    ...input,
    id: crypto.randomUUID(),
    protocol: makeProtocol(),
    createdAt: new Date().toISOString(),
  };
  tickets = [ticket, ...tickets];
  emit();
  return ticket;
}

export function useTickets() {
  return useSyncExternalStore(
    subscribe,
    () => tickets,
    () => tickets,
  );
}

export function usePublicTickets() {
  const all = useTickets();
  return useMemo(() => all.map(toPublic), [all]);
}
