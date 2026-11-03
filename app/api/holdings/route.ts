import { NextResponse } from "next/server";
import { demoHoldings, searchHoldings } from "../../../lib/holdings";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const s = {
      naf: (Array.isArray(b.naf) ? b.naf : String(b.naf || "").split(",")).map((x: string) => String(x).trim().toUpperCase()).filter((x: string) => /^\d{2}\.\d{2}[A-Z]$/.test(x)).slice(0, 20),
      zone: String(b.zone || "").slice(0, 80),
      effectif: b.effectif ? String(b.effectif) : undefined,
      holdingOnly: b.holdingOnly !== false,
      pages: Number(b.pages) || 2,
    };
    if (!s.naf.length && !s.zone.trim()) return NextResponse.json({ error: "Choisis au moins un secteur ou une zone." }, { status: 400 });
    return NextResponse.json(b.demo ? demoHoldings(s) : await searchHoldings(s));
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "La recherche a échoué." }, { status: 500 });
  }
}
