// Types et outils partagés (navigateur et serveur) du test « Cité »

export type IaItem = { rank: number; name: string; why: string; isYou: boolean };
export type IaSource = { title: string; url: string };
export type IaRun = { prompt: string; answer: string; items: IaItem[]; sources: IaSource[]; cited: boolean; rank?: number; error?: string };
export type IaEngine = { id: "gemini" | "chatgpt" | "demo"; label: string; runs: IaRun[] };
export type IaTip = { level: "fort" | "moyen" | "info"; title: string; text: string };
export type IaSite = { url: string; https: boolean; mobile: boolean; schema: boolean; cityInTitle: boolean; title?: string; cms?: string };

export type IaResult = {
  name: string;
  trade: string;
  city: string;
  website?: string;
  at: string;
  engines: IaEngine[];
  asked: number; // nombre de questions posées
  citedIn: number; // nombre de réponses où l'établissement est cité
  score: number; // 0 à 100
  rivals: { name: string; count: number }[];
  domains: { domain: string; count: number }[];
  site?: IaSite;
  tips: IaTip[];
  demo: boolean;
};

// Normalisation pour comparer des noms d'établissements
export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, " ")
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Mots trop courants pour identifier un établissement
const GENERIC = new Set(
  "le la les l de du des d un une et a au aux chez sarl sas eurl sa maison the cafe bar restaurant resto boulangerie patisserie salon coiffure coiffeur institut beaute garage auto plomberie plombier electricite electricien fleuriste boucherie charcuterie cabinet avocat avocats notaire notaires etude atelier boutique studio toulouse paris lyon marseille bordeaux nantes lille".split(" ")
);

export function keyTokens(name: string) {
  const t = norm(name).split(" ").filter((w) => w.length > 1 && !GENERIC.has(w));
  return t.length ? t : norm(name).split(" ").filter((w) => w.length > 2);
}

// L'établissement est-il cité dans ce texte ? Tous ses mots distinctifs doivent y figurer.
export function mentions(text: string, name: string) {
  const hay = ` ${norm(text)} `;
  const keys = keyTokens(name);
  return keys.length > 0 && keys.every((k) => hay.includes(` ${k} `));
}

// Même établissement : les mots distinctifs coïncident dans les deux sens
// (« Boulangerie Martin » ≠ « Maison Martin-Durand »)
export function sameBusiness(a: string, b: string) {
  return mentions(a, b) && mentions(b, a);
}

export const domainOf = (s: string) => {
  try {
    return new URL(s.startsWith("http") ? s : `https://${s}`).hostname.replace(/^www\./, "");
  } catch {
    return s.replace(/^www\./, "").split("/")[0];
  }
};

export function scoreLabel(score: number) {
  if (score >= 67) return { label: "Bien recommandé", tone: "ok" as const };
  if (score >= 34) return { label: "Cité de temps en temps", tone: "mid" as const };
  if (score > 0) return { label: "Rarement cité", tone: "low" as const };
  return { label: "Invisible pour les IA", tone: "none" as const };
}

// Partage du rapport : le résultat tient dans le lien (base64url), sans base de données
export function encodeIa(r: IaResult) {
  const slim = {
    ...r,
    engines: r.engines.map((e) => ({ ...e, runs: e.runs.map((x) => ({ ...x, answer: "", items: x.items.slice(0, 8).map((i) => ({ ...i, why: i.why.slice(0, 90) })), sources: x.sources.slice(0, 5) })) })),
  };
  const json = JSON.stringify(slim);
  const b64 = typeof window === "undefined" ? Buffer.from(json, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeIa(s: string): IaResult | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof window === "undefined" ? Buffer.from(b64, "base64").toString("utf8") : decodeURIComponent(escape(atob(b64)));
    const r = JSON.parse(json);
    return r && r.engines ? (r as IaResult) : null;
  } catch {
    return null;
  }
}
