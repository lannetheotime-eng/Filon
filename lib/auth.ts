import "server-only";
import { hasKV, kv, kvGetJSON, kvSetJSON } from "./kv";
import { SESSION_COOKIE, verifySession, signSession, hashPassword, randomId, type Session } from "./token";

export type User = {
  id: string;
  email: string;
  name: string;
  hash: string;
  salt: string;
  role: "admin" | "user";
  createdAt: string;
  monthlyLimit?: number; // requêtes Google par mois ; vide = limite par défaut
};

export const accountsEnabled = hasKV;

export function readCookie(req: Request, name: string) {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export async function getSession(req: Request): Promise<Session | null> {
  return verifySession(readCookie(req, SESSION_COOKIE));
}

const norm = (email: string) => email.trim().toLowerCase();

export async function getUser(email: string) {
  return kvGetJSON<User>(`user:${norm(email)}`);
}

export async function userCount() {
  return Number((await kv<string | null>("GET", "users:count")) || 0);
}

export async function createUser(email: string, password: string, name: string, invite?: string) {
  const e = norm(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error("Adresse e-mail invalide.");
  if (password.length < 8) throw new Error("Le mot de passe doit faire au moins 8 caractères.");
  if (await getUser(e)) throw new Error("Un compte existe déjà avec cet e-mail.");

  const first = (await userCount()) === 0;
  if (!first && process.env.OPEN_SIGNUP !== "1") {
    if (!invite) throw new Error("Il faut un code d'invitation pour créer un compte.");
    const ok = await kv<string | null>("GET", `invite:${invite.trim()}`);
    if (!ok) throw new Error("Code d'invitation invalide ou expiré.");
    await kv("DEL", `invite:${invite.trim()}`);
  }
  const { hash, salt } = await hashPassword(password);
  const user: User = { id: randomId(9), email: e, name: name.trim(), hash, salt, role: first ? "admin" : "user", createdAt: new Date().toISOString() };
  await kvSetJSON(`user:${e}`, user);
  await kv("INCR", "users:count");
  await kv("SADD", "users:all", e);
  return user;
}

export async function checkLogin(email: string, password: string) {
  const u = await getUser(email);
  if (!u) return null;
  const { hash } = await hashPassword(password, u.salt);
  return hash === u.hash ? u : null;
}

export async function sessionCookie(u: User) {
  const token = await signSession({ uid: u.id, email: u.email, role: u.role });
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 86400}`;
}

export const clearCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export async function createInvite() {
  const code = randomId(6);
  await kv("SET", `invite:${code}`, "1", "EX", 30 * 86400);
  return code;
}
