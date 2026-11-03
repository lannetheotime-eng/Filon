import { NextResponse } from "next/server";
import { getGame, saveGame, useQuestion } from "../../../../../../lib/enquete/game";
import { NPCS, QUESTIONS_PER_CALL, npcPrompt } from "../../../../../../lib/enquete/scenario";
import { characterReply, speech, type Turn } from "../../../../../../lib/enquete/voice";
import { fail } from "../../../../../../lib/enquete/http";

export const maxDuration = 60;

// Le groupe parle au témoin, sur le haut-parleur de l'animateur : réponse écrite + voix
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { callId, history, opener } = await req.json();
    const g = await getGame(id);
    if (!g) return fail("Partie introuvable.", 404);
    const rec = g.calls.find((c) => c.id === String(callId));
    if (!rec) return fail("Appel introuvable.");
    const npc = NPCS.find((n) => n.id === rec.npc)!;
    let left = QUESTIONS_PER_CALL - rec.questions;
    if (!opener) left = (await useQuestion(g, rec.id)).left;
    const turns: Turn[] = (Array.isArray(history) ? history : [])
      .filter((t: any) => (t?.role === "user" || t?.role === "assistant") && typeof t.content === "string" && t.content.trim())
      .slice(-16)
      .map((t: any) => ({ role: t.role, content: String(t.content).slice(0, 600) }));
    const intro: Turn = { role: "user", content: "[Ton téléphone sonne, tu décroches. Le commissaire a passé le téléphone aux suspects de l'affaire : ils sont plusieurs, sur haut-parleur, et vont te poser quelques questions.]" };
    if (!turns.length) turns.push({ role: "user", content: "[Tu décroches.]" });
    let reply: { say: string; mood: string };
    try {
      reply = await characterReply(npcPrompt(npc) + (left === 0 && !opener ? "\n\nC'est la dernière question de l'appel : réponds, puis dis que tu dois raccrocher." : ""), [intro, ...turns]);
    } catch (e) {
      // La ligne a coupé : on rend la question au groupe
      if (!opener) { rec.questions = Math.max(0, rec.questions - 1); await saveGame(g); }
      else if (rec.questions === 0) { g.calls = g.calls.filter((c) => c.id !== rec.id); await saveGame(g); } // le témoin n'a pas décroché : l'appel n'est pas perdu
      throw e;
    }
    const { say, mood } = reply;
    let audio: string | null = null;
    let audioError: string | null = null;
    try {
      audio = Buffer.from(await speech(say, npc.voice, npc.tone, mood)).toString("base64");
    } catch (e: any) {
      audioError = e.message;
    }
    return NextResponse.json({ say, mood, audio, audioError, left });
  } catch (e) {
    return fail(e, 500);
  }
}
