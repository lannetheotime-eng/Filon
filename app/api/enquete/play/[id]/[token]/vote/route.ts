import { NextResponse } from "next/server";
import { castVote, getGame } from "../../../../../../../lib/enquete/game";
import { fail } from "../../../../../../../lib/enquete/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; token: string }> }) {
  try {
    const { id, token } = await params;
    const { culprit, motive, missions } = await req.json();
    const g = await getGame(id);
    const p = g?.players.find((x) => x.token === token);
    if (!g || !p) return fail("Ce lien de partie n'existe pas.", 404);
    await castVote(g, p, String(culprit), String(motive), missions);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
