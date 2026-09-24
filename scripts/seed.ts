/* Development only: fills an empty database with sample reports and a placeholder photo. */
import { readFile } from "node:fs/promises";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

const url = process.env["DATABASE_URL"];
if (!url) {
  console.error("DATABASE_URL não definida");
  process.exit(1);
}

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

const samples = [
  {
    type: "buraco",
    name: "Marina Alves",
    whatsapp: "(33) 99812-4410",
    address: "Av. Nossa Senhora do Amparo, 300 - Centro, Almenara - MG",
    lat: -16.1836,
    lng: -40.6947,
    createdAt: daysAgo(0.2),
  },
  {
    type: "lampada",
    name: "Carlos Teixeira",
    whatsapp: "(33) 99120-7788",
    address: "Rua Cel. Jonas Loures, 120 - Centro, Almenara - MG",
    lat: -16.1801,
    lng: -40.6903,
    createdAt: daysAgo(1.1),
  },
  {
    type: "entulho",
    name: "Juliana Prado",
    whatsapp: "(33) 98444-1201",
    address: "Rua Manoel Esteves, 45 - Vila Nova, Almenara - MG",
    lat: -16.1888,
    lng: -40.6885,
    createdAt: daysAgo(2.6),
  },
  {
    type: "esgoto",
    name: "Rafael Souza",
    whatsapp: "(33) 99666-3040",
    address: "Rua Joaquim Pedro, 890 - São Geraldo, Almenara - MG",
    lat: -16.1769,
    lng: -40.7004,
    createdAt: daysAgo(3.4),
  },
  {
    type: "mato",
    name: "Beatriz Lima",
    whatsapp: "(33) 99001-5522",
    address: "Rua das Palmeiras, 210 - Bela Vista, Almenara - MG",
    lat: -16.1922,
    lng: -40.7011,
    createdAt: daysAgo(5.2),
  },
  {
    type: "buraco",
    name: "Eduardo Nunes",
    whatsapp: "(33) 98777-9090",
    address: "Av. Pedro Versiani, 1500 - Jardim Vitória, Almenara - MG",
    lat: -16.1745,
    lng: -40.6862,
    createdAt: daysAgo(12.5),
  },
  {
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

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

const [existing] = await db.select({ total: count() }).from(schema.reports);
if (existing && existing.total > 0) {
  console.log(`O banco já tem ${existing.total} denúncias; nada foi inserido.`);
} else {
  const photo = await readFile(new URL("./placeholder.jpg", import.meta.url));
  await db.transaction(async (tx) => {
    for (const sample of samples) {
      const [row] = await tx
        .insert(schema.reports)
        .values(sample)
        .returning({ id: schema.reports.id });
      if (!row) throw new Error("Falha ao inserir exemplo");
      await tx
        .insert(schema.reportPhotos)
        .values({ reportId: row.id, contentType: "image/jpeg", data: photo });
    }
  });
  console.log(`${samples.length} denúncias de exemplo inseridas.`);
}

await client.end();
