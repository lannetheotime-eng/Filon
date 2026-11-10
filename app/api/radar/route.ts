import { NextResponse } from "next/server";
import { radar, geocode } from "../../../lib/radar";
import type { RadarQuery } from "../../../lib/radar-shared";
import { SECTORS } from "../../../lib/radar-shared";

export const runtime = "nodejs";
export const maxDuration = 30;

// Liste des créations, arrivées et rachats publiés au BODACC (gratuit, aucune requête Google)
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const q: RadarQuery = {
      zone: String(b.zone || "31").slice(0, 120),
      sector: SECTORS.some((s) => s.id === b.sector) ? b.sector : "tout",
      days: Math.max(1, Math.min(365, Number(b.days) || 30)),
      creations: b.creations !== false,
      reprises: b.reprises !== false,
      offset: Math.max(0, Number(b.offset) || 0),
    };
    return NextResponse.json(await radar(q));
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Le radar n'a pas pu lire le BODACC." }, { status: 500 });
  }
}

// Coordonnées d'une adresse, pour placer l'entreprise sur la carte du pipeline
export async function GET(req: Request) {
  const u = new URL(req.url);
  const addr = (u.searchParams.get("geo") || "").slice(0, 300);
  const cp = (u.searchParams.get("cp") || "").slice(0, 5);
  if (!addr && !cp) return NextResponse.json({ error: "Adresse manquante." }, { status: 400 });
  return NextResponse.json((await geocode(addr || cp, cp)) || { lat: null, lng: null });
}
