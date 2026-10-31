import { NextResponse } from "next/server";
import { accountsEnabled, getSession } from "../../../lib/auth";
import { kvGetJSON, kvSetJSON } from "../../../lib/kv";

export const runtime = "nodejs";

// Données synchronisées d'un utilisateur : pipeline, entreprises suivies, réglages
export async function GET(req: Request) {
  const s = accountsEnabled() ? await getSession(req) : null;
  if (!s) return NextResponse.json({ data: null });
  return NextResponse.json({ data: await kvGetJSON(`data:${s.uid}`) });
}

export async function PUT(req: Request) {
  const s = accountsEnabled() ? await getSession(req) : null;
  if (!s) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const body = await req.text();
  if (body.length > 900_000) return NextResponse.json({ error: "Trop de données à enregistrer : archive des entreprises perdues." }, { status: 413 });
  const data = JSON.parse(body);
  await kvSetJSON(`data:${s.uid}`, { ...data, savedAt: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
