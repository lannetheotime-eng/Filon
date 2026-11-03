import { NextResponse } from "next/server";
import { getGame, startCall } from "../../../../../../lib/enquete/game";
import { fail } from "../../../../../../lib/enquete/http";

// L'animateur appelle un témoin (un appel par acte)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { npc } = await req.json();
    const g = await getGame(id);
    if (!g) return fail("Partie introuvable.", 404);
    return NextResponse.json(await startCall(g, String(npc)));
  } catch (e) {
    return fail(e);
  }
}
