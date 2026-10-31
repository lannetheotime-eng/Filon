import { NextResponse } from "next/server";
import { accountsEnabled, checkLogin, sessionCookie } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!accountsEnabled()) return NextResponse.json({ error: "Les comptes ne sont pas activés." }, { status: 400 });
  const { email, password } = await req.json().catch(() => ({}));
  const u = email && password ? await checkLogin(String(email), String(password)) : null;
  if (!u) return NextResponse.json({ error: "E-mail ou mot de passe incorrect." }, { status: 401 });
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": await sessionCookie(u) } });
}
