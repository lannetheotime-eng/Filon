import { NextResponse } from "next/server";
import { mailEnabled, sendMail } from "../../../../lib/mail";

export async function GET() {
  return NextResponse.json({ enabled: mailEnabled(), from: mailEnabled() ? process.env.MAIL_FROM : null });
}

export async function POST(req: Request) {
  try {
    const { to, subject, body } = await req.json();
    const addr = String(to || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
    if (!String(subject || "").trim() || !String(body || "").trim()) return NextResponse.json({ error: "Objet et message obligatoires." }, { status: 400 });
    const id = await sendMail({ to: addr, subject: String(subject).slice(0, 200), body: String(body).slice(0, 20000) });
    return NextResponse.json({ id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Envoi impossible." }, { status: 500 });
  }
}
