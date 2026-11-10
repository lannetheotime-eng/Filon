// Signaux d'ancienneté d'un site, lus dans son code ou ses en-têtes.
// Fonctions pures (sans réseau) : utilisables côté serveur comme dans le navigateur.

// Version de WordPress d'après les fichiers du cœur (?ver=…), quand la balise « generator » est masquée.
// Les feuilles de style de wp-includes et ces trois scripts portent la version de WordPress elle-même.
export function wpVersionFromAssets(html: string): string | undefined {
  const found = [
    ...html.matchAll(/\/wp-includes\/css\/[^"'?\s]+\?ver=(\d+\.\d+(?:\.\d+)?)\b/gi),
    ...html.matchAll(/\/wp-includes\/js\/(?:wp-emoji-release|wp-embed|comment-reply)(?:\.min)?\.js\?ver=(\d+\.\d+(?:\.\d+)?)\b/gi),
  ]
    .map((m) => m[1])
    .filter((v) => { const major = Number(v.split(".")[0]); return major >= 2 && major <= 9; });
  if (!found.length) return undefined;
  // La valeur la plus fréquente : une extension peut forcer sa propre version sur un fichier
  const n = new Map<string, number>();
  for (const v of found) n.set(v, (n.get(v) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || cmpVer(b[0], a[0]))[0][0];
}

export function cmpVer(a: string, b: string) {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

// PHP annoncé par le serveur (« X-Powered-By: PHP/7.4.33 »)
export function phpVersion(poweredBy?: string | null): string | undefined {
  return poweredBy?.match(/PHP\/(\d+\.\d+)/i)?.[1];
}

// Fin des correctifs de sécurité de chaque version de PHP (php.net/supported-versions)
const PHP_EOL: Record<string, string> = {
  "7.4": "2022-11-28", "8.0": "2023-11-26", "8.1": "2025-12-31", "8.2": "2026-12-31", "8.3": "2027-12-31", "8.4": "2028-12-31", "8.5": "2029-12-31",
};
export function phpOutdated(v: string, now = new Date()): boolean {
  const [maj, min] = v.split(".").map(Number);
  if (maj < 7 || (maj === 7 && min < 4)) return true;
  const end = PHP_EOL[`${maj}.${min}`];
  return end ? now.toISOString().slice(0, 10) > end : false;
}

export function wpTheme(html: string): string | undefined {
  const slug = html.match(/\/wp-content\/themes\/([a-z0-9_-]+)\//i)?.[1];
  if (!slug) return undefined;
  const pretty: Record<string, string> = { divi: "Divi", avada: "Avada", astra: "Astra", "hello-elementor": "Hello Elementor", generatepress: "GeneratePress", oceanwp: "OceanWP", enfold: "Enfold", betheme: "BeTheme", salient: "Salient", bridge: "Bridge", "x": "X", "the7": "The7", kadence: "Kadence", blocksy: "Blocksy", neve: "Neve" };
  if (pretty[slug.toLowerCase()]) return pretty[slug.toLowerCase()];
  // Thèmes par défaut de WordPress : twentytwelve → Twenty Twelve
  const tw = slug.match(/^twenty(\w+)$/i);
  if (tw) return `Twenty ${tw[1].charAt(0).toUpperCase()}${tw[1].slice(1)}`;
  return slug;
}

export function pageBuilder(html: string): string | undefined {
  if (/elementor/i.test(html)) return "Elementor";
  if (/et_pb_|\/themes\/divi\//i.test(html)) return "Divi";
  if (/vc_row|wpbakery|js_composer/i.test(html)) return "WPBakery";
  if (/fl-builder/i.test(html)) return "Beaver Builder";
  if (/fusion-builder|fusion-layout/i.test(html)) return "Avada Builder";
  if (/siteorigin-panels|panel-grid/i.test(html)) return "SiteOrigin";
  return undefined;
}

// Racine de l'API WordPress : en-tête « Link: <https://site.fr/wp-json/>; rel="https://api.w.org/" », sinon /wp-json/
export function wpRestRoot(link: string | null | undefined, pageUrl: string): string {
  const fromHeader = link?.match(/<([^>]+)>\s*;\s*rel="https:\/\/api\.w\.org\/"/i)?.[1];
  try {
    return new URL(fromHeader || "/wp-json/", pageUrl).href;
  } catch {
    return fromHeader || "/wp-json/";
  }
}

// Adresse d'une route de l'API, que la racine soit /wp-json/ ou ?rest_route=/
export function wpRestUrl(root: string, route: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  if (/[?&]rest_route=/.test(root)) return `${root.replace(/([?&]rest_route=)\/?[^&]*/, `$1/${route}`)}&${qs}`;
  return `${root.replace(/\/?$/, "/")}${route}?${qs}`;
}

// Plus récente date de modification dans une réponse de l'API (liste d'articles ou de pages)
export function latestModified(json: unknown): string | undefined {
  if (!Array.isArray(json)) return undefined;
  const dates = json.map((x: any) => String(x?.modified_gmt || x?.modified || "")).filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d)).map((d) => d.slice(0, 10));
  return dates.sort().pop();
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export function monthYear(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
}
