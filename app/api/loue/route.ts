import { NextResponse } from "next/server";
import { parseAnnonce, toNum, type Bien } from "../../../lib/loue-parse";
import { DEMO_MELO } from "../../../lib/loue-demo";

export const dynamic = "force-dynamic";

// API Melo (agrégateur d'annonces) : https://api.notif.immo, clé dans MELO_API_KEY
const MELO = "https://api.notif.immo/documents/properties";
const TYPES: Record<string, string> = { appartement: "0", maison: "1", immeuble: "2" };

function fromMelo(p: any): Bien | null {
  if (!p) return null;
  const advert = Array.isArray(p.adverts) ? p.adverts[0] : null;
  const text = [p.title, p.description].filter(Boolean).join("\n");
  const parsed = parseAnnonce(text);
  const prix = toNum(p.price) ?? parsed.prix;
  const carrez = parsed.surfaceSource === "carrez";
  const surface = carrez ? parsed.carrez : toNum(p.surface) ?? parsed.carrez;
  const ville = [p.city?.name, p.city?.zipcode].filter(Boolean).join(" ") || parsed.ville;
  return {
    id: String(p.uuid ?? p.id ?? p["@id"] ?? Math.random().toString(36).slice(2)),
    titre: String(p.title || parsed.titre || "Annonce sans titre").slice(0, 120),
    ville,
    prix: prix != null ? Math.round(prix) : null,
    surface,
    carrez,
    loyer: parsed.loyer,
    bail: parsed.finBail,
    statut: parsed.statut,
    preuve: parsed.preuve,
    lien: String(advert?.url || p.url || ""),
    source: String(advert?.publisher?.name || advert?.publisher || "Melo"),
    date: p.createdAt || p.updatedAt,
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  if (body.demo) {
    const biens = DEMO_MELO.map(fromMelo).filter(Boolean);
    return NextResponse.json({ biens, total: biens.length, scanned: biens.length, demo: true });
  }

  const key = process.env.MELO_API_KEY;
  if (!key) return NextResponse.json({ configured: false, error: "La recherche automatique n'est pas encore branchée : il manque la clé Melo." }, { status: 503 });

  const zips = String(body.zips || "").split(/[,\s;]+/).filter((z) => /^\d{5}$/.test(z)).slice(0, 20);
  if (!zips.length) return NextResponse.json({ error: "Indique au moins un code postal, par exemple 31000." }, { status: 400 });
  const types = (Array.isArray(body.types) ? body.types : ["appartement"]).map((t: string) => TYPES[t]).filter(Boolean);

  const raw: any[] = [];
  let total = 0;
  for (let page = 1; page <= 3; page++) {
    const u = new URL(MELO);
    u.searchParams.set("transactionType", "0");
    types.forEach((t: string) => u.searchParams.append("propertyTypes[]", t));
    zips.forEach((z) => u.searchParams.append("includedZipcodes[]", z));
    const budget = toNum(body.budgetMax);
    if (budget) u.searchParams.set("budgetMax", String(Math.round(budget)));
    const surf = toNum(body.surfaceMin);
    if (surf) u.searchParams.set("surfaceMin", String(Math.round(surf)));
    u.searchParams.set("withCoherentPrice", "true");
    u.searchParams.set("order[updatedAt]", "desc");
    u.searchParams.set("itemsPerPage", "30");
    u.searchParams.set("page", String(page));

    const r = await fetch(u, { headers: { "X-API-KEY": key, Accept: "application/ld+json" }, cache: "no-store" });
    if (r.status === 401 || r.status === 403) return NextResponse.json({ error: "Melo refuse la clé : vérifie MELO_API_KEY et que ton offre inclut l'API." }, { status: 502 });
    if (!r.ok) return NextResponse.json({ error: `Melo a répondu ${r.status}. Réessaie dans un instant.` }, { status: 502 });
    const j = await r.json();
    total = j["hydra:totalItems"] ?? total;
    const members = j["hydra:member"] || j.member || [];
    raw.push(...members);
    if (members.length < 30) break;
  }

  const biens = raw.map(fromMelo).filter(Boolean);
  return NextResponse.json({ biens, total, scanned: raw.length });
}
