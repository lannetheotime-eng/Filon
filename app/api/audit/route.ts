import { NextResponse } from "next/server";
import { deepAudit } from "../../../lib/deep-audit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (!b.url) return NextResponse.json({ error: "Adresse du site manquante." }, { status: 400 });
    const r = await deepAudit(String(b.url), {
      name: String(b.name || ""), city: String(b.city || ""), trade: String(b.trade || ""),
      phone: b.phone ? String(b.phone) : undefined, rating: b.rating, reviews: b.reviews, photos: b.photos, hours: b.hours,
    });
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "L'audit a échoué." }, { status: 500 });
  }
}
