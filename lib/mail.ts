import "server-only";
// Envoi des e-mails de prospection depuis Filon, par Resend (gratuit jusqu'à 100 par jour).
// Suivi : délivré, rebond, spam, clic sur un lien. Pas de pixel d'ouverture :
// depuis juillet 2026, la CNIL exige le consentement du destinataire pour ce type de mouchard.

const KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.MAIL_FROM || ""; // ex. « Theo · Thot Studio <theo@thot-studio.fr> »
const REPLY = process.env.MAIL_REPLY_TO || "";
const API = process.env.RESEND_API_URL || "https://api.resend.com"; // modifiable pour les tests

export const mailEnabled = () => !!(KEY && FROM);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Texte → HTML simple : paragraphes et liens cliquables (nécessaires au suivi des clics)
export function toHtml(text: string) {
  const linked = esc(text).replace(/\b((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)»])/g, (u) => `<a href="${u.startsWith("http") ? u : `https://${u}`}">${u}</a>`);
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#222">${linked
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("")}</div>`;
}

export const OPT_OUT = "Si vous ne souhaitez plus recevoir de message de ma part, répondez simplement « stop ».";

export async function sendMail(m: { to: string; subject: string; body: string; leadId?: string }) {
  if (!mailEnabled()) throw new Error("Envoi non configuré : ajoute RESEND_API_KEY et MAIL_FROM dans Vercel.");
  const text = `${m.body.trim()}\n\n--\n${OPT_OUT}`;
  const r = await fetch(`${API}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [m.to],
      subject: m.subject,
      text,
      html: toHtml(text),
      ...(REPLY ? { reply_to: REPLY } : {}),
      tags: [{ name: "app", value: "filon" }],
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message || `Envoi refusé (${r.status}).`);
  return j.id as string;
}

export async function mailStatus(id: string): Promise<string | null> {
  const r = await fetch(`${API}/emails/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json().catch(() => ({}));
  return j.last_event || null;
}
