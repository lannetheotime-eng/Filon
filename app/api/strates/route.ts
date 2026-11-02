import { NextResponse } from "next/server";
import { excavate } from "../../../lib/strates";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { domain } = await req.json();
    if (!domain?.trim()) return NextResponse.json({ error: "Indiquez un nom de domaine." }, { status: 400 });
    return NextResponse.json(await excavate(String(domain)));
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "La fouille a échoué." }, { status: 500 });
  }
}
