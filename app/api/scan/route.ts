import { NextResponse } from "next/server";
import { scan } from "../../../lib/scan";
import { accountsEnabled, getSession } from "../../../lib/auth";
import { assertBudget, record, usage } from "../../../lib/quota";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { city, tradeId, deep, includeOld, includeAll } = await req.json();
    if (!city || !tradeId) return NextResponse.json({ error: "Indique une ville et un métier." }, { status: 400 });
    const s = accountsEnabled() ? await getSession(req) : null;
    const live = !!process.env.GOOGLE_PLACES_API_KEY;
    if (live) await assertBudget(s, deep ? 27 : 3);
    const result = await scan(String(city), String(tradeId), Boolean(deep), Boolean(includeOld), Boolean(includeAll));
    if (live) await record(s, result.calls);
    return NextResponse.json({ ...result, usage: await usage(s).catch(() => null) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Le scan a échoué." }, { status: 500 });
  }
}
