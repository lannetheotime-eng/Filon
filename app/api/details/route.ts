import { NextResponse } from "next/server";
import { placeDetails } from "../../../lib/scan";
import { accountsEnabled, getSession } from "../../../lib/auth";
import { assertBudget, record } from "../../../lib/quota";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });
  try {
    const s = accountsEnabled() ? await getSession(req) : null;
    const live = !!process.env.GOOGLE_PLACES_API_KEY && !id.startsWith("demo-");
    if (live) await assertBudget(s, 1);
    const d = await placeDetails(id);
    if (live) await record(s, 1);
    return NextResponse.json(d);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
