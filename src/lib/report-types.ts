/* Tipos de denúncia. A ordem do array define a ordem no select e nos filtros. */
export const REPORT_TYPES = ["buraco", "entulho", "lampada", "esgoto", "mato", "outro"] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const reportTypes: Record<ReportType, { emoji: string; label: string }> = {
  buraco: { emoji: "🚧", label: "Buraco na via" },
  entulho: { emoji: "🗑️", label: "Entulho / lixo" },
  lampada: { emoji: "💡", label: "Lâmpada queimada" },
  esgoto: { emoji: "💧", label: "Esgoto / vazamento" },
  mato: { emoji: "🌿", label: "Mato alto / terreno" },
  outro: { emoji: "❓", label: "Outro" },
};
