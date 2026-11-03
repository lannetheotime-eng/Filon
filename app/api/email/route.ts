import { NextResponse } from "next/server";
import { findEmail } from "../../../lib/find-email";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const site = new URL(req.url).searchParams.get("site");
  if (!site) return NextResponse.json({ error: "Site manquant." }, { status: 400 });
  try {
    return NextResponse.json(await findEmail(site));
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Recherche impossible." }, { status: 500 });
  }
}
