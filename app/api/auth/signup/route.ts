import { NextResponse } from "next/server";
import { accountsEnabled, createUser, sessionCookie, userCount } from "../../../../lib/auth";

export const runtime = "nodejs";

// GET : indique si c'est le tout premier compte (il devient administrateur, sans invitation)
export async function GET() {
  if (!accountsEnabled()) return NextResponse.json({ enabled: false });
  return NextResponse.json({ enabled: true, first: (await userCount()) === 0, open: process.env.OPEN_SIGNUP === "1" });
}

export async function POST(req: Request) {
  if (!accountsEnabled()) return NextResponse.json({ error: "Les comptes ne sont pas activés." }, { status: 400 });
  const { email, password, name, invite } = await req.json().catch(() => ({}));
  try {
    const u = await createUser(String(email || ""), String(password || ""), String(name || ""), invite ? String(invite) : undefined);
    return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": await sessionCookie(u) } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
