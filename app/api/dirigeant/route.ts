import { NextResponse } from "next/server";
import { findDirigeant } from "../../../lib/registry";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const name = u.searchParams.get("name") || "";
  const address = u.searchParams.get("address") || "";
  if (!name) return NextResponse.json({ error: "Nom d'entreprise manquant." }, { status: 400 });
  try {
    return NextResponse.json({ results: await findDirigeant(name, address) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Recherche impossible." }, { status: 500 });
  }
}
