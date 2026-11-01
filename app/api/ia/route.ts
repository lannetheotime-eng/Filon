import { NextResponse } from "next/server";
import { citeTest, iaEngines } from "../../../lib/ia";

export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ engines: iaEngines() });
}

export async function POST(req: Request) {
  try {
    const { name, trade, city, website } = await req.json();
    if (!name?.trim() || !trade?.trim() || !city?.trim()) return NextResponse.json({ error: "Indiquez le nom, l'activité et la ville." }, { status: 400 });
    const result = await citeTest({ name: String(name), trade: String(trade), city: String(city), website: website ? String(website) : undefined });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Le test a échoué." }, { status: 500 });
  }
}
