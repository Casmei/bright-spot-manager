type Env = Record<string, string | undefined>;

/* Public on purpose: it is where people ask to join the beta. */
export const JOIN_BETA_URL = `https://wa.me/5533999166432?text=${encodeURIComponent(
  "Oi! Quero fazer parte do Almenara Vigia e denunciar problemas na minha rua.",
)}`;

export const NOT_BETA_MESSAGE =
  "Por enquanto, só usuários do programa beta podem registrar denúncias. Quer participar? Fale com a gente pelo WhatsApp.";

/* Digits only, without Brazil's 55, so "(33) 99916-6432" and "+55 33 999166432" match. */
function normalizeWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
}

/* BETA_WHATSAPPS: comma-separated numbers; stays on the server so members' numbers never ship. */
export function betaWhatsapps(env: Env) {
  return (env["BETA_WHATSAPPS"] ?? "")
    .split(",")
    .map(normalizeWhatsapp)
    .filter((number) => number.length > 0);
}

/* An empty list lets nobody in: a missing env must not open reporting to everyone. */
export function isBetaWhatsapp(whatsapp: string, members: string[]) {
  const number = normalizeWhatsapp(whatsapp);
  return number.length > 0 && members.includes(number);
}
