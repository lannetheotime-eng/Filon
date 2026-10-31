import { NextResponse } from "next/server";
import { accountsEnabled, createInvite, getSession } from "../../../lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const s = accountsEnabled() ? await getSession(req) : null;
  if (!s || s.role !== "admin") return NextResponse.json({ error: "Réservé à l'administrateur." }, { status: 403 });
  return NextResponse.json({ code: await createInvite() });
}
