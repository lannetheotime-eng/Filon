import "server-only";
// « Cité » : est-ce que les IA recommandent cet établissement ?
// On pose aux IA, avec recherche web, les questions qu'un client poserait, puis on regarde qui est cité.
import { hasKV, kv } from "./kv";
import { auditSite } from "./audit";
import type { IaEngine, IaItem, IaResult, IaRun, IaSite, IaSource, IaTip } from "./ia-shared";
import { domainOf, mentions, norm, sameBusiness } from "./ia-shared";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
// Chaque test = 3 questions par IA. 50 tests par jour × 3 = 150 recherches, soit ~4 500 par mois.
const DAILY_CAP = Number(process.env.IA_DAILY_CAP || 50);

export const iaEngines = () => [GEMINI_KEY && "gemini", OPENAI_KEY && "chatgpt"].filter(Boolean) as ("gemini" | "chatgpt")[];

const FORMAT = "Réponds uniquement par une liste numérotée, un établissement par ligne, au format « 1. Nom exact de l'établissement — une phrase ». Pas d'introduction ni de conclusion.";

export function prompts(trade: string, city: string) {
  return [
    `Je cherche : ${trade} à ${city}. Lesquels me recommandes-tu ? Donne 5 à 8 établissements précis. ${FORMAT}`,
    `Quels sont les meilleurs établissements pour « ${trade} » à ${city} selon les avis des clients ? ${FORMAT}`,
    `${trade.charAt(0).toUpperCase() + trade.slice(1)} à ${city} : où aller ? J'aimerais des adresses concrètes. ${FORMAT}`,
  ];
}

// Lecture de la liste numérotée renvoyée par l'IA
export function parseItems(answer: string, you: string): IaItem[] {
  const items: IaItem[] = [];
  for (const raw of answer.split("\n")) {
    const line = raw.replace(/\*\*/g, "").replace(/\[(\d+(, ?\d+)*)\]/g, "").trim();
    const m = line.match(/^(?:[-•*]\s*)?(\d{1,2})[.)]\s+(.+)$/);
    if (!m) continue;
    const rest = m[2];
    const cut = rest.search(/\s[—–-]\s|\s?:\s/);
    const name = (cut > 0 ? rest.slice(0, cut) : rest).replace(/[«»"]/g, "").trim().slice(0, 80);
    const why = cut > 0 ? rest.slice(cut).replace(/^\s?[—–:-]\s*/, "").trim() : "";
    if (name.length < 2) continue;
    items.push({ rank: Number(m[1]), name, why: why.slice(0, 220), isYou: sameBusiness(name, you) });
  }
  return items.slice(0, 10);
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("L'IA a mis trop de temps à répondre.")), ms))]);
}

