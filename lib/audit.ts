import "server-only";
import type { SiteAudit } from "./types";

// Plateformes gratuites ou datées : un site fait avec elles est souvent à refaire.
const FREE_BUILDERS = [
  ["jimdo", "Jimdo"], ["e-monsite", "e-monsite"], ["webnode", "Webnode"], ["site123", "SITE123"],
  ["wixsite.com", "Wix gratuit"], ["over-blog", "Over-blog"], ["free.fr", "Free"], ["pagesperso-orange", "Orange"],
  ["sitew.", "SiteW"], ["simplesite", "SimpleSite"], ["1and1-editor", "1&1 Editor"], ["ionos-mywebsite", "IONOS MyWebsite"],
] as const;

export async function auditSite(url: string): Promise<SiteAudit> {
  const issues: string[] = [];
  let score = 0;
  const year = new Date().getFullYear();
  const target = /^https?:\/\//i.test(url) ? url : `http://${url}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(target, {
      signal: ctrl.signal,
      redirect: "follow",
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FilonAudit/1.0)", Accept: "text/html" },
    });
  } catch {
    clearTimeout(timer);
    return { score: 45, issues: ["Ne s'est pas affiché lors de l'analyse (à vérifier)"], https: target.startsWith("https"), mobile: false, url };
  }
  const ms = Date.now() - t0;
  const finalUrl = res.url || target;
  const https = finalUrl.startsWith("https://");

  // 401, 403, 429 : le site bloque souvent les robots, on ne peut pas conclure
  if ([401, 403, 429].includes(res.status)) {
    clearTimeout(timer);
    return { score: 0, issues: [], https, mobile: true, url: finalUrl };
  }
  if (res.status >= 400) {
    clearTimeout(timer);
    return { score: 70, issues: [`Le site affiche une erreur (${res.status})`], https, mobile: false, url: finalUrl };
  }

  let html = "";
  try {
    html = (await res.text()).slice(0, 400_000);
  } catch {}
  clearTimeout(timer);
  const low = html.toLowerCase();

  const mobile = /<meta[^>]+name=["']?viewport/i.test(html);
  if (!mobile) { issues.push("Pas adapté aux téléphones"); score += 35; }
  if (!https) { issues.push("Pas de connexion sécurisée (HTTPS)"); score += 20; }

  // Année du copyright la plus récente
  const years = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\D{0,20})?((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi)]
    .flatMap((m) => [m[1], m[2]].filter(Boolean).map(Number));
  const lastYear = years.length ? Math.max(...years) : null;
  if (lastYear && lastYear <= year - 3) {
    issues.push(`Pas mis à jour depuis ${lastYear}`);
    score += lastYear <= year - 6 ? 30 : 20;
  }

  const builder = FREE_BUILDERS.find(([k]) => low.includes(k) || finalUrl.toLowerCase().includes(k));
  if (builder) { issues.push(`Fait avec un outil gratuit (${builder[1]})`); score += 20; }

  const oldTech =
    /jquery[.-]?(?:min[.-])?(1\.[0-9]+|2\.[0-9]+)/i.test(html) ||
    /\.swf["'?]/i.test(html) ||
    /<frameset|<marquee|<font[\s>]/i.test(html);
  if (oldTech) { issues.push("Technologies anciennes"); score += 15; }

  if ((low.match(/<table/g) || []).length >= 5 && !mobile) { issues.push("Mise en page en tableaux (années 2000)"); score += 10; }

  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  if (!title) { issues.push("Pas de titre pour Google"); score += 10; }
  if (!/<meta[^>]+name=["']?description/i.test(html)) { issues.push("Pas de description pour Google"); score += 10; }
  if (ms > 3000) { issues.push(`Lent à charger (${(ms / 1000).toFixed(1).replace(".", ",")} s)`); score += 10; }

  // E-mail de contact public de l'entreprise, s'il est affiché sur le site
  const email = html
    .match(/mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i)?.[1]
    ?.toLowerCase();

  return { score: Math.min(100, score), issues, https, mobile, url: finalUrl, email, lastYear: lastYear ?? undefined };
}

// Audite plusieurs sites en parallèle, avec une limite de temps globale.
export async function auditMany(urls: string[], deadlineMs = 32_000, concurrency = 10) {
  const out = new Map<string, SiteAudit>();
  const start = Date.now();
  let i = 0;
  async function worker() {
    while (i < urls.length && Date.now() - start < deadlineMs) {
      const u = urls[i++];
      out.set(u, await auditSite(u));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return out;
}
