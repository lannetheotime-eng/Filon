import "server-only";

// Envoi de SMS par Twilio. Sans compte configuré, on passe en « mode test » : rien ne part, l'animateur voit les textes.
const SID = process.env.TWILIO_ACCOUNT_SID || "";
const TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const FROM = process.env.TWILIO_FROM || "LARMAND"; // nom d'expéditeur (11 caractères max, sans accent ni espace) ou numéro français

export const smsLive = () => !!(SID && TOKEN);

// 06 12 34 56 78 → +33612345678
export function normalizePhone(raw: string) {
  let p = raw.replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (/^0[67]\d{8}$/.test(p)) p = "+33" + p.slice(1);
  if (/^[67]\d{8}$/.test(p)) p = "+33" + p;
  if (!/^\+\d{9,15}$/.test(p)) throw new Error(`Numéro invalide : ${raw}`);
  return p;
}

// Remplace les caractères hors alphabet SMS standard : un seul accent comme « ê » fait passer
// tout le message en Unicode, avec des segments de 70 caractères au lieu de 160.
const MAP: Record<string, string> = { "ê": "e", "ë": "e", "â": "a", "î": "i", "ï": "i", "ô": "o", "û": "u", "ç": "c", "œ": "oe", "Œ": "OE", "Ê": "E", "Â": "A", "Î": "I", "Ô": "O", "Û": "U", "À": "A", "È": "E", "«": '"', "»": '"', "’": "'", "‘": "'", "“": '"', "”": '"', "·": "-", "–": "-", "—": "-", "…": "...", "\u00a0": " ", "\u202f": " " };
const GSM = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà]$/;
export function toGsm(text: string) {
  return [...text.replace(/«[\s\u00a0\u202f]*/g, '"').replace(/[\s\u00a0\u202f]*»/g, '"')].map((ch) => (GSM.test(ch) ? ch : MAP[ch] ?? (ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "?"))).join("").replace(/ {2,}/g, " ");
}

export async function sendSms(to: string, body: string): Promise<{ status: "sent" | "test" | "error"; error?: string }> {
  if (!smsLive()) return { status: "test" };
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: FROM, Body: toGsm(body) }).toString(),
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { status: "error", error: j?.message || `Twilio : erreur ${r.status}` };
    return { status: "sent" };
  } catch (e: any) {
    return { status: "error", error: e.message || "Envoi impossible" };
  }
}
