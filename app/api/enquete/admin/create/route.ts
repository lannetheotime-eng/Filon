import { NextResponse } from "next/server";
import { createGame } from "../../../../../lib/enquete/game";
import { fail } from "../../../../../lib/enquete/http";

export async function POST(req: Request) {
  try {
    const { players } = await req.json();
    if (!Array.isArray(players)) return fail("Liste de joueurs manquante.");
    const g = await createGame(players);
    return NextResponse.json({ id: g.id });
  } catch (e) {
    return fail(e);
  }
}
