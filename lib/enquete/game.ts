import "server-only";
import { randomBytes } from "crypto";
import { hasKV, kv, kvGetJSON, kvSetJSON } from "../kv";
import { normalizePhone, sendSms, smsLive, toGsm } from "./sms";
import {
  ACTS, CALL_ACTS, CHARACTERS, COMMISSAIRE, EVIDENCE, FACTS, GRILL_SECONDS, MOTIVES, POINTS, QUESTIONS_PER_CALL, SMS, SOLUTION, TITLE, VENUE,
  charactersFor, npcsFor, type ActId, type CharId,
} from "./scenario";

export type Player = { token: string; name: string; phone: string; char: CharId };
export type SmsLog = { at: number; to: string; char: CharId | "all"; kind: string; body: string; status: "sent" | "test" | "error"; error?: string };
export type Vote = { culprit: CharId; motive: string; missions: string[]; at: number };
export type CallRec = { id: string; act: string; npc: string; questions: number; at: number };
export type Game = {
  id: string;
  createdAt: number;
  players: Player[];
  acts: Partial<Record<ActId, number>>;
  sms: SmsLog[];
  calls: CallRec[];
  votes: Record<string, Vote>;
};

const KEY = (id: string) => `enquete:game:${id}`;
const VOTES = (id: string) => `enquete:votes:${id}`; // les joueurs votent en même temps : une clé à part
const TTL = 60 * 60 * 24 * 45;

const rid = (n: number) => randomBytes(n * 2).toString("base64url").replace(/[-_]/g, "").slice(0, n + 4);
const charOf = (id: CharId) => CHARACTERS.find((c) => c.id === id)!;

function ensureKV() {
  if (!hasKV()) throw new Error("Il faut une base Redis (Upstash) branchée au projet Vercel pour jouer à plusieurs.");
}

export async function getGame(id: string) {
  ensureKV();
  if (!/^[A-Za-z0-9]{4,20}$/.test(id)) return null;
  const g = await kvGetJSON<Game>(KEY(id));
  if (!g) return null;
  g.calls ||= [];
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
  const rows = input.map((p) => ({ name: p.name.trim(), phone: (p.phone || "").trim(), char: p.char || undefined })).filter((p) => p.name);
  if (rows.length < 3 || rows.length > 4) throw new Error("Il faut 3 ou 4 joueurs.");
  const chars = charactersFor(rows.length).map((c) => c.id);
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
  const g: Game = { id: rid(6), createdAt: Date.now(), players, acts: {}, sms: [], calls: [], votes: {} };
  await saveGame(g);
  return g;
}

export const playerLink = (base: string, g: Game, p: Player) => `${base}/enquete/${g.id}/${p.token}`;

async function text(g: Game, p: Player, kind: string, body: string) {
  const res = p.phone ? await sendSms(p.phone, body) : { status: "test" as const };
  g.sms.push({ at: Date.now(), to: p.name, char: p.char, kind, body: toGsm(body), ...res });
}

export async function launchAct(g: Game, act: ActId, base: string) {
  const order = ACTS.map((a) => a.id);
  const idx = order.indexOf(act);
  if (idx < 0) throw new Error("Acte inconnu.");
  if (g.acts[act]) throw new Error("Cet acte est déjà lancé.");
  if (act !== "invitation" && act !== "acte1" && !g.acts[order[idx - 1]]) throw new Error("Lance d'abord l'acte précédent.");
  g.acts[act] = Date.now();
  for (const p of g.players) {
    const c = charOf(p.char);
    const link = playerLink(base, g, p);
    if (act === "invitation") await text(g, p, "Invitation", SMS.invitation(c, link));
    if (act === "acte1") await text(g, p, "Acte 1", SMS.acte1(c, link));
    if (act === "acte2") await text(g, p, "Acte 2", SMS.acte2(c, link));
    if (act === "acte3") await text(g, p, "Acte 3", SMS.acte3(c, link));
  }
  await saveGame(g);
  return g;
}

export const currentAct = (g: Game) => [...ACTS].reverse().find((a) => g.acts[a.id])?.id || null;

export function availableNpcs(g: Game) {
  return npcsFor(g.players.length).filter((n) => !!g.acts[n.unlock]);
}

// Un appel par acte (2 et 3), passé par l'animateur sur haut-parleur
export function callState(g: Game) {
  const act = currentAct(g);
  const open = !g.acts.revelation && (CALL_ACTS as readonly string[]).includes(act || "");
  const current = open ? g.calls.find((c) => c.act === act) || null : null;
  return {
    act,
    allowed: open,
    used: g.calls.length,
    total: CALL_ACTS.length,
    current: current ? { ...current, left: Math.max(0, QUESTIONS_PER_CALL - current.questions) } : null,
  };
}

export async function startCall(g: Game, npcId: string) {
  const st = callState(g);
  if (!st.allowed) throw new Error("Pas d'appel possible à ce moment de la partie.");
  if (st.current) {
    if (st.current.npc !== npcId) throw new Error("L'appel de cet acte est déjà utilisé.");
    return st.current; // on rappelle le même témoin : même appel, questions restantes
  }
  if (!availableNpcs(g).some((n) => n.id === npcId)) throw new Error("Ce témoin ne répond pas.");
  const rec: CallRec = { id: rid(6), act: st.act!, npc: npcId, questions: 0, at: Date.now() };
  g.calls.push(rec);
  await saveGame(g);
  return { ...rec, left: QUESTIONS_PER_CALL };
}

export async function useQuestion(g: Game, callId: string) {
  const rec = g.calls.find((c) => c.id === callId);
  if (!rec || rec.act !== currentAct(g) || g.acts.revelation) throw new Error("Cet appel est terminé.");
  if (rec.questions >= QUESTIONS_PER_CALL) throw new Error("Plus de questions pour cet appel.");
  rec.questions++;
  await saveGame(g);
  return { rec, left: QUESTIONS_PER_CALL - rec.questions };
}

