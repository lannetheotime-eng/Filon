import { NextResponse } from "next/server";
import { accountsEnabled, getSession } from "../../../../lib/auth";
import { usage } from "../../../../lib/quota";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const s = accountsEnabled() ? await getSession(req) : null;
  return NextResponse.json({
    mode: accountsEnabled() ? "comptes" : "simple",
    user: s ? { email: s.email, role: s.role } : null,
    usage: await usage(s).catch(() => null),
    google: !!process.env.GOOGLE_PLACES_API_KEY,
  });
}
