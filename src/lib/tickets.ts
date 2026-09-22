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
    whatsapp: "(31) 99812-4410",
    address: "Av. Afonso Pena, 1500 - Centro, Belo Horizonte - MG",
    lat: -19.9245,
    lng: -43.9352,
    createdAt: daysAgo(0.2),
  },
  {
    id: "2",
    protocol: "LMP-1024",
    name: "Carlos Teixeira",
    whatsapp: "(31) 99120-7788",
    address: "Rua Sapucaí, 200 - Floresta, Belo Horizonte - MG",
    lat: -19.9187,
    lng: -43.9295,
    createdAt: daysAgo(1.1),
  },
  {
    id: "3",
    protocol: "LMP-1029",
    name: "Juliana Prado",
    whatsapp: "(31) 98444-1201",
    address: "Rua Pernambuco, 1000 - Savassi, Belo Horizonte - MG",
    lat: -19.9365,
    lng: -43.9319,
    createdAt: daysAgo(2.6),
  },
  {
    id: "4",
    protocol: "LMP-1031",
    name: "Rafael Souza",
    whatsapp: "(31) 99666-3040",
    address: "Av. do Contorno, 6000 - Funcionários, Belo Horizonte - MG",
    lat: -19.9401,
    lng: -43.9265,
    createdAt: daysAgo(3.4),
  },
  {
    id: "5",
    protocol: "LMP-1035",
    name: "Beatriz Lima",
    whatsapp: "(31) 99001-5522",
    address: "Rua Padre Eustáquio, 1800 - Padre Eustáquio, Belo Horizonte - MG",
    lat: -19.9142,
    lng: -43.9705,
    createdAt: daysAgo(5.2),
  },
  {
    id: "6",
    protocol: "LMP-1038",
    name: "Eduardo Nunes",
    whatsapp: "(31) 98777-9090",
    address: "Av. Cristiano Machado, 4000 - Cidade Nova, Belo Horizonte - MG",
    lat: -19.8875,
    lng: -43.9243,
    createdAt: daysAgo(7.5),
  },
  {
    id: "7",
    protocol: "LMP-1040",
    name: "Sandra Rocha",
    whatsapp: "(31) 99433-1188",
    address: "Rua Barão de Macaúbas, 300 - Santo Antônio, Belo Horizonte - MG",
    lat: -19.9498,
    lng: -43.9412,
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
