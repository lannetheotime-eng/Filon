import { NextResponse } from "next/server";
import { getGame, hostView } from "../../../../../lib/enquete/game";
import { voiceLive } from "../../../../../lib/enquete/voice";
import { baseUrl, fail } from "../../../../../lib/enquete/http";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const g = await getGame(id);
    if (!g) return fail("Partie introuvable.", 404);
    return NextResponse.json({ ...hostView(g, baseUrl(req)), voiceLive: voiceLive() });
  } catch (e) {
    return fail(e, 500);
  }
}
