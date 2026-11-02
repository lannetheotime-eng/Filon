import "server-only";
// Audit complet d'un site, à la demande, depuis une fiche.
// Sources gratuites : la page d'accueil, robots.txt, sitemap, certificat SSL, PageSpeed Insights (Google),
// et l'API publique de WordPress.org pour comparer les versions. Aucune sonde intrusive.
import tls from "node:tls";
import { detectCms } from "./audit";
import type { Cat, Check, DeepAudit, Effort, Status } from "./deep-types";
import { CAT_LABEL } from "./deep-types";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 FilonAudit/2.0";
const PSI_KEY = process.env.PAGESPEED_API_KEY || "";

type Ctx = { name: string; city: string; trade: string; phone?: string; rating?: number; reviews?: number; photos?: number; hours?: boolean };

const timeout = <T,>(p: Promise<T>, ms: number, fallback: T) => Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

async function get(url: string, ms = 8000, init: RequestInit = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store", headers: { "User-Agent": UA, Accept: "text/html,*/*", ...(init.headers || {}) } });
  } finally {
    clearTimeout(t);
  }
}

// Date d'expiration du certificat HTTPS
function certExpiry(host: string): Promise<{ days?: number; issuer?: string }> {
  return new Promise((resolve) => {
    try {
      const s = tls.connect({ host, port: 443, servername: host, timeout: 6000 }, () => {
        const c = s.getPeerCertificate();
        s.end();
        if (!c?.valid_to) return resolve({});
        resolve({ days: Math.round((new Date(c.valid_to).getTime() - Date.now()) / 864e5), issuer: (c.issuer as any)?.O });
      });
      s.on("error", () => resolve({}));
      s.on("timeout", () => { s.destroy(); resolve({}); });
    } catch {
      resolve({});
    }
  });
}

async function psi(url: string) {
  const q = new URLSearchParams({ url, strategy: "mobile", locale: "fr" });
  for (const c of ["performance", "seo", "accessibility", "best-practices"]) q.append("category", c);
  if (PSI_KEY) q.set("key", PSI_KEY);
  const r = await get(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, 44_000);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message?.slice(0, 160) || `PageSpeed : erreur ${r.status}`);
  const lh = j.lighthouseResult || {};
  const cat = (k: string) => (lh.categories?.[k]?.score != null ? Math.round(lh.categories[k].score * 100) : undefined);
  const a = lh.audits || {};
  const opps = Object.values(a)
    .filter((x: any) => x?.details?.type === "opportunity" && (x.details.overallSavingsMs || 0) >= 300)
    .sort((x: any, y: any) => (y.details.overallSavingsMs || 0) - (x.details.overallSavingsMs || 0))
    .slice(0, 4)
    .map((x: any) => ({ title: String(x.title), gain: Math.round((x.details.overallSavingsMs || 0) / 100) / 10 }));
  return {
    perf: cat("performance"), seo: cat("seo"), a11y: cat("accessibility"), bp: cat("best-practices"),
    lcp: a["largest-contentful-paint"]?.displayValue, lcpMs: a["largest-contentful-paint"]?.numericValue as number | undefined,
    cls: a["cumulative-layout-shift"]?.displayValue, clsN: a["cumulative-layout-shift"]?.numericValue as number | undefined,
    tbt: a["total-blocking-time"]?.displayValue, fcp: a["first-contentful-paint"]?.displayValue,
    weight: a["total-byte-weight"]?.displayValue, bytes: a["total-byte-weight"]?.numericValue as number | undefined,
    tapTargets: a["target-size"]?.score, contrast: a["color-contrast"]?.score, fontSize: a["font-size"]?.score,
    opps,
  };
}

async function wpLatest(): Promise<string | undefined> {
  try {
    const j = await (await get("https://api.wordpress.org/core/version-check/1.7/", 6000)).json();
    return j.offers?.[0]?.current;
  } catch {
    return undefined;
  }
}

async function pluginLatest(slug: string): Promise<string | undefined> {
  try {
    const j = await (await get(`https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&request[slug]=${encodeURIComponent(slug)}&request[fields][sections]=0`, 6000)).json();
    return j?.version;
  } catch {
    return undefined;
  }
}

const cmpVer = (a: string, b: string) => {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
};

const strip = (s: string) => s.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
const metaContent = (html: string, re: RegExp) => {
  const tag = html.match(new RegExp(`<meta[^>]+(?:name|property)=["'](?:${re.source})["'][^>]*>`, "i"))?.[0];
  return tag ? attr(tag, "content") : undefined;
};

export async function deepAudit(url: string, ctx: Ctx): Promise<DeepAudit> {
  const start = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const checks: Check[] = [];
  const add = (cat: Cat, status: Status, id: string, title: string, why: string, fix: string, effort: Effort, impact: 1 | 2 | 3, found?: string, wp?: string) =>
    checks.push({ id, cat, status, title, why, fix, effort, impact, found, wp });

  // PageSpeed démarre tout de suite (c'est le plus long), en parallèle du reste
  const psiP = timeout(psi(start).then((x) => ({ ok: true as const, x })).catch((e) => ({ ok: false as const, e: e.message as string })), 45_000, { ok: false as const, e: "PageSpeed a mis trop de temps à répondre." });

  // 1. Page d'accueil (et temps de réponse du serveur)
  const t0 = Date.now();
  let res: Response;
  try {
    res = await get(start, 12_000);
  } catch {
    try { res = await get(start.replace(/^https:/, "http:"), 12_000); } catch { throw new Error("Le site ne répond pas : impossible de l'analyser. Vérifie l'adresse ou réessaie plus tard."); }
  }
  const ttfb = Date.now() - t0;
  const finalUrl = res.url || start;
  const u = new URL(finalUrl);
  const origin = u.origin;
  const html = (await res.text().catch(() => "")).slice(0, 1_500_000);
  if (res.status >= 400) throw new Error(`Le site renvoie une erreur ${res.status} : impossible de l'analyser.`);
  const low = html.toLowerCase();
  const text = strip(html);
  const ntext = norm(text);
  const { cms, version: cmsVersion } = detectCms(html, finalUrl, res.headers);
  const isWp = cms === "WordPress";

  // 2. En parallèle : PageSpeed, certificat, robots, sitemap, redirection http → https, WordPress
  const host = u.hostname;
  const pluginSlugs = isWp ? [...new Set([...html.matchAll(/\/wp-content\/plugins\/([a-z0-9-]+)\/[^"'?]*\?ver=([\d.]+)/gi)].map((m) => `${m[1]}@${m[2]}`))] : [];
  const plugins = [...new Map(pluginSlugs.map((x) => { const [slug, version] = x.split("@"); return [slug, { slug, version }]; })).values()].slice(0, 15);
  const [p, cert, robots, sitemap, httpRedirect, latest, pluginsLatest] = await Promise.all([
    psiP,
    u.protocol === "https:" ? certExpiry(host) : Promise.resolve({} as { days?: number; issuer?: string }),
    get(`${origin}/robots.txt`, 6000).then(async (r) => (r.ok ? await r.text() : "")).catch(() => ""),
    (async () => {
      for (const path of ["/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml"]) {
        const r = await get(`${origin}${path}`, 6000).catch(() => null);
        if (r?.ok && /<(urlset|sitemapindex)/i.test((await r.text()).slice(0, 2000))) return path;
      }
      return "";
    })(),
    get(`http://${host}/`, 8000, { redirect: "manual" }).then((r) => ({ status: r.status, to: r.headers.get("location") || "" })).catch(() => null),
    isWp ? wpLatest() : Promise.resolve(undefined),
    Promise.all(plugins.map(async (pl) => ({ ...pl, latest: await pluginLatest(pl.slug) }))),
  ]);
  const ps = p.ok ? p.x : undefined;

  // ——— Vitesse ———
  if (ps?.perf != null) {
    const st: Status = ps.perf >= 90 ? "ok" : ps.perf >= 50 ? "warn" : "fail";
    add("vitesse", st, "perf", `Performance mobile : ${ps.perf}/100`,
      "Google mesure la vitesse sur téléphone et en tient compte dans son classement. Au-delà de 3 secondes d'attente, une grande partie des visiteurs repart.",
      ps.opps.length ? `Priorités relevées par Google : ${ps.opps.map((o) => `${o.title} (gain ≈ ${String(o.gain).replace(".", ",")} s)`).join(" ; ")}.` : "Compresser les images, limiter les scripts et activer la mise en cache.",
      ps.perf >= 50 ? "moyen" : "lourd", 3,
      [ps.lcp && `affichage principal ${ps.lcp}`, ps.tbt && `blocage ${ps.tbt}`, ps.cls && `décalages ${ps.cls}`].filter(Boolean).join(" · "),
      "Extension de cache (WP Rocket, ou LiteSpeed Cache selon l'hébergeur), conversion des images en WebP (Imagify, ShortPixel), et suppression des extensions inutiles.");
  }
  if (ps?.lcpMs != null) {
    const s = ps.lcpMs / 1000;
    add("vitesse", s <= 2.5 ? "ok" : s <= 4 ? "warn" : "fail", "lcp", `Contenu principal affiché en ${String(s.toFixed(1)).replace(".", ",")} s sur mobile`,
      "C'est le temps avant que le visiteur voie vraiment la page. Google recommande moins de 2,5 s.",
      "Alléger l'image ou la vidéo du haut de page (WebP, bonne taille), la précharger, et retirer ce qui bloque l'affichage au-dessus.",
      "moyen", 3, undefined, "Désactiver le chargement différé sur l'image d'en-tête, et précharger la police principale.");
  }
  if (ps?.bytes != null) {
    const mb = ps.bytes / 1048576;
    if (mb > 3) add("vitesse", mb > 6 ? "fail" : "warn", "poids", `Page très lourde : ${String(mb.toFixed(1)).replace(".", ",")} Mo`,
      "Sur une connexion 4G moyenne, chaque Mo se paie en secondes d'attente et en forfait pour le visiteur.",
      "Redimensionner les images à leur taille d'affichage, passer en WebP, retirer les vidéos en lecture automatique et les polices inutiles.", "moyen", 2);
  }
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imgSrcs = imgs.map((t) => attr(t, "src") || attr(t, "data-src") || "").filter(Boolean);
  const oldFmt = imgSrcs.filter((s) => /\.(jpe?g|png|gif|bmp)(\?|$)/i.test(s)).length;
  if (imgSrcs.length >= 4 && oldFmt / imgSrcs.length > 0.6 && !/\.webp|\.avif|image\/webp/i.test(html))
    add("vitesse", "warn", "formats", `Images en anciens formats (${oldFmt} sur ${imgSrcs.length} en JPG/PNG)`,
      "Le WebP pèse 25 à 35 % de moins pour la même qualité : la page s'affiche plus vite.",
      "Convertir les images en WebP et servir automatiquement ce format aux navigateurs compatibles.", "rapide", 2, undefined, "Imagify ou ShortPixel convertissent toute la médiathèque en un clic.");
  if (ttfb > 1500) add("vitesse", ttfb > 3000 ? "fail" : "warn", "ttfb", `Serveur lent à répondre (${String((ttfb / 1000).toFixed(1)).replace(".", ",")} s)`,
    "Avant même d'afficher quoi que ce soit, le serveur fait attendre le visiteur.",
    "Activer un cache de pages, et si ça ne suffit pas, changer pour un hébergement plus performant.", "moyen", 2, undefined, "Cache de pages + hébergeur optimisé WordPress (o2switch, Kinsta, etc.).");
  if (p.ok === false) checks.push({ id: "psi-off", cat: "vitesse", status: "info", title: "Mesure de vitesse Google indisponible", found: p.e, why: "PageSpeed Insights n'a pas pu tester la page cette fois-ci.", fix: "Relancer l'audit dans quelques minutes, ou tester directement sur pagespeed.web.dev.", effort: "rapide", impact: 1 });

  // ——— Téléphone ———
  const vp = html.match(/<meta[^>]+name=["']viewport["'][^>]*>/i)?.[0];
  if (!vp) add("mobile", "fail", "viewport", "Pas adapté aux téléphones",
    "Le site s'affiche en miniature sur téléphone : il faut zoomer pour lire. Google le pénalise, et la majorité des visites se font sur mobile.",
    "Refaire la mise en page en « responsive » : c'est généralement le signe qu'une refonte est nécessaire.", "lourd", 3);
  else if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(vp)) add("mobile", "warn", "zoom", "Le zoom est bloqué sur téléphone",
    "Les personnes qui voient mal ne peuvent pas agrandir le texte : c'est un défaut d'accessibilité.", "Retirer « user-scalable=no » et « maximum-scale=1 » de la balise viewport.", "rapide", 1);
  else add("mobile", "ok", "viewport", "S'adapte aux écrans de téléphone", "Le site prévoit l'affichage mobile.", "Rien à faire.", "rapide", 1);
  if (ps?.tapTargets != null && ps.tapTargets < 1) add("mobile", "warn", "tap", "Boutons et liens trop petits ou trop serrés au doigt",
    "Sur téléphone, on clique à côté : frustrant, surtout pour appeler ou réserver.", "Agrandir les zones cliquables (au moins 48 px) et les espacer.", "rapide", 2);
  if (ps?.fontSize != null && ps.fontSize < 1) add("mobile", "warn", "font", "Texte trop petit sur téléphone",
    "Une partie du texte est illisible sans zoomer.", "Passer le texte courant à 16 px minimum sur mobile.", "rapide", 2);
  if (ps?.contrast != null && ps.contrast < 1) add("mobile", "warn", "contrast", "Texte peu lisible (contraste insuffisant)",
    "Gris clair sur blanc, texte sur photo… une partie des visiteurs, et tout le monde en plein soleil, lit mal.", "Foncer les couleurs de texte concernées ou ajouter un fond.", "rapide", 1);

  // ——— Référencement Google ———
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || "";
  const desc = metaContent(html, /description/)?.trim() || "";
  const cityN = norm(ctx.city), tradeN = norm(ctx.trade);
  if (!title) add("seo", "fail", "title", "Aucun titre de page", "C'est la ligne bleue cliquable dans Google. Sans elle, Google improvise.",
    `Écrire un titre de 50 à 60 caractères : « ${ctx.trade.charAt(0).toUpperCase() + ctx.trade.slice(1)} à ${ctx.city} · ${ctx.name} ».`, "rapide", 3, undefined, "Yoast SEO ou Rank Math › page d'accueil › Titre SEO.");
  else {
    const missing = [!norm(title).includes(cityN) && "la ville", !tradeN.split(" ").some((w) => w.length > 3 && norm(title).includes(w)) && "le métier"].filter(Boolean) as string[];
    const bad = title.length < 25 || title.length > 65 || missing.length;
    add("seo", bad ? "warn" : "ok", "title", bad ? "Titre de page à retravailler" : "Titre de page correct",
      "Le titre est ce que Google affiche en gros et le premier signal pour savoir de quoi parle la page.",
      bad ? `Viser 50 à 60 caractères${missing.length ? `, avec ${missing.join(" et ")}` : ""}. Exemple : « ${ctx.trade.charAt(0).toUpperCase() + ctx.trade.slice(1)} à ${ctx.city} · ${ctx.name} ».` : "Rien à faire.",
      "rapide", 3, `« ${title.slice(0, 90)} » (${title.length} caractères)`, bad ? "Yoast SEO ou Rank Math › page d'accueil › Titre SEO." : undefined);
  }
  if (!desc) add("seo", "fail", "desc", "Pas de description pour Google", "Sans elle, Google affiche un morceau de texte pris au hasard sous le titre : rarement vendeur.",
    `Rédiger 140 à 155 caractères : métier, ville, ce qui vous distingue, et une invitation (« Commandez », « Prenez rendez-vous »).`, "rapide", 2, undefined, "Yoast SEO ou Rank Math › Méta description.");
  else if (desc.length < 70 || desc.length > 165) add("seo", "warn", "desc", "Description Google trop " + (desc.length < 70 ? "courte" : "longue"), "Trop courte, elle ne donne pas envie ; trop longue, elle est coupée.",
    "Viser 140 à 155 caractères, avec la ville et un appel à l'action.", "rapide", 1, `${desc.length} caractères`);
  else add("seo", "ok", "desc", "Description Google présente", "Elle s'affiche sous le titre dans les résultats.", "Rien à faire.", "rapide", 1, `${desc.length} caractères`);
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => strip(m[1]).trim()).filter(Boolean);
  if (!h1s.length) add("seo", "fail", "h1", "Pas de titre principal (H1) sur la page", "Google s'appuie sur ce grand titre pour comprendre le sujet de la page.",
    `Ajouter un seul titre H1 visible qui dit qui vous êtes et où : « ${ctx.trade.charAt(0).toUpperCase() + ctx.trade.slice(1)} à ${ctx.city} ».`, "rapide", 2, undefined, "Dans l'éditeur, passer le titre du haut de page en « Titre 1 » (H1).");
  else if (h1s.length > 1) add("seo", "warn", "h1", `${h1s.length} titres principaux (H1) au lieu d'un seul`, "Plusieurs H1 brouillent le sujet principal de la page.", "Garder un seul H1 et passer les autres en H2.", "rapide", 1, h1s.slice(0, 3).map((h) => `« ${h.slice(0, 40)} »`).join(", "));
  const noAlt = imgs.filter((t) => !/\balt\s*=\s*["'][^"']+["']/i.test(t)).length;
  if (imgs.length && noAlt / imgs.length > 0.3) add("seo", "warn", "alt", `${noAlt} image${noAlt > 1 ? "s" : ""} sur ${imgs.length} sans texte alternatif`,
    "Google ne voit pas les images : il lit leur description. Les malvoyants non plus (lecteurs d'écran).", "Décrire chaque image utile en quelques mots (« Pain au levain de la boulangerie X »).", "rapide", 1, undefined, "Médiathèque › chaque image › champ « Texte alternatif ».");
  const robotsNoindex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
  if (robotsNoindex) add("seo", "fail", "noindex", "La page demande à Google de NE PAS l'afficher", "Une balise « noindex » empêche le site d'apparaître dans Google. Souvent un oubli après la mise en ligne.",
    "Retirer la consigne noindex.", "rapide", 3, undefined, "Réglages › Lecture › décocher « Demander aux moteurs de recherche de ne pas indexer ce site ».");
  if (/disallow:\s*\/\s*$/im.test(robots) && /user-agent:\s*\*/i.test(robots)) add("seo", "fail", "robots", "robots.txt bloque tout le site", "Les moteurs de recherche ont l'interdiction d'explorer le site.", "Corriger le fichier robots.txt (retirer « Disallow: / »).", "rapide", 3);
  add("seo", sitemap ? "ok" : "warn", "sitemap", sitemap ? "Plan du site pour Google présent" : "Pas de plan du site (sitemap) trouvé",
    "Le sitemap liste les pages à Google pour qu'il les trouve toutes et vite.", sitemap ? "Vérifier qu'il est déclaré dans Google Search Console." : "Générer un sitemap.xml et le déclarer dans Google Search Console.",
    "rapide", 1, sitemap || undefined, sitemap ? undefined : "Yoast SEO ou Rank Math le génèrent automatiquement.");
  const lang = html.match(/<html[^>]+lang=["']([^"']+)/i)?.[1];
  if (!lang) add("seo", "warn", "lang", "Langue de la page non déclarée", "Google et les lecteurs d'écran doivent savoir que la page est en français.", "Ajouter lang=\"fr\" sur la balise html.", "rapide", 1);
  if (!/<link[^>]+rel=["']canonical/i.test(html)) add("seo", "warn", "canonical", "Pas d'adresse de référence (canonical)", "Sans elle, Google peut voir plusieurs versions de la même page (avec ou sans www, avec paramètres) et diluer son référencement.", "Déclarer l'URL canonique de chaque page.", "rapide", 1, undefined, "Automatique avec Yoast SEO ou Rank Math.");
  const og = metaContent(html, /og:image/);
  if (!og) add("seo", "warn", "og", "Pas d'image de partage (réseaux, WhatsApp)", "Quand quelqu'un partage le lien, aucun visuel ne s'affiche : le partage passe inaperçu.", "Définir une image de partage (1200 × 630 px) avec titre et description.", "rapide", 1, undefined, "Yoast SEO › Réseaux sociaux › image par défaut.");
  if (ps?.seo != null && ps.seo < 90) add("seo", ps.seo < 70 ? "fail" : "warn", "psi-seo", `Note SEO technique de Google : ${ps.seo}/100`, "Contrôle automatique de Google sur les bases du référencement.", "Corriger les points ci-dessus, puis relancer la mesure.", "rapide", 1);
  const words = text.split(" ").filter((w) => w.length > 2).length;
  if (words < 250) add("seo", "warn", "content", `Très peu de texte sur la page d'accueil (≈ ${words} mots)`, "Google classe des pages qui répondent aux questions des clients. Quelques phrases ne suffisent pas.",
    `Ajouter 300 à 600 mots utiles : prestations, spécialités, zone (${ctx.city} et alentours), questions fréquentes.`, "moyen", 2);

  // ——— Visibilité locale ———
  const schemaBlocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const schemaTypes = [...new Set(schemaBlocks.flatMap((b) => [...b.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((m) => m[1])))];
  const local = schemaTypes.filter((t) => /LocalBusiness|Restaurant|Bakery|Store|Salon|Repair|Plumber|Electrician|Florist|Legal|Attorney|Notary|Cafe|Bar|Hotel|Dentist|Medical|Agent|Contractor|Butcher|Food|Health|Beauty|HomeAndConstruction|Professional/i.test(t));
  add("local", local.length ? "ok" : "fail", "schema", local.length ? `Fiche d'identité structurée présente (${local.join(", ")})` : "Pas de fiche d'identité pour Google et les IA (données structurées)",
    "Ces données disent aux moteurs et aux IA, sans ambiguïté : nom, adresse, téléphone, horaires, zone. Elles aident à apparaître dans les résultats locaux et les réponses de ChatGPT.",
    local.length ? "Vérifier que l'adresse, le téléphone et les horaires y sont, avec l'outil de test des résultats enrichis de Google." : "Ajouter un bloc schema.org LocalBusiness (ou le type exact du métier) avec nom, adresse, téléphone, horaires, coordonnées GPS.",
    "rapide", 3, schemaTypes.length ? `Types trouvés : ${schemaTypes.slice(0, 5).join(", ")}` : undefined, "Rank Math (module Local SEO) ou Yoast Local SEO, ou un bloc JSON-LD dans l'en-tête.");
  const digits = (s: string) => s.replace(/\D/g, "").replace(/^33/, "0");
  const phone = ctx.phone ? digits(ctx.phone) : "";
  const htmlDigits = html.replace(/\D/g, "");
  if (phone) add("local", htmlDigits.includes(phone) || htmlDigits.includes(phone.slice(1)) ? "ok" : "warn", "nap-phone",
    htmlDigits.includes(phone) || htmlDigits.includes(phone.slice(1)) ? "Même téléphone que sur la fiche Google" : "Le téléphone de la fiche Google n'apparaît pas sur la page d'accueil",
    "Google vérifie que les coordonnées sont identiques partout (site, fiche, annuaires) : c'est un signal de confiance pour le référencement local.",
    `Afficher ${ctx.phone} en clair sur la page d'accueil, idéalement dans l'en-tête et le pied de page.`, "rapide", 2);
  add("local", ntext.includes(cityN) ? "ok" : "warn", "nap-city", ntext.includes(cityN) ? `La ville (${ctx.city}) est mentionnée` : `La ville (${ctx.city}) n'apparaît pas dans le texte`,
    "Pour sortir sur « métier + ville », la page doit parler de la ville.", `Mentionner ${ctx.city} (et les quartiers ou communes desservis) dans le texte et le pied de page, avec l'adresse complète.`, "rapide", 2);
  if (!/google\.[a-z.]+\/maps|maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl/i.test(html)) add("local", "info", "map", "Pas de lien vers l'itinéraire Google Maps", "Un bouton « Itinéraire » évite au client de chercher l'adresse.", "Ajouter un lien ou une carte vers la fiche Google.", "rapide", 1);
  if (ctx.photos != null && ctx.photos < 5) add("local", "warn", "gbp-photos", `Seulement ${ctx.photos} photo${ctx.photos > 1 ? "s" : ""} sur la fiche Google`, "Les fiches avec beaucoup de photos récentes reçoivent nettement plus de clics et d'appels.", "Ajouter 10 à 20 photos : façade, intérieur, équipe, produits ou réalisations. En remettre chaque mois.", "rapide", 2);
  if (ctx.reviews != null && ctx.reviews < 20) add("local", "warn", "gbp-reviews", `Peu d'avis Google (${ctx.reviews})`, "Le nombre d'avis pèse dans le classement local et rassure les clients qui comparent.", "Demander un avis à chaque client satisfait : QR code au comptoir, lien dans les factures et les e-mails.", "rapide", 2);
  if (ctx.hours === false) add("local", "warn", "gbp-hours", "Pas d'horaires sur la fiche Google", "Sans horaires, Google affiche moins la fiche et les clients n'osent pas se déplacer.", "Renseigner les horaires (et les horaires exceptionnels des jours fériés).", "rapide", 2);

  // ——— Sécurité et maintenance ———
  const https = u.protocol === "https:";
  add("securite", https ? "ok" : "fail", "https", https ? "Connexion sécurisée (HTTPS)" : "Pas de connexion sécurisée (HTTPS)",
    "Sans HTTPS, les navigateurs affichent « Non sécurisé » à côté de l'adresse, et Google rétrograde le site.", https ? "Rien à faire." : "Installer un certificat SSL gratuit (Let's Encrypt, proposé par presque tous les hébergeurs) et rediriger tout le site en HTTPS.",
    "rapide", 3, undefined, https ? undefined : "Certificat chez l'hébergeur, puis extension Really Simple SSL.");
  if (https && httpRedirect && !(httpRedirect.status >= 300 && httpRedirect.status < 400 && /^https:/i.test(httpRedirect.to)))
    add("securite", "warn", "redirect", "La version http:// ne redirige pas vers https://", "Une partie des visiteurs (vieux liens, saisie manuelle) arrive sur la version non sécurisée.", "Ajouter une redirection permanente (301) de http vers https.", "rapide", 2, `http://${host} → ${httpRedirect.status}`);
  if (cert.days != null) add("securite", cert.days < 0 ? "fail" : cert.days < 15 ? "warn" : "ok", "cert",
    cert.days < 0 ? "Certificat de sécurité expiré" : `Certificat valable encore ${cert.days} jours`,
    "Un certificat expiré affiche une page d'alerte rouge qui fait fuir tous les visiteurs.", cert.days < 15 ? "Renouveler le certificat et activer le renouvellement automatique." : "Vérifier que le renouvellement est automatique.",
    "rapide", cert.days < 15 ? 3 : 1, cert.issuer ? `Émis par ${cert.issuer}` : undefined);
  const mixed = https ? [...html.matchAll(/<(?:img|script|link|iframe|source)\b[^>]+(?:src|href)=["']http:\/\/[^"']+["']/gi)].length : 0;
  if (mixed) add("securite", "warn", "mixed", `${mixed} élément${mixed > 1 ? "s" : ""} chargé${mixed > 1 ? "s" : ""} en http sur une page https`, "Le navigateur peut bloquer ces images ou scripts, ou retirer le cadenas.", "Remplacer les adresses http:// par https:// dans le contenu et le thème.", "rapide", 1, undefined, "Better Search Replace : remplacer http://domaine par https://domaine dans la base.");
  if (isWp) {
    if (cmsVersion && latest) {
      const behind = cmpVer(latest, cmsVersion) > 0;
      const major = Number(latest.split(".")[0]) - Number(cmsVersion.split(".")[0]);
      add("securite", !behind ? "ok" : major >= 1 ? "fail" : "warn", "wp-core", behind ? `WordPress ${cmsVersion}, alors que la version actuelle est ${latest}` : `WordPress à jour (${cmsVersion})`,
        "Les mises à jour corrigent des failles de sécurité connues et exploitées par des robots. Un WordPress en retard est la première cause de piratage.",
        behind ? "Faire une sauvegarde complète, mettre à jour WordPress, puis les extensions et le thème, et vérifier le site." : "Rien à faire : prévoir une maintenance mensuelle pour que ça dure.",
        behind && major >= 1 ? "moyen" : "rapide", 3, undefined, "Tableau de bord › Mises à jour, après une sauvegarde (UpdraftPlus).");
    } else if (cmsVersion && Number(cmsVersion.split(".")[0]) < 6) {
      add("securite", "fail", "wp-core", `WordPress ${cmsVersion}, une version de plusieurs années`, "Les mises à jour corrigent des failles de sécurité connues et exploitées par des robots. Un WordPress en retard est la première cause de piratage.",
        "Faire une sauvegarde complète, mettre à jour WordPress, puis les extensions et le thème, et vérifier le site.", "moyen", 3, undefined, "Tableau de bord › Mises à jour, après une sauvegarde (UpdraftPlus).");
    } else if (!cmsVersion) add("securite", "info", "wp-core", "Version de WordPress masquée", "La version n'est pas affichée publiquement (bonne pratique).", "Vérifier depuis l'administration qu'elle est à jour.", "rapide", 1);
    const old = pluginsLatest.filter((x) => x.version && x.latest && cmpVer(x.latest, x.version) > 0);
    const known = pluginsLatest.filter((x) => x.latest);
    if (pluginsLatest.length && !known.length)
      add("securite", "info", "wp-plugins", `${pluginsLatest.length} extension${pluginsLatest.length > 1 ? "s" : ""} détectée${pluginsLatest.length > 1 ? "s" : ""}, versions non vérifiées`, "WordPress.org n'a pas répondu : impossible de comparer avec les dernières versions.", "Vérifier les mises à jour depuis l'administration du site.", "rapide", 1, pluginsLatest.map((x) => `${x.slug}${x.version ? ` ${x.version}` : ""}`).join(" · "));
    else if (pluginsLatest.length)
      add("securite", old.length >= 3 ? "fail" : old.length ? "warn" : "ok", "wp-plugins",
        old.length ? `${old.length} extension${old.length > 1 ? "s" : ""} en retard de mise à jour` : `${pluginsLatest.length} extension${pluginsLatest.length > 1 ? "s" : ""} visible${pluginsLatest.length > 1 ? "s" : ""}, à jour`,
        "Les extensions non mises à jour sont la porte d'entrée la plus courante des piratages WordPress.",
        old.length ? "Mettre à jour ces extensions après sauvegarde, et supprimer celles qui ne servent plus." : "Rien à faire.",
        "rapide", old.length ? 3 : 1,
        old.length ? old.slice(0, 6).map((x) => `${x.slug} ${x.version} → ${x.latest}`).join(" · ") : undefined, "Extensions › Mises à jour disponibles.");
  }
  const jq = html.match(/jquery[.-]?(?:min[.-])?(1\.\d+(?:\.\d+)?|2\.\d+(?:\.\d+)?)/i)?.[1] || html.match(/jquery(?:\.min)?\.js\?ver=([12]\.\d+(?:\.\d+)?)/i)?.[1];
  if (jq) add("securite", "warn", "jquery", `Bibliothèque jQuery ${jq}, obsolète`, "Une version ancienne contient des failles connues et ralentit la page.", "Mettre à jour le thème ou la bibliothèque.", "moyen", 1);
  const builder = /elementor/i.test(html) ? "Elementor" : /et_pb_|divi/i.test(html) ? "Divi" : /vc_row|wpbakery|js_composer/i.test(html) ? "WPBakery" : /fl-builder/i.test(html) ? "Beaver Builder" : undefined;
  if (builder) add("vitesse", "info", "builder", `Construit avec ${builder}`, "Les constructeurs de pages ajoutent beaucoup de code : souvent une cause de lenteur.", "Activer les optimisations du constructeur (chargement des ressources à la demande) et éviter les modules inutiles.", "moyen", 1);
  const theme = html.match(/\/wp-content\/themes\/([a-z0-9_-]+)\//i)?.[1];
  const year = new Date().getFullYear();
  const years = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\D{0,20})?((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi)].flatMap((m) => [m[1], m[2]].filter(Boolean).map(Number));
  const lastYear = years.length ? Math.max(...years) : undefined;
  if (lastYear && lastYear <= year - 2) add("securite", "warn", "copyright", `Date du pied de page : ${lastYear}`, "Une année ancienne donne l'impression que l'entreprise n'est plus active.", "Afficher l'année en cours automatiquement.", "rapide", 1, undefined, "Shortcode d'année dynamique dans le pied de page du thème.");

  // ——— Obligations légales ———
  const hasMentions = /mentions[\s-]*l[ée]gales|informations[\s-]*l[ée]gales|legal/i.test(low) && /<a\b[^>]*>[^<]*(mentions|l[ée]gal)/i.test(html);
  add("legal", hasMentions ? "ok" : "fail", "mentions", hasMentions ? "Lien vers les mentions légales" : "Pas de lien vers les mentions légales",
    "Obligatoires pour tout site professionnel en France (loi pour la confiance dans l'économie numérique) : identité de l'entreprise, SIRET, hébergeur. L'absence est passible d'amende.",
    hasMentions ? "Vérifier qu'elles sont complètes (raison sociale, SIRET, adresse, directeur de publication, hébergeur)." : "Créer une page « Mentions légales » complète et la relier depuis le pied de page.", "rapide", 2);
  const hasPrivacy = /confidentialit|donn[ée]es personnelles|privacy|rgpd/i.test(low);
  const trackers = [
    /googletagmanager\.com|gtag\(|google-analytics\.com|ga\('create'/i.test(html) && "Google Analytics / Tag Manager",
    /connect\.facebook\.net|fbq\(/i.test(html) && "pixel Facebook",
    /hotjar/i.test(html) && "Hotjar",
    /clarity\.ms/i.test(html) && "Microsoft Clarity",
    /snap\.licdn|linkedin\.com\/insight/i.test(html) && "LinkedIn Insight",
  ].filter(Boolean) as string[];
  const consent = /tarteaucitron|axeptio|cookiebot|complianz|cookieyes|cookie-law-info|didomi|onetrust|borlabs|moove_gdpr|cookie-notice|iubenda|gdpr-cookie|klaro|orejime|cmplz/i.test(html);
  if (trackers.length) add("legal", consent ? "ok" : "fail", "cookies", consent ? "Bandeau de consentement aux cookies présent" : `Traceurs sans bandeau de consentement (${trackers.join(", ")})`,
    "La CNIL impose de demander l'accord avant de déposer des cookies de mesure ou de publicité, avec un bouton « Refuser » aussi visible que « Accepter ». Elle sanctionne régulièrement.",
    consent ? "Vérifier que rien ne se charge avant le choix du visiteur et que « Tout refuser » est au premier niveau." : "Installer un bandeau de consentement conforme et bloquer les traceurs tant que le visiteur n'a pas accepté.",
    "rapide", 2, undefined, consent ? undefined : "Complianz ou CookieYes, configurés en mode « blocage avant consentement ».");
  const hasForm = /<form\b[\s\S]*?(type=["']email["']|<textarea)/i.test(html);
  if (hasForm && !hasPrivacy) add("legal", "warn", "privacy", "Formulaire sans politique de confidentialité", "Dès qu'un site collecte des données (formulaire de contact), le RGPD impose d'expliquer ce qu'on en fait.",
    "Créer une page « Politique de confidentialité » et la relier sous le formulaire.", "rapide", 1, undefined, "Réglages › Confidentialité génère un modèle de page à compléter.");

  // ——— Prise de contact ———
  const tel = /href=["']tel:/i.test(html);
  add("conversion", tel ? "ok" : "fail", "tel", tel ? "Numéro cliquable pour appeler" : "Le numéro de téléphone n'est pas cliquable",
    "Sur téléphone, le client veut appeler en un geste. S'il doit recopier le numéro, beaucoup renoncent.", tel ? "Rien à faire." : "Transformer le numéro en lien « tel: », et ajouter un bouton « Appeler » visible sur mobile.", "rapide", 2);
  const mail = /href=["']mailto:/i.test(html);
  if (!hasForm && !mail) add("conversion", "warn", "contact", "Ni formulaire ni e-mail sur la page d'accueil", "Les clients qui ne veulent pas appeler n'ont aucun moyen simple d'écrire.", "Ajouter un formulaire de contact court (nom, téléphone ou e-mail, message).", "rapide", 2, undefined, "Contact Form 7 ou WPForms Lite.");
  const cta = /(r[ée]server|prendre rendez-vous|rdv|devis|commander|contactez|appelez|nous contacter|demander)/i.test(text.slice(0, 4000));
  add("conversion", cta ? "ok" : "warn", "cta", cta ? "Un appel à l'action en haut de page" : "Pas d'appel à l'action clair en haut de page",
    "En arrivant, le visiteur doit voir tout de suite quoi faire : appeler, réserver, demander un devis.", cta ? "Rien à faire." : "Placer un bouton visible dans le premier écran (« Demander un devis », « Réserver »).", "rapide", 2);
  const social = [/instagram\.com\//i.test(html) && "Instagram", /facebook\.com\//i.test(html) && "Facebook", /linkedin\.com\//i.test(html) && "LinkedIn", /tiktok\.com\//i.test(html) && "TikTok"].filter(Boolean) as string[];
  if (!social.length) add("conversion", "info", "social", "Pas de lien vers les réseaux sociaux", "Les visiteurs aiment vérifier l'activité récente (photos, avis, actualités).", "Relier le compte Instagram ou Facebook s'il est actif.", "rapide", 1);
  if (!/rel=["'](?:shortcut )?icon|apple-touch-icon/i.test(html)) add("conversion", "warn", "favicon", "Pas d'icône de site (favicon)", "Dans les onglets et les favoris, le site apparaît avec une icône vide : peu professionnel.", "Ajouter une icône (logo carré 512 × 512 px).", "rapide", 1, undefined, "Apparence › Personnaliser › Identité du site › Icône du site.");

  // ——— Scores ———
  const W: Record<Status, number> = { ok: 1, warn: 0.5, fail: 0, info: 1 };
  const cats = (Object.keys(CAT_LABEL) as Cat[])
    .map((id) => {
      const list = checks.filter((c) => c.cat === id && c.status !== "info");
      const tot = list.reduce((s, c) => s + c.impact, 0);
      const got = list.reduce((s, c) => s + c.impact * W[c.status], 0);
      return { id, label: CAT_LABEL[id], score: tot ? Math.round((got / tot) * 100) : 100, fails: list.filter((c) => c.status === "fail").length, warns: list.filter((c) => c.status === "warn").length };
    });
  const weights: Record<Cat, number> = { vitesse: 2, mobile: 2, seo: 2, local: 2, securite: 1.5, legal: 1, conversion: 1.5 };
  const health = Math.round(cats.reduce((s, c) => s + c.score * weights[c.id], 0) / cats.reduce((s, c) => s + weights[c.id], 0));

  const failsHeavy = checks.filter((c) => c.status === "fail" && c.effort === "lourd").length;
  const verdict: DeepAudit["verdict"] =
    !vp || failsHeavy || (ps?.perf != null && ps.perf < 30 && !isWp)
      ? { kind: "refonte", text: isWp ? "Les défauts touchent la structure du site (affichage mobile, performances) : une refonte sur WordPress sera plus rentable que des rustines." : `Site ${cms ? `fait avec ${cms}` : "sur une base"} qu'il faudra reconstruire : propose une refonte sur WordPress.` }
      : checks.filter((c) => c.status === "fail").length >= 3 || health < 65
      ? { kind: "optimisation", text: isWp ? "La base est récupérable : un forfait d'optimisation (vitesse, référencement, légal) puis une maintenance mensuelle." : `La base tient, mais tu ne pourras pas intervenir dessus${cms ? ` (${cms})` : ""} : vise le référencement local, la fiche Google et le print, ou une migration WordPress.` }
      : { kind: "maintenance", text: isWp ? "Site en bon état : propose la maintenance mensuelle (mises à jour, sauvegardes, sécurité) et le suivi du référencement local." : "Site en bon état : oriente-toi vers l'identité, le print et la fiche Google." };

  const order: Record<Status, number> = { fail: 0, warn: 1, info: 2, ok: 3 };
  checks.sort((a, b) => order[a.status] - order[b.status] || b.impact - a.impact);
  return {
    url, finalUrl, at: new Date().toISOString(), health, cats, checks, cms, cmsVersion, wpLatest: latest, theme, builder,
    plugins: pluginsLatest.length ? pluginsLatest : undefined,
    psi: ps ? { perf: ps.perf, seo: ps.seo, a11y: ps.a11y, bp: ps.bp, lcp: ps.lcp, cls: ps.cls, tbt: ps.tbt, fcp: ps.fcp, weight: ps.weight } : undefined,
    psiError: p.ok ? undefined : p.e,
    verdict,
  };
}
