import { commissaireLine, getGame } from "../../../../../../lib/enquete/game";
import { COMMISSAIRE } from "../../../../../../lib/enquete/scenario";
import { speech } from "../../../../../../lib/enquete/voice";
import { fail } from "../../../../../../lib/enquete/http";

export const maxDuration = 60;

// Le commissaire parle, sur le haut-parleur de l'animateur
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const line = new URL(req.url).searchParams.get("line") as "acte1" | "acte2" | "acte3" | "revelation";
    if (!["acte1", "acte2", "acte3", "revelation"].includes(line)) return fail("Réplique inconnue.");
    const g = await getGame(id);
    if (!g) return fail("Partie introuvable.", 404);
    if (!g.acts[line]) return fail("Lance d'abord cet acte.");
    const audio = await speech(commissaireLine(line), COMMISSAIRE.voice, COMMISSAIRE.tone, line === "revelation" ? "solennel, il prend son temps, il savoure chaque révélation" : "");
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    return fail(e, 500);
  }
}