export function missionsUpTo(char: CharId, g: Game) {
  return charOf(char).missions.filter((m) => !!g.acts[m.act]);
}

export function results(g: Game) {
  const voters = g.players.filter((p) => p.char !== SOLUTION.culprit);
  const found = voters.filter((p) => g.votes[p.token]?.culprit === SOLUTION.culprit);
  const killerWins = found.length * 2 <= voters.length;
  const killer = g.players.find((p) => p.char === SOLUTION.culprit);
  const detail = g.players.map((p) => {
    const v = g.votes[p.token];
    const isKiller = p.char === SOLUTION.culprit;
    const valid = new Set(charOf(p.char).missions.map((m) => m.id));
    const missions = (v?.missions || []).filter((m) => valid.has(m)).length;
    const right = !!v && !isKiller && v.culprit === SOLUTION.culprit;
    const motiveRight = !!v && !isKiller && v.motive === SOLUTION.motive;
    const points = missions * POINTS.mission + (right ? POINTS.culprit : 0) + (motiveRight ? POINTS.motive : 0) + (isKiller && killerWins ? POINTS.killerEscapes : 0);
    return {
      name: p.name,
      char: charOf(p.char).name,
      culprit: v ? charOf(v.culprit).name : null,
      motive: v ? MOTIVES.find((m) => m.id === v.motive)?.label || "" : null,
      right, motiveRight, isKiller, missions,
      missionsTotal: charOf(p.char).missions.length,
      points,
    };
  });
  detail.sort((a, b) => b.points - a.points);
  return { killerWins, killer: killer ? { name: killer.name, char: charOf(killer.char).name } : null, detail, points: POINTS };
}

// Ce qu'un joueur a le droit de voir, et rien de plus
export function playerView(g: Game, p: Player) {
  const c = charOf(p.char);
  const a = g.acts;
  const act = currentAct(g);
  const revealed = !!a.revelation;
  const nowMissions = act === "acte1" || act === "acte2" || act === "acte3" ? c.missions.filter((m) => m.act === act) : [];
  return {
    title: TITLE,
    venue: VENUE,
    facts: FACTS,
    act,
    actTitle: ACTS.find((x) => x.id === act)?.title || null,
    envelope: act === "acte2" ? 2 : act === "acte3" ? 3 : null,
    me: {
      name: p.name,
      char: { id: c.id, name: c.name, age: c.age, role: c.role, costume: c.costume, publicIntro: c.publicIntro },
      official: a.acte1 ? c.official : null,
      secret: a.acte1 ? c.secret : null,
      objectives: a.acte1 ? c.objectives : null,
      clues: a.acte2 ? c.clues.map((k) => k.text) : [],
      missionsNow: nowMissions.map((m) => m.text),
      missionsAll: missionsUpTo(p.char, g).map((m) => ({ id: m.id, act: m.act, text: m.text })),
    },
    cast: g.players.map((o) => {
      const oc = charOf(o.char);
      return { name: o.name, char: oc.name, role: oc.role, publicIntro: oc.publicIntro, me: o.token === p.token };
    }),
    acts: ACTS.map((x) => ({ id: x.id, title: x.title, at: a[x.id] || null })),
    evidence: EVIDENCE.filter((e) => (e.envelope === 2 && a.acte2) || (e.envelope === 3 && a.acte3)).map((e) => ({ envelope: e.envelope, title: e.title, lines: e.lines })),
    vote: a.acte3 && !revealed
      ? { suspects: g.players.map((o) => ({ id: o.char, name: charOf(o.char).name })), motives: MOTIVES, mine: g.votes[p.token] || null }
      : null,
    solution: revealed ? { text: SOLUTION.text, results: results(g) } : null,
  };
}

export function hostView(g: Game, base: string) {
  const revealed = !!g.acts.revelation;
  const cs = callState(g);
  return {
    id: g.id,
    title: TITLE,
    smsLive: smsLive(),
    act: currentAct(g),
    players: g.players.map((p) => ({ name: p.name, phone: p.phone, char: charOf(p.char).name, link: playerLink(base, g, p), voted: !!g.votes[p.token] })),
    acts: ACTS.map((x) => ({ ...x, at: g.acts[x.id] || null })),
    grill: { seconds: GRILL_SECONDS, order: g.players.map((p) => ({ name: p.name, char: charOf(p.char).name })) },
    calls: { ...cs, npcs: cs.allowed ? availableNpcs(g).map((n) => ({ id: n.id, name: n.name, role: n.role, initials: n.initials })) : [], perCall: QUESTIONS_PER_CALL },
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

export async function castVote(g: Game, p: Player, culprit: string, motive: string, missions: unknown) {
  if (!g.acts.acte3) throw new Error("Le vote ouvre à l'acte 3.");
  if (g.acts.revelation) throw new Error("Le vote est clos.");
  if (!g.players.some((o) => o.char === culprit)) throw new Error("Suspect inconnu.");
  if (!MOTIVES.some((m) => m.id === motive)) throw new Error("Mobile inconnu.");
  const valid = new Set(charOf(p.char).missions.map((m) => m.id));
  const done = Array.isArray(missions) ? [...new Set(missions.map(String))].filter((m) => valid.has(m)) : [];
  const v: Vote = { culprit: culprit as CharId, motive, missions: done, at: Date.now() };
  await kv("HSET", VOTES(g.id), p.token, JSON.stringify(v));
  await kv("EXPIRE", VOTES(g.id), TTL);
  g.votes[p.token] = v;
}
