import { NextResponse } from "next/server";
import { countTalk, getGame, npcById } from "../../../../../../../lib/enquete/game";
import { CHARACTERS, npcPrompt } from "../../../../../../../lib/enquete/scenario";
import { characterReply, speech, type Turn } from "../../../../../../../lib/enquete/voice";
import { fail } from "../../../../../../../lib/enquete/http";

export const maxDuration = 60;

// Un joueur parle à un témoin : réponse écrite + voix
export async function POST(req: Request, { params }: { params: Promise<{ id: string; token: string }> }) {
  try {
    const { id, token } = await params;
    const { npc: npcId, history } = await req.json();
    const g = await getGame(id);
    const p = g?.players.find((x) => x.token === token);
    if (!g || !p) return fail("Ce lien de partie n'existe pas.", 404);
    const npc = npcById(g, String(npcId));
    if (!npc) return fail("Ce témoin ne répond pas encore.");
    await countTalk(g);
    const caller = CHARACTERS.find((c) => c.id === p.char)!;
    const turns: Turn[] = (Array.isArray(history) ? history : [])
      .filter((t: any) => (t?.role === "user" || t?.role === "assistant") && typeof t.content === "string" && t.content.trim())
      .slice(-16)
      .map((t: any) => ({ role: t.role, content: String(t.content).slice(0, 600) }));
    const opening: Turn = { role: "user", content: `[Ton téléphone sonne, tu décroches. C'est ${caller.name} (${caller.role}), qui était au restaurant ce soir, qui t'appelle pour te poser des questions.]` };
    const { say, mood } = await characterReply(npcPrompt(npc), [opening, ...turns]);
    let audio: string | null = null;
    let audioError: string | null = null;
    try {
      audio = Buffer.from(await speech(say, npc.voice, npc.tone, mood)).toString("base64");
    } catch (e: any) {
      audioError = e.message;
    }
    return NextResponse.json({ say, mood, audio, audioError });
  } catch (e) {
    return fail(e, 500);
  }
}
