import { NextResponse } from "next/server";
import { getGame, hostView, launchAct } from "../../../../../../lib/enquete/game";
import { voiceLive } from "../../../../../../lib/enquete/voice";
import { baseUrl, fail } from "../../../../../../lib/enquete/http";

export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { act } = await req.json();
    const g = await getGame(id);
    if (!g) return fail("Partie introuvable.", 404);
    await launchAct(g, act, baseUrl(req));
    return NextResponse.json({ ...hostView(g, baseUrl(req)), voiceLive: voiceLive() });
  } catch (e) {
    return fail(e);
  }
}
