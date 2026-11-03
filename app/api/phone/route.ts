import { NextResponse } from "next/server";
import { findPhone } from "../../../lib/scan";
import { accountsEnabled, getSession } from "../../../lib/auth";
import { assertBudget, record } from "../../../lib/quota";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const name = u.searchParams.get("name") || "", city = u.searchParams.get("city") || "";
  if (!name) return NextResponse.json({ error: "Nom manquant." }, { status: 400 });
  try {
    const s = accountsEnabled() ? await getSession(req) : null;
    const live = !!process.env.GOOGLE_PLACES_API_KEY;
    if (live) await assertBudget(s, 1);
    const r = await findPhone(name, city);
    if (live) await record(s, 1);
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
