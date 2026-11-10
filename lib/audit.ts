import "server-only";
import type { SiteAudit } from "./types";
import { wpVersionFromAssets, phpVersion, phpOutdated, wpTheme, pageBuilder, wpRestRoot, wpRestUrl, latestModified, monthYear } from "./site-signals";

// Plateformes gratuites ou datées : un site fait avec elles est souvent à refaire.
const FREE_BUILDERS = [
  ["jimdo", "Jimdo"], ["e-monsite", "e-monsite"], ["webnode", "Webnode"], ["site123", "SITE123"],
  ["wixsite.com", "Wix gratuit"], ["over-blog", "Over-blog"], ["free.fr", "Free"], ["pagesperso-orange", "Orange"],
  ["sitew.", "SiteW"], ["simplesite", "SimpleSite"], ["1and1-editor", "1&1 Editor"], ["ionos-mywebsite", "IONOS MyWebsite"],
] as const;

// Reconnaît le CMS ou l'outil qui a servi à faire le site
export function detectCms(html: string, url: string, headers?: Headers): { cms?: string; version?: string } {
  const low = html.toLowerCase();
  const h = (k: string) => headers?.get(k)?.toLowerCase() || "";
  const gen = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i)?.[1] || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']generator["']/i)?.[1] || "";
  // Version : balise « generator », sinon les fichiers du cœur (souvent laissés visibles quand la balise est masquée)
  const wpVer = gen.match(/WordPress\s+(\d+\.\d+(?:\.\d+)?)/i)?.[1] || wpVersionFromAssets(html);
  if (/wordpress/i.test(gen) || low.includes("/wp-content/") || low.includes("/wp-includes/") || h("link").includes("api.w.org"))
    return { cms: url.includes("wordpress.com") || low.includes("s0.wp.com") ? "WordPress.com" : "WordPress", version: wpVer };
  const rules: [boolean, string][] = [
    [low.includes("static.wixstatic.com") || low.includes("wix.com website builder") || !!h("x-wix-request-id"), "Wix"],
    [low.includes("cdn.shopify.com") || !!h("x-shopify-stage"), "Shopify"],
    [low.includes("squarespace") || h("server").includes("squarespace"), "Squarespace"],
    [low.includes("webflow.com") || /data-wf-(page|site)/.test(low), "Webflow"],
    [low.includes("jimdo"), "Jimdo"],
    [low.includes("e-monsite"), "e-monsite"],
    [low.includes("webnode"), "Webnode"],
    [/joomla/i.test(gen) || low.includes("/media/jui/") || low.includes("/components/com_"), "Joomla"],
    [/drupal/i.test(gen) || low.includes("drupal-settings-json") || low.includes("/sites/default/files/"), "Drupal"],
    [/prestashop/i.test(gen) || low.includes("prestashop"), "PrestaShop"],
    [low.includes("framerusercontent.com") || /framer/i.test(gen), "Framer"],
    [low.includes("zyrosite") || low.includes("zyro.com"), "Hostinger"],
    [low.includes("site123"), "SITE123"],
    [low.includes("weebly"), "Weebly"],
    [low.includes("godaddy") && low.includes("website builder"), "GoDaddy"],
    [low.includes("img1.wsimg.com"), "GoDaddy"],
    [low.includes("sites.google.com") || url.includes("sites.google.com"), "Google Sites"],
    [low.includes("duda") && low.includes("dmalbum"), "Duda"],
    [low.includes("ionos") && low.includes("mywebsite"), "IONOS"],
  ];
  const hit = rules.find(([ok]) => ok);
  if (hit) return { cms: hit[1] };
  if (gen) return { cms: gen.split(/[\s;]/)[0] };
  return {};
}

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

  const { cms, version: cmsVersion } = detectCms(html, finalUrl, res.headers);
  const isWp = cms === "WordPress";

  // WordPress : date de la dernière modification d'une page ou d'un article, demandée à son API publique.
  // Plus fiable que le © du pied de page, que beaucoup de thèmes mettent à l'année en cours tout seuls.
  const lastUpdate = isWp ? await wpLastUpdate(res.headers.get("link"), finalUrl) : undefined;

  // Année du copyright la plus récente
  const years = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\D{0,20})?((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi)]
    .flatMap((m) => [m[1], m[2]].filter(Boolean).map(Number))
    .filter((y) => y <= year);
  const lastYear = years.length ? Math.max(...years) : null;
  const updYear = lastUpdate ? Number(lastUpdate.slice(0, 4)) : null;
  if (updYear && updYear <= year - 2) {
    issues.push(`Contenu pas modifié depuis ${monthYear(lastUpdate!)}`);
    score += updYear <= year - 6 ? 30 : updYear <= year - 3 ? 20 : 10;
  } else if (!updYear && lastYear && lastYear <= year - 3) {
    issues.push(`Pas mis à jour depuis ${lastYear}`);
    score += lastYear <= year - 6 ? 30 : 20;
  }

  const builder = FREE_BUILDERS.find(([k]) => low.includes(k) || finalUrl.toLowerCase().includes(k));
  if (builder) { issues.push(`Fait avec un outil gratuit (${builder[1]})`); score += 20; }

  // Serveur : une version de PHP qui ne reçoit plus de correctifs de sécurité
  const php = phpVersion(res.headers.get("x-powered-by"));
  if (php && phpOutdated(php)) {
    issues.push(`PHP ${php} sur le serveur, une version qui ne reçoit plus de correctifs de sécurité`);
    score += Number(php.split(".")[0]) < 7 ? 25 : 15;
  }

  const oldTech =
    /jquery[.-]?(?:min[.-])?(1\.[0-9]+|2\.[0-9]+)/i.test(html) ||
    /\.swf["'?]/i.test(html) ||
    /<frameset|<marquee|<font[\s>]/i.test(html);
  if (oldTech) { issues.push("Technologies anciennes"); score += 15; }

  if ((low.match(/<table/g) || []).length >= 5 && !mobile) { issues.push("Mise en page en tableaux (années 2000)"); score += 10; }

  if (isWp && cmsVersion && Number(cmsVersion.split(".")[0]) < 6) {
    issues.push(`WordPress ${cmsVersion}, une version très ancienne (failles de sécurité)`);
    score += Number(cmsVersion.split(".")[0]) < 5 ? 30 : 20;
  }
  const theme = isWp ? wpTheme(html) : undefined;
  const pb = isWp ? pageBuilder(html) : undefined;

  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  if (!title) { issues.push("Pas de titre pour Google"); score += 10; }
  if (!/<meta[^>]+name=["']?description/i.test(html)) { issues.push("Pas de description pour Google"); score += 10; }
  if (ms > 3000) { issues.push(`Lent à charger (${(ms / 1000).toFixed(1).replace(".", ",")} s)`); score += 10; }

  // E-mail de contact public de l'entreprise, s'il est affiché sur le site
  const email = html
    .match(/mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i)?.[1]
    ?.toLowerCase();

  return {
    score: Math.min(100, score), issues, https, mobile, url: finalUrl, email, lastYear: lastYear ?? undefined, cms, cmsVersion,
    lastUpdate, php, theme, builder: pb, ms,
  };
}

// Dernière modification connue d'un site WordPress (pages et articles), ou rien si l'API est fermée
async function wpLastUpdate(link: string | null, pageUrl: string): Promise<string | undefined> {
  const root = wpRestRoot(link, pageUrl);
  const one = async (route: string) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    try {
      const r = await fetch(wpRestUrl(root, route, { per_page: "1", orderby: "modified", order: "desc", _fields: "modified,modified_gmt" }), {
        signal: ctrl.signal, cache: "no-store", headers: { "User-Agent": "Mozilla/5.0 (compatible; FilonAudit/1.0)", Accept: "application/json" },
      });
      if (!r.ok || !/json/i.test(r.headers.get("content-type") || "")) return undefined;
      return latestModified(await r.json());
    } catch {
      return undefined;
    } finally {
      clearTimeout(t);
    }
  };
  const dates = (await Promise.all([one("wp/v2/pages"), one("wp/v2/posts")])).filter(Boolean) as string[];
  const last = dates.sort().pop();
  // Une date dans le futur ou avant WordPress : réponse fantaisiste, on l'ignore
  return last && last >= "2004-01-01" && last <= new Date().toISOString().slice(0, 10) ? last : undefined;
}

// Audite plusieurs sites en parallèle, avec une limite de temps globale.
export async function auditMany(urls: string[], deadlineMs = 32_000, concurrency = 12) {
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
