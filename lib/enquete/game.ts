import "server-only";
import { randomBytes } from "crypto";
import { hasKV, kv, kvGetJSON, kvSetJSON } from "../kv";
import { normalizePhone, sendSms, smsLive, toGsm } from "./sms";
import {
  ACTS, CHARACTERS, COMMISSAIRE, FACTS, LAB_REPORT, MOTIVES, NPCS, SMS, SOLUTION, SURPRISE_DELAY_MIN, TITLE, VENUE,
  charactersFor, npcsFor, type ActId, type CharId, type NpcId,
} from "./scenario";

export type Player = { token: string; name: string; phone: string; char: CharId };
export type SmsLog = { at: number; to: string; char: CharId | "all"; kind: string; body: string; status: "sent" | "test" | "error"; error?: string };
export type Vote = { culprit: CharId; motive: string; at: number };
export type Game = {
  id: string;
  createdAt: number;
  players: Player[];
  acts: Partial<Record<ActId, number>>;
  surpriseSent?: boolean;
  sms: SmsLog[];
  votes: Record<string, Vote>;
  talks: number;
};

const KEY = (id: string) => `enquete:game:${id}`;
const TTL = 60 * 60 * 24 * 45;
const MAX_TALKS = 400; // garde-fou sur le coût de la voix par partie

const rid = (n: number) => randomBytes(n).toString("base64url").replace(/[-_]/g, "").slice(0, n + 4);

function ensureKV() {
  if (!hasKV()) throw new Error("Il faut une base Redis (Upstash) branchée au projet Vercel pour jouer à plusieurs.");
}

// Les votes et le compteur d'appels vivent dans leurs propres clés : plusieurs joueurs écrivent en même temps
const VOTES = (id: string) => `enquete:votes:${id}`;
const TALKS = (id: string) => `enquete:talks:${id}`;
const SURPRISE = (id: string) => `enquete:surprise:${id}`;

export async function getGame(id: string) {
  ensureKV();
  if (!/^[A-Za-z0-9]{4,20}$/.test(id)) return null;
  const g = await kvGetJSON<Game>(KEY(id));
  if (!g) return null;
  const raw = await kv<string[]>("HGETALL", VOTES(id));
  g.votes = {};
  for (let i = 0; i + 1 < (raw || []).length; i += 2) {
    try { g.votes[raw[i]] = JSON.parse(raw[i + 1]); } catch {}
  }
  return g;
}
export const saveGame = (g: Game) => kvSetJSON(KEY(g.id), { ...g, votes: {} }, TTL);

export async function createGame(input: { name: string; phone: string; char?: CharId }[]) {
  ensureKV();
  const rows = input.map((p) => ({ name: p.name.trim(), phone: p.phone.trim(), char: p.char })).filter((p) => p.name);
  if (rows.length < 3 || rows.length > 4) throw new Error("Il faut 3 ou 4 joueurs.");
  const chars = charactersFor(rows.length).map((c) => c.id);
  // Personnages choisis à la main, sinon tirés au sort
  const chosen = rows.map((r) => r.char).filter(Boolean) as CharId[];
  if (chosen.some((c) => !chars.includes(c))) throw new Error("Paul Vidal n'est jouable qu'à 4 joueurs.");
  if (new Set(chosen).size !== chosen.length) throw new Error("Deux joueurs ont le même personnage.");
  const free = chars.filter((c) => !chosen.includes(c));
  for (let i = free.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [free[i], free[j]] = [free[j], free[i]];
  }
  const players: Player[] = rows.map((r) => ({
    token: rid(10),
    name: r.name,
    phone: r.phone ? normalizePhone(r.phone) : "",
    char: (r.char || free.shift()) as CharId,
  }));
  const g: Game = { id: rid(6), createdAt: Date.now(), players, acts: {}, sms: [], votes: {}, talks: 0 };
  await saveGame(g);
  return g;
}

const charOf = (id: CharId) => CHARACTERS.find((c) => c.id === id)!;
export const playerLink = (base: string, g: Game, p: Player) => `${base}/enquete/${g.id}/${p.token}`;

async function text(g: Game, p: Player, kind: string, body: string) {
  const res = p.phone ? await sendSms(p.phone, body) : { status: "test" as const };
  g.sms.push({ at: Date.now(), to: p.name, char: p.char, kind, body: toGsm(body), ...res });
}

export async function launchAct(g: Game, act: ActId, base: string) {
  const order = ACTS.map((a) => a.id);
  const idx = order.indexOf(act);
  if (idx < 0) throw new Error("Acte inconnu.");
  if (act !== "invitation" && act !== "acte1" && !g.acts[order[idx - 1]]) throw new Error("Lance d'abord l'acte précédent.");
  g.acts[act] = Date.now();
  for (const p of g.players) {
    const c = charOf(p.char);
    const link = playerLink(base, g, p);
    if (act === "invitation") await text(g, p, "Invitation", SMS.invitation(c, link));
    if (act === "acte1") await text(g, p, "Acte 1", SMS.acte1(c, link));
    if (act === "acte2") await text(g, p, "Acte 2", SMS.acte2(c, link));
    if (act === "acte3") await text(g, p, "Acte 3", SMS.acte3(link));
  }
  await saveGame(g);
  return g;
}

