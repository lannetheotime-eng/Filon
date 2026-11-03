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
      name: b.name ? String(b.name).slice(0, 100) : undefined,
      caMin: Number(b.caMin) > 0 ? Number(b.caMin) : undefined,
      netMin: b.netMin === "" || b.netMin == null ? undefined : Number(b.netMin),
      effectif: b.effectif ? String(b.effectif) : undefined,
      holdingOnly: b.holdingOnly !== false,
      pages: Number(b.pages) || 2,
      from: Number(b.from) || 1,
    };
    if (!s.naf.length && !s.zone.trim() && !s.name?.trim()) return NextResponse.json({ error: "Choisis au moins un secteur, une zone ou un nom." }, { status: 400 });
    if (b.demo) {
      const d = demoHoldings(s);
      return NextResponse.json({ ...d, leads: d.leads.filter((l) => (!s.caMin || (l.ca != null && l.ca >= s.caMin)) && (s.netMin == null || (l.net != null && l.net >= s.netMin))) });
    }
    return NextResponse.json(await searchHoldings(s));
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "La recherche a échoué." }, { status: 500 });
  }
}
