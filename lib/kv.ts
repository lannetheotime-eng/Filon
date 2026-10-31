// Accès à Redis (Upstash) par son API REST : aucun paquet nécessaire.
// Variables créées par l'intégration Upstash de Vercel (l'un ou l'autre nom).
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

export const hasKV = () => !!(URL_ && TOKEN);

export async function kv<T = any>(...cmd: (string | number)[]): Promise<T> {
  if (!hasKV()) throw new Error("Base de données non configurée.");
  const res = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd.map(String)),
    cache: "no-store",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`Base de données : ${j.error || res.status}`);
  return j.result as T;
}

export async function kvGetJSON<T>(key: string): Promise<T | null> {
  const v = await kv<string | null>("GET", key);
  return v ? (JSON.parse(v) as T) : null;
}

export async function kvSetJSON(key: string, value: unknown, ttlSeconds?: number) {
  const args: (string | number)[] = ["SET", key, JSON.stringify(value)];
  if (ttlSeconds) args.push("EX", ttlSeconds);
  return kv(...args);
}