async function askGemini(prompt: string): Promise<{ answer: string; sources: IaSource[] }> {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], tools: [{ google_search: {} }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Gemini : erreur ${r.status}`);
  const c = j.candidates?.[0];
  const answer = (c?.content?.parts || []).map((p: any) => p.text || "").join("");
  const sources: IaSource[] = (c?.groundingMetadata?.groundingChunks || [])
    .map((g: any) => g.web)
    .filter(Boolean)
    .map((w: any) => ({ title: w.title || domainOf(w.uri), url: w.uri }));
  return { answer, sources };
}

async function askOpenAI(prompt: string): Promise<{ answer: string; sources: IaSource[] }> {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: OPENAI_MODEL, input: prompt, tools: [{ type: "web_search" }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `ChatGPT : erreur ${r.status}`);
  let answer = "";
  const sources: IaSource[] = [];
  for (const o of j.output || []) {
    if (o.type !== "message") continue;
    for (const c of o.content || []) {
      if (c.type !== "output_text") continue;
      answer += c.text || "";
      for (const a of c.annotations || []) if (a.type === "url_citation" && a.url) sources.push({ title: a.title || domainOf(a.url), url: a.url });
    }
  }
  return { answer: answer || j.output_text || "", sources };
}

async function run(engine: "gemini" | "chatgpt", prompt: string, you: string): Promise<IaRun> {
  try {
    const { answer, sources } = await withTimeout(engine === "gemini" ? askGemini(prompt) : askOpenAI(prompt), 40_000);
    const items = parseItems(answer, you);
    const hit = items.find((i) => i.isYou);
    const uniq = sources.filter((s, i, a) => a.findIndex((x) => domainOf(x.title) === domainOf(s.title)) === i);
    return { prompt, answer, items, sources: uniq.slice(0, 10), cited: !!hit || (!items.length && mentions(answer, you)), rank: hit?.rank };
  } catch (e: any) {
    return { prompt, answer: "", items: [], sources: [], cited: false, error: e.message || "Erreur" };
  }
}

// Le site de l'établissement, vu par une IA : données structurées, ville dans le titre, mobile, HTTPS
async function checkSite(url: string, city: string): Promise<IaSite | undefined> {
  const u = url.startsWith("http") ? url : `https://${url}`;
  try {
    const [audit, html] = await Promise.all([
      auditSite(u).catch(() => null),
      withTimeout(fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (compatible; CiteBot/1.0)" }, redirect: "follow" }).then((r) => r.text()), 12_000).catch(() => ""),
    ]);
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    const schema = /application\/ld\+json/i.test(html) && /"@type"\s*:\s*\[?\s*"(LocalBusiness|Restaurant|Bakery|Store|HairSalon|BeautySalon|AutoRepair|Plumber|Electrician|Florist|LegalService|Attorney|Notary|CafeOrCoffeeShop|BarOrPub|Hotel|LodgingBusiness|HealthAndBeautyBusiness|HomeAndConstructionBusiness|ProfessionalService|FoodEstablishment|ShoppingCenter|ClothingStore|Dentist|MedicalBusiness|RealEstateAgent|SportsActivityLocation)/i.test(html);
    return {
      url: u,
      https: audit ? audit.https : u.startsWith("https"),
      mobile: audit ? audit.mobile : /name=["']viewport["']/i.test(html),
      schema,
      cityInTitle: !!title && norm(title).includes(norm(city)),
      title,
      cms: audit?.cms,
    };
  } catch {
    return undefined;
  }
}

// Conseils : seulement à partir de ce que le test a réellement observé
function tips(r: Omit<IaResult, "tips">): IaTip[] {
  const out: IaTip[] = [];
  const top = r.rivals[0];
  if (!r.citedIn) out.push({ level: "fort", title: "Les IA ne vous citent pas", text: `Sur ${r.asked} questions posées comme le ferait un client, ${r.name} n'apparaît dans aucune réponse.${top ? ` ${top.name} est cité ${top.count} fois.` : ""}` });
  else if (r.citedIn < r.asked) out.push({ level: "moyen", title: "Vous êtes cité, mais pas à chaque fois", text: `${r.name} apparaît dans ${r.citedIn} réponse${r.citedIn > 1 ? "s" : ""} sur ${r.asked}.${top && !mentions(top.name, r.name) ? ` ${top.name} est cité ${top.count} fois.` : ""}` });
  else out.push({ level: "info", title: "Les IA vous recommandent", text: `${r.name} apparaît dans toutes les réponses. L'enjeu est de rester en tête de liste.` });

  if (r.domains.length) {
    const d = r.domains.slice(0, 4).map((x) => x.domain).join(", ");
    out.push({ level: "moyen", title: "Soignez les sites que les IA consultent", text: `Pour répondre, les IA se sont appuyées sur : ${d}. Vérifiez que votre fiche y existe, avec le bon nom, les horaires, des photos et des avis récents.` });
  }
  out.push({ level: "moyen", title: "Fiche Google complète et active", text: "Catégorie exacte, horaires à jour, photos récentes, réponses à chaque avis : c'est la source que les IA croisent le plus pour les commerces." });

  if (!r.website) {
    out.push({ level: "fort", title: "Pas de site : les IA ont peu de matière", text: "Sans site, une IA ne peut décrire votre établissement qu'à partir des annuaires. Un site clair, avec votre métier et votre ville, lui donne de quoi vous recommander." });
  } else if (r.site) {
    if (!r.site.schema) out.push({ level: "fort", title: "Ajoutez des données structurées", text: "Votre site ne déclare pas « qui vous êtes » dans un format lisible par les machines (schema.org LocalBusiness : nom, adresse, horaires, téléphone). C'est rapide à ajouter et très utile aux IA." });
    if (!r.site.cityInTitle) out.push({ level: "moyen", title: `Mettez « ${r.trade} à ${r.city} » en avant`, text: `Le titre de votre page d'accueil${r.site.title ? ` (« ${r.site.title.slice(0, 70)} »)` : ""} ne mentionne pas ${r.city}. Les IA associent un établissement à une ville grâce à ces signaux.` });
    if (!r.site.https) out.push({ level: "moyen", title: "Passez le site en HTTPS", text: "Un site non sécurisé inspire moins confiance, aux clients comme aux moteurs." });
    if (!r.site.mobile) out.push({ level: "moyen", title: "Rendez le site lisible sur téléphone", text: "Votre site n'est pas adapté aux mobiles : c'est un signal de qualité négatif." });
    out.push({ level: "info", title: "Une page de questions-réponses", text: `Une page qui répond simplement aux questions de vos clients (horaires, tarifs, spécialités, accès) donne aux IA des phrases toutes faites pour parler de vous.` });
  }
  out.push({ level: "info", title: "Faites parler de vous localement", text: "Articles de presse locale, blogs du quartier, partenaires : les IA citent plus volontiers les établissements mentionnés ailleurs que sur leur propre site." });
  return out;
}

function demoRuns(name: string, trade: string, city: string): IaEngine[] {
  const rivals = ["Maison Durand", "L'Atelier du Centre", "Chez Margaux", "Le Comptoir des Halles", "Atelier Saint-Cyprien", "La Bonne Adresse", "Maison Lafargue"];
  const qs = prompts(trade, city);
  const mk = (seed: number, youAt?: number): IaRun => {
    const names = rivals.slice(seed, seed + 5).concat(rivals.slice(0, Math.max(0, seed + 5 - rivals.length)));
    if (youAt) names.splice(youAt - 1, 0, name);
    const items = names.slice(0, 6).map((n, i) => ({ rank: i + 1, name: n, why: "Très bien noté, souvent recommandé pour son accueil et la qualité de ses produits (démo).", isYou: n === name }));
    return {
      prompt: qs[seed % 3], answer: items.map((i) => `${i.rank}. ${i.name} — ${i.why}`).join("\n"), items,
      sources: [{ title: "pagesjaunes.fr", url: "https://www.pagesjaunes.fr" }, { title: "tripadvisor.fr", url: "https://www.tripadvisor.fr" }, { title: "google.com", url: "https://maps.google.com" }].slice(0, 2 + (seed % 2)),
      cited: !!youAt, rank: youAt,
    };
  };
  return [{ id: "demo", label: "IA de démonstration", runs: [mk(0), mk(1, 4), mk(2)] }];
}

async function allowed() {
  const day = new Date().toISOString().slice(0, 10);
  if (hasKV()) {
    const n = await kv<number>("INCR", `cite:day:${day}`);
    if (n === 1) await kv("EXPIRE", `cite:day:${day}`, 172800);
    return n <= DAILY_CAP;
  }
  const g = globalThis as any;
  g.__citeDay = g.__citeDay?.day === day ? g.__citeDay : { day, n: 0 };
  g.__citeDay.n++;
  return g.__citeDay.n <= DAILY_CAP;
}

export async function citeTest(input: { name: string; trade: string; city: string; website?: string }): Promise<IaResult> {
  const name = input.name.trim().slice(0, 80);
  const trade = input.trade.trim().toLowerCase().slice(0, 60);
  const city = input.city.trim().slice(0, 60);
  const website = input.website?.trim().slice(0, 200) || undefined;
  const engines = iaEngines();
  const demo = !engines.length;
  if (!demo && !(await allowed())) throw new Error("Trop de tests aujourd'hui : réessayez demain.");

  const qs = prompts(trade, city);
  const [list, site] = await Promise.all([
    demo
      ? Promise.resolve(demoRuns(name, trade, city))
      : Promise.all(
          engines.map(async (id) => ({
            id, label: id === "gemini" ? "Gemini (Google)" : "ChatGPT (OpenAI)",
            runs: await Promise.all(qs.map((q) => run(id, q, name))),
          }))
        ),
    website ? checkSite(website, city) : Promise.resolve(undefined),
  ]);

  const runs = list.flatMap((e) => e.runs).filter((r) => !r.error);
  if (!runs.length) throw new Error(list.flatMap((e) => e.runs).find((r) => r.error)?.error || "Aucune IA n'a répondu.");
  const citedIn = runs.filter((r) => r.cited).length;
  // Score : présence (70 %) et position moyenne quand cité (30 %)
  const ranks = runs.filter((r) => r.rank).map((r) => r.rank!);
  const pos = ranks.length ? ranks.reduce((s, x) => s + Math.max(0, 1 - (x - 1) / 8), 0) / runs.length : 0;
  const score = Math.round((citedIn / runs.length) * 70 + pos * 30);

  const count = new Map<string, { name: string; count: number }>();
  for (const r of runs) {
    const seen = new Set<string>();
    for (const i of r.items) {
      if (i.isYou) continue;
      const k = norm(i.name);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      count.set(k, { name: i.name, count: (count.get(k)?.count || 0) + 1 });
    }
  }
  const dom = new Map<string, number>();
  for (const r of runs) for (const d of new Set(r.sources.map((s) => domainOf(s.title.includes(".") ? s.title : s.url)))) dom.set(d, (dom.get(d) || 0) + 1);

  const base = {
    name, trade, city, website, at: new Date().toISOString(), engines: list, asked: runs.length, citedIn, score,
    rivals: [...count.values()].sort((a, b) => b.count - a.count).slice(0, 6),
    domains: [...dom.entries()].filter(([d]) => !d.includes("vertexaisearch")).map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    site, demo,
  };
  return { ...base, tips: tips(base) };
}
