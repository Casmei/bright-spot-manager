import { useSyncExternalStore } from "react";

export type Ticket = {
  id: string;
  protocol: string;
  name: string;
  whatsapp: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: string;
  photo?: string;
};

export type Urgency = "novo" | "atencao" | "critico";

const DAY = 24 * 60 * 60 * 1000;

export function ticketAgeInDays(ticket: Ticket) {
  return (Date.now() - new Date(ticket.createdAt).getTime()) / DAY;
}

export function ticketUrgency(ticket: Ticket): Urgency {
  const days = ticketAgeInDays(ticket);
  if (days > 4) return "critico";
  if (days >= 2) return "atencao";
  return "novo";
}

export const urgencyMeta: Record<Urgency, { label: string; hex: string; description: string }> = {
  novo: { label: "Recente", hex: "#16a34a", description: "Aberto há menos de 2 dias" },
  atencao: { label: "Atenção", hex: "#eab308", description: "Aberto há 2 a 4 dias" },
  critico: { label: "Crítico", hex: "#dc2626", description: "Aberto há mais de 4 dias" },
};

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY).toISOString();
}

let counter = 1042;

function makeProtocol() {
  counter += 1;
  return `LMP-${counter}`;
}

let tickets: Ticket[] = [
  {
    id: "1",
    protocol: "LMP-1021",
    name: "Marina Alves",
    whatsapp: "(33) 99812-4410",
    address: "Av. Nossa Senhora do Amparo, 300 - Centro, Almenara - MG",
    lat: -16.1836,
    lng: -40.6947,
    createdAt: daysAgo(0.2),
  },
  {
    id: "2",
    protocol: "LMP-1024",
    name: "Carlos Teixeira",
    whatsapp: "(33) 99120-7788",
    address: "Rua Cel. Jonas Loures, 120 - Centro, Almenara - MG",
    lat: -16.1801,
    lng: -40.6903,
    createdAt: daysAgo(1.1),
  },
  {
    id: "3",
    protocol: "LMP-1029",
    name: "Juliana Prado",
    whatsapp: "(33) 98444-1201",
    address: "Rua Manoel Esteves, 45 - Vila Nova, Almenara - MG",
    lat: -16.1888,
    lng: -40.6885,
    createdAt: daysAgo(2.6),
  },
  {
    id: "4",
    protocol: "LMP-1031",
    name: "Rafael Souza",
    whatsapp: "(33) 99666-3040",
    address: "Rua Joaquim Pedro, 890 - São Geraldo, Almenara - MG",
    lat: -16.1769,
    lng: -40.7004,
    createdAt: daysAgo(3.4),
  },
  {
    id: "5",
    protocol: "LMP-1035",
    name: "Beatriz Lima",
    whatsapp: "(33) 99001-5522",
    address: "Rua das Palmeiras, 210 - Bela Vista, Almenara - MG",
    lat: -16.1922,
    lng: -40.7011,
    createdAt: daysAgo(5.2),
  },
  {
    id: "6",
    protocol: "LMP-1038",
    name: "Eduardo Nunes",
    whatsapp: "(33) 98777-9090",
    address: "Av. Pedro Versiani, 1500 - Jardim Vitória, Almenara - MG",
    lat: -16.1745,
    lng: -40.6862,
    createdAt: daysAgo(7.5),
  },
  {
    id: "7",
    protocol: "LMP-1040",
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

export function formatAge(ticket: Ticket) {
  const days = ticketAgeInDays(ticket);
  if (days < 1) {
    const hours = Math.max(1, Math.round(days * 24));
    return `${hours}h atrás`;
  }
  const rounded = Math.floor(days);
  return rounded === 1 ? "1 dia atrás" : `${rounded} dias atrás`;
}
