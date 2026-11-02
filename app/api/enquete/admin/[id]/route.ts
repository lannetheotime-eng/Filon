import { NextResponse } from "next/server";
import { getGame, hostView, tick } from "../../../../../lib/enquete/game";
import { voiceLive } from "../../../../../lib/enquete/voice";
import { baseUrl, fail } from "../../../../../lib/enquete/http";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    let g = await getGame(id);
    if (!g) return fail("Partie introuvable.", 404);
    g = await tick(g, baseUrl(req));
    return NextResponse.json({ ...hostView(g, baseUrl(req)), voiceLive: voiceLive() });
  } catch (e) {
    return fail(e, 500);
  }
}
