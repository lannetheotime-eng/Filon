import "server-only";
import { hasKV, kv } from "./kv";
import type { Session } from "./token";

// Limites par défaut, modifiables dans Vercel
const MONTHLY = () => Number(process.env.MONTHLY_CALLS || 300); // par utilisateur
const DAILY = () => Number(process.env.DAILY_CALLS || 300); // pour tout l'outil

const month = () => new Date().toISOString().slice(0, 7);
const day = () => new Date().toISOString().slice(0, 10);

// Repli sans base : compteur en mémoire (par instance serveur, indicatif)
const mem = new Map<string, number>();

async function get(key: string) {
  if (hasKV()) return Number((await kv<string | null>("GET", key)) || 0);
  return mem.get(key) || 0;
}
async function add(key: string, n: number, ttl: number) {
  if (hasKV()) {
    await kv("INCRBY", key, n);
    await kv("EXPIRE", key, ttl);
  } else mem.set(key, (mem.get(key) || 0) + n);
}

export type Usage = { used: number; limit: number | null; today: number; dailyLimit: number };

export async function usage(s: Session | null): Promise<Usage> {
  const today = await get(`usage:all:${day()}`);
  const used = s ? await get(`usage:${s.uid}:${month()}`) : await get(`usage:all:${month()}`);
  const limit = s && s.role !== "admin" ? MONTHLY() : null;
  return { used, limit, today, dailyLimit: DAILY() };
}

// Vérifie avant une opération qui coûtera jusqu'à `need` requêtes Google
export async function assertBudget(s: Session | null, need: number) {
  if (!hasKV()) return; // sans base, pas de compteur fiable : le plafond se règle dans Google Cloud
  const u = await usage(s);
  if (u.today + need > u.dailyLimit)
    throw new Error(`Plafond du jour atteint (${u.dailyLimit} requêtes Google). Réessaie demain, ou relève DAILY_CALLS dans Vercel.`);
  if (u.limit != null && u.used + need > u.limit)
    throw new Error(`Tu as utilisé tes ${u.limit} requêtes du mois${need > 3 ? " : essaie un scan rapide" : ""}.`);
}

export async function record(s: Session | null, n: number) {
  if (!n) return;
  await add(`usage:all:${day()}`, n, 2 * 86400);
  await add(`usage:all:${month()}`, n, 40 * 86400);
  if (s) await add(`usage:${s.uid}:${month()}`, n, 40 * 86400);
}