// Appelé régulièrement par les pages ouvertes : envoie le SMS surprise quand c'est l'heure
export async function tick(g: Game, base: string) {
  const a2 = g.acts.acte2;
  if (a2 && !g.surpriseSent && Date.now() - a2 >= SURPRISE_DELAY_MIN * 60_000) {
    // Un seul envoi, même si plusieurs pages appellent en même temps
    const got = await kv<string | null>("SET", SURPRISE(g.id), "1", "NX", "EX", TTL);
    if (got !== "OK") return g;
    const fresh = (await getGame(g.id)) || g;
    g = fresh;
    g.surpriseSent = true;
    for (const p of g.players) await text(g, p, "Témoin surprise", SMS.surprise(playerLink(base, g, p)));
    await saveGame(g);
  }
  return g;
}

export function unlockedNpcs(g: Game) {
  return npcsFor(g.players.length).filter((n) => (n.unlock === "surprise" ? g.surpriseSent : !!g.acts[n.unlock as ActId]));
}

export function results(g: Game) {
  const tally: Record<string, number> = {};
  for (const v of Object.values(g.votes)) tally[v.culprit] = (tally[v.culprit] || 0) + 1;
  const voters = g.players.filter((p) => p.char !== SOLUTION.culprit);
  const found = voters.filter((p) => g.votes[p.token]?.culprit === SOLUTION.culprit);
  const killer = g.players.find((p) => p.char === SOLUTION.culprit);
  return {
    tally,
    killerWins: found.length * 2 <= voters.length,
    killer: killer ? { name: killer.name, char: charOf(killer.char).name } : null,
    detail: g.players.map((p) => {
      const v = g.votes[p.token];
      return {
        name: p.name,
        char: charOf(p.char).name,
        culprit: v ? charOf(v.culprit).name : null,
        motive: v ? MOTIVES.find((m) => m.id === v.motive)?.label || "" : null,
        right: !!v && v.culprit === SOLUTION.culprit && p.char !== SOLUTION.culprit,
        motiveRight: !!v && v.motive === SOLUTION.motive,
      };
    }),
  };
}

// Ce qu'un joueur a le droit de voir, et rien de plus
export function playerView(g: Game, p: Player) {
  const c = charOf(p.char);
  const a = g.acts;
  const revealed = !!a.revelation;
  return {
    title: TITLE,
    venue: VENUE,
    facts: FACTS,
    me: {
      name: p.name,
      char: { id: c.id, name: c.name, age: c.age, role: c.role, costume: c.costume, publicIntro: c.publicIntro },
      official: a.acte1 ? c.official : null,
      secret: a.acte1 ? c.secret : null,
      objectives: a.acte1 ? c.objectives : null,
      clues: a.acte2 ? c.clues.map((k) => k.text) : [],
    },
    cast: g.players.map((o) => {
      const oc = charOf(o.char);
      return { name: o.name, char: oc.name, role: oc.role, publicIntro: oc.publicIntro, me: o.token === p.token };
    }),
    acts: ACTS.map((x) => ({ id: x.id, title: x.title, at: a[x.id] || null })),
    npcs: unlockedNpcs(g).map((n) => ({ id: n.id, name: n.name, role: n.role, initials: n.initials })),
    lab: a.acte3 ? LAB_REPORT : null,
    vote: a.acte3 && !revealed ? { suspects: g.players.map((o) => ({ id: o.char, name: charOf(o.char).name })), motives: MOTIVES, mine: g.votes[p.token] || null } : null,
    solution: revealed ? { text: SOLUTION.text, results: results(g) } : null,
    voteCount: Object.keys(g.votes).length,
  };
}

export function hostView(g: Game, base: string) {
  const revealed = !!g.acts.revelation;
  return {
    id: g.id,
    title: TITLE,
    smsLive: smsLive(),
    players: g.players.map((p) => ({ name: p.name, phone: p.phone, char: charOf(p.char).name, link: playerLink(base, g, p), voted: !!g.votes[p.token] })),
    acts: ACTS.map((x) => ({ ...x, at: g.acts[x.id] || null })),
    surprise: { sent: !!g.surpriseSent, dueAt: g.acts.acte2 ? g.acts.acte2 + SURPRISE_DELAY_MIN * 60_000 : null },
    sms: g.sms.map((s) => ({ at: s.at, to: s.to, kind: s.kind, status: s.status, error: s.error, body: s.body })),
    commissaire: { acte1: !!g.acts.acte1, acte2: !!g.acts.acte2, acte3: !!g.acts.acte3, revelation: revealed },
    results: revealed ? results(g) : null,
    votes: Object.keys(g.votes).length,
  };
}

export function commissaireLine(act: "acte1" | "acte2" | "acte3" | "revelation") {
  if (act === "revelation") return SOLUTION.text;
  return COMMISSAIRE[act];
}

export async function castVote(g: Game, p: Player, culprit: string, motive: string) {
  if (!g.acts.acte3) throw new Error("Le vote ouvre à l'acte 3.");
  if (g.acts.revelation) throw new Error("Le vote est clos.");
  if (!g.players.some((o) => o.char === culprit)) throw new Error("Suspect inconnu.");
  if (!MOTIVES.some((m) => m.id === motive)) throw new Error("Mobile inconnu.");
  const v: Vote = { culprit: culprit as CharId, motive, at: Date.now() };
  await kv("HSET", VOTES(g.id), p.token, JSON.stringify(v));
  await kv("EXPIRE", VOTES(g.id), TTL);
  g.votes[p.token] = v;
}

export function npcById(g: Game, id: string) {
  return unlockedNpcs(g).find((n) => n.id === id) || null;
}

export async function countTalk(g: Game) {
  const n = await kv<number>("INCR", TALKS(g.id));
  if (n === 1) await kv("EXPIRE", TALKS(g.id), TTL);
  if (n > MAX_TALKS) throw new Error("Limite d'appels atteinte pour cette partie.");
}

export { NPCS };
export type { NpcId };
