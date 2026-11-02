import "server-only";

// Dialogue des témoins et voix expressive, avec OpenAI
const KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.ENQUETE_MODEL || "gpt-4.1-mini";
const TTS_MODEL = process.env.ENQUETE_TTS_MODEL || "gpt-4o-mini-tts";

export const voiceLive = () => !!KEY;

export type Turn = { role: "user" | "assistant"; content: string };

function outputText(j: any) {
  if (typeof j?.output_text === "string" && j.output_text) return j.output_text;
  let s = "";
  for (const o of j?.output || []) {
    if (o.type !== "message") continue;
    for (const c of o.content || []) if (c.type === "output_text") s += c.text || "";
  }
  return s;
}

// Réponse d'un personnage : ce qu'il dit + comment il le dit (pour la voix)
export async function characterReply(system: string, history: Turn[]): Promise<{ say: string; mood: string }> {
  if (!KEY) throw new Error("La voix n'est pas configurée : ajoute OPENAI_API_KEY sur Vercel.");
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      instructions:
        system +
        `\n\nFORMAT DE SORTIE : réponds uniquement avec un objet JSON {"say": "ce que tu dis au téléphone", "mood": "comment tu le dis, en quelques mots : émotion, rythme, volume (ex. : nerveuse, parle vite, chuchote à la fin)"}.`,
      input: history.map((t) => ({ role: t.role, content: t.content })),
      max_output_tokens: 300,
    }),
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `OpenAI : erreur ${r.status}`);
  const raw = outputText(j).trim();
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    const o = JSON.parse(m ? m[0] : raw);
    return { say: String(o.say || "").trim() || "…", mood: String(o.mood || "").trim() };
  } catch {
    return { say: raw.replace(/^["{]+|["}]+$/g, "") || "…", mood: "" };
  }
}

// Synthèse vocale expressive (mp3)
export async function speech(text: string, voice: string, tone: string, mood = ""): Promise<ArrayBuffer> {
  if (!KEY) throw new Error("La voix n'est pas configurée : ajoute OPENAI_API_KEY sur Vercel.");
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice,
      input: text,
      instructions: `Parle en français de France, avec un accent naturel, comme au téléphone. Personnage : ${tone}${mood ? ` Dans cette réplique : ${mood}.` : ""} Joue vraiment l'émotion, avec des intonations vivantes, jamais monotone.`,
      response_format: "mp3",
    }),
    cache: "no-store",
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j?.error?.message || `Voix : erreur ${r.status}`);
  }
  return r.arrayBuffer();
}
