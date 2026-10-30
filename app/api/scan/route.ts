import { NextResponse } from "next/server";
import { scan } from "../../../lib/scan";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { city, tradeId, deep, includeOld } = await req.json();
    if (!city || !tradeId) return NextResponse.json({ error: "Indique une ville et un métier." }, { status: 400 });
    const result = await scan(String(city), String(tradeId), Boolean(deep), Boolean(includeOld));
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Le scan a échoué." }, { status: 500 });
  }
}
