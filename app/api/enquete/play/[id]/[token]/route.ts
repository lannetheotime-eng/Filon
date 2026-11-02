import { NextResponse } from "next/server";
import { getGame, playerView, tick } from "../../../../../../lib/enquete/game";
import { voiceLive } from "../../../../../../lib/enquete/voice";
import { baseUrl, fail } from "../../../../../../lib/enquete/http";

export async function GET(req: Request, { params }: { params: Promise<{ id: string; token: string }> }) {
  try {
    const { id, token } = await params;
    let g = await getGame(id);
    const p = g?.players.find((x) => x.token === token);
    if (!g || !p) return fail("Ce lien de partie n'existe pas.", 404);
    g = await tick(g, baseUrl(req));
    return NextResponse.json({ ...playerView(g, p), voiceLive: voiceLive() });
  } catch (e) {
    return fail(e, 500);
  }
}
