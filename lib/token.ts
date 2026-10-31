// Jetons de session signés (HMAC-SHA256), utilisables côté serveur et dans le middleware.
export const SESSION_COOKIE = "filon_session";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

function secret() {
  return (
    process.env.AUTH_SECRET ||
    // Repli : dérivé des secrets déjà présents, pour ne rien ajouter dans Vercel
    `${process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ""}:${process.env.APP_PASSWORD || ""}:filon`
  );
}

const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function key() {
  return crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export type Session = { uid: string; email: string; role: "admin" | "user"; exp: number };

export async function signSession(s: Omit<Session, "exp">) {
  const payload: Session = { ...s, exp: Date.now() + SESSION_DAYS * 864e5 };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = b64url(await crypto.subtle.sign("HMAC", await key(), enc.encode(body)));
  return `${body}.${sig}`;
}

export async function verifySession(token?: string | null): Promise<Session | null> {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), fromB64url(sig), enc.encode(body));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Session;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

// Mot de passe : PBKDF2-SHA256, 120 000 itérations, sel aléatoire
export async function hashPassword(password: string, saltB64?: string) {
  const salt = saltB64 ? fromB64url(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 120_000 }, base, 256);
  return { hash: b64url(bits), salt: b64url(salt) };
}

export function randomId(bytes = 12) {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}
