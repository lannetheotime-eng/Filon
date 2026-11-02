import "server-only";
import { parse, type HTMLElement } from "node-html-parser";

// Strates : reconstitue l'histoire visuelle d'une marque à partir des archives web (Wayback Machine)

export type Logo = { src: string; kind: "img" | "svg" | "icon" | "share" };
export type Layer = {
  year: number;
  ts: string; // horodatage Wayback (AAAAMMJJhhmmss) ou "live"
  live?: boolean;
  archiveUrl: string;
  title?: string;
  logo?: Logo;
  icon?: string;
  colors: string[]; // couleurs de marque, de la plus présente à la moins présente
  neutrals: string[];
  fonts: string[];
};
export type Era = { from: number; to: number; layers: Layer[]; rep: Layer };
export type LostColor = { hex: string; from: number; to: number };
export type StratesResult = {
  domain: string;
  since?: number;
  snapshots: number;
  eras: Era[];
  lost: LostColor[];
  logoChanges: number;
};

const UA = "Mozilla/5.0 (compatible; Strates/1.0; +https://thot-studio.fr)";
const MAX_YEARS = 14;

export function cleanDomain(input: string) {
  let s = input.trim().toLowerCase();
  s = s.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  s = s.split(/[/?#]/)[0];
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)) throw new Error("Indiquez un nom de domaine, par exemple thot-studio.fr.");
  return s;
}

async function fetchText(url: string, ms = 12000, max = 1_500_000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store", redirect: "follow", headers: { "User-Agent": UA, Accept: "text/html,text/css,*/*" } });
    if (!r.ok) return null;
    const txt = await r.text();
    return txt.length > max ? txt.slice(0, max) : txt;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    })
  );
  return out;
}

// --- Couleurs -------------------------------------------------------------

type RGB = [number, number, number];
const hex2rgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgb2hex = (c: RGB) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const dist = (a: RGB, b: RGB) => Math.sqrt((a[0] - b[0]) ** 2 * 0.3 + (a[1] - b[1]) ** 2 * 0.59 + (a[2] - b[2]) ** 2 * 0.11) * 1.7;

function hsl([r, g, b]: RGB) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  const d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

function countColors(text: string, weight: number, into: Map<string, number>) {
  for (const m of text.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-z_-])/gi)) {
    let h = m[1].toLowerCase();
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    into.set("#" + h, (into.get("#" + h) || 0) + weight);
  }
  for (const m of text.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+([\d.]+%?))?\s*\)/gi)) {
    const a = m[4] ? parseFloat(m[4]) / (m[4].endsWith("%") ? 100 : 1) : 1;
    if (a < 0.5) continue;
    const h = rgb2hex([+m[1], +m[2], +m[3]]);
    into.set(h, (into.get(h) || 0) + weight);
  }
}

// Regroupe les teintes proches et sépare couleurs de marque et neutres
function rankColors(counts: Map<string, number>) {
  const groups: { rgb: RGB; hex: string; n: number }[] = [];
  for (const [hex, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    const rgb = hex2rgb(hex);
    const g = groups.find((x) => dist(x.rgb, rgb) < 26);
    if (g) g.n += n;
    else groups.push({ rgb, hex, n });
  }
  groups.sort((a, b) => b.n - a.n);
  const colors: string[] = [], neutrals: string[] = [];
  for (const g of groups) {
    const { s, l } = hsl(g.rgb);
    const chroma = s > 0.22 && l > 0.1 && l < 0.93;
    if (chroma) { if (colors.length < 5 && g.n >= 2) colors.push(g.hex); }
    else if (neutrals.length < 3 && g.hex !== "#ffffff" && g.hex !== "#000000") neutrals.push(g.hex);
  }
  return { colors, neutrals };
}

// --- Typographies ---------------------------------------------------------

const GENERIC = /^(inherit|initial|unset|serif|sans-serif|monospace|cursive|fantasy|system-ui|-apple-system|blinkmacsystemfont|ui-sans-serif|ui-serif|ui-monospace|var\(.*|apple color emoji|segoe ui emoji|segoe ui symbol|noto color emoji)$/i;
const ICONFONT = /awesome|icon|glyph|dashicons|eicons|swiper|slick|fontello|ionic|material symbols|wp ?font|star|elementskit|revicons|themify/i;

function countFonts(text: string, weight: number, into: Map<string, number>) {
  for (const m of text.matchAll(/font-family\s*:\s*([^;}{"]+(?:"[^"]*"[^;}{"]*)*)/gi)) {
    const first = m[1].split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "").replace(/\s*!important$/, "")).find((f) => f && !GENERIC.test(f));
    if (!first || ICONFONT.test(first) || first.length > 40) continue;
    const name = first.replace(/\b\w/g, (c) => c.toUpperCase());
    into.set(name, (into.get(name) || 0) + weight);
  }
}

// --- Logo -----------------------------------------------------------------

const BAD = /partner|sponsor|client|footer|payment|paiement|social|facebook|twitter|instagram|linkedin|youtube|pinterest|tripadvisor|google|apple|store|badge|label|certif|award|cb\.|visa|mastercard|paypal|flag|drapeau|avatar|banner|slide/i;

function attr(el: HTMLElement, k: string) {
  return el.getAttribute(k) || "";
}

function ancestry(el: HTMLElement) {
  let s = "", p = el.parentNode as HTMLElement | null, d = 0;
  while (p && d < 5) {
    if (p.tagName) s += ` ${p.tagName} ${attr(p, "class")} ${attr(p, "id")}`;
    p = p.parentNode as HTMLElement | null;
    d++;
  }
  return s.toLowerCase();
}

function findLogo(root: HTMLElement, stem: string): { kind: "img" | "svg"; value: string } | null {
  let best: { score: number; kind: "img" | "svg"; value: string } | null = null;
  const imgs = root.querySelectorAll("img").slice(0, 80);
  imgs.forEach((img, i) => {
    const src = attr(img, "src") || attr(img, "data-src") || attr(img, "data-lazy-src") || (attr(img, "srcset").split(/\s+/)[0] ?? "");
    if (!src || src.startsWith("data:image/gif")) return;
    const own = `${src} ${attr(img, "alt")} ${attr(img, "class")} ${attr(img, "id")}`.toLowerCase();
    const anc = ancestry(img);
    let score = 0;
    if (/logo/.test(src.toLowerCase())) score += 6;
    if (/logo/.test(own)) score += 4;
    if (/logo|brand|navbar-brand|site-title|custom-logo/.test(anc)) score += 4;
    if (/header|nav|masthead|top/.test(anc)) score += 2;
    if (stem && own.includes(stem)) score += 2;
    if (BAD.test(own) || /footer/.test(anc)) score -= 7;
    score -= i * 0.05;
    if (score >= 4 && (!best || score > best.score)) best = { score, kind: "img", value: src };
  });
  for (const svg of root.querySelectorAll("svg").slice(0, 40)) {
    const own = `${attr(svg, "class")} ${attr(svg, "id")} ${attr(svg, "aria-label")}`.toLowerCase();
    const anc = ancestry(svg);
    let score = 0;
    if (/logo/.test(own)) score += 7;
    if (/logo|brand|site-title|custom-logo/.test(anc)) score += 5;
    if (/header|nav/.test(anc)) score += 1;
    if (/icon|burger|menu|search|close|arrow|chevron|social/.test(own + anc.slice(0, 60))) score -= 6;
    const html = svg.toString();
    if (html.length > 90_000 || html.length < 120) continue;
    if (score >= 5 && (!best || score > best.score)) {
      let s = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+="[^"]*"/gi, "");
      if (!/xmlns=/.test(s)) s = s.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
      best = { score, kind: "svg", value: "data:image/svg+xml;base64," + Buffer.from(s).toString("base64") };
    }
  }
  return best;
}

const SKIP_CSS = /bootstrap|font-?awesome|jquery|wp-includes|googleapis|slick|swiper|owl\.|animate|normalize|reset|fancybox|lightbox|magnific|select2|leaflet|cookie|dashicons|block-library|contact-form|revslider|elementor\/assets\/lib/i;

async function readPage(pageUrl: string, ts: string | null, stem: string): Promise<Omit<Layer, "year" | "ts" | "live" | "archiveUrl"> | null> {
  const wrap = (u: string, mode: "id_" | "im_" | "cs_") => (ts ? `https://web.archive.org/web/${ts}${mode}/${u}` : u);
  const html = await fetchText(wrap(pageUrl, "id_"), 15000);
  if (!html || html.length < 300) return null;
  const root = parse(html, { comment: false, blockTextElements: { script: false, noscript: false, style: true, pre: true } });
  const abs = (u: string) => {
    try { return new URL(u, pageUrl).href; } catch { return null; }
  };
  const img = (u: string) => {
    const a = abs(u);
    return a ? (ts ? wrap(a, "im_") : a) : undefined;
  };

  const colorCounts = new Map<string, number>();
  const fontCounts = new Map<string, number>();
  const theme = root.querySelector('meta[name="theme-color"]')?.getAttribute("content");
  if (theme) countColors(theme, 12, colorCounts);
  for (const st of root.querySelectorAll("style")) { countColors(st.text, 1, colorCounts); countFonts(st.text, 1, fontCounts); }
  for (const el of root.querySelectorAll("[style]").slice(0, 400)) { countColors(attr(el, "style"), 2, colorCounts); countFonts(attr(el, "style"), 1, fontCounts); }
  for (const l of root.querySelectorAll('link[href*="fonts.googleapis.com"]')) {
    const href = decodeURIComponent(attr(l, "href"));
    for (const m of href.matchAll(/family=([^:&|]+)/g)) for (const f of m[1].split("|")) fontCounts.set(f.split(":")[0].replace(/\+/g, " "), (fontCounts.get(f.split(":")[0].replace(/\+/g, " ")) || 0) + 3);
  }

  // Feuilles de style du thème (on écarte les bibliothèques connues)
  const sheets = root
    .querySelectorAll('link[rel~="stylesheet"]')
    .map((l) => attr(l, "href"))
    .filter((h) => h && !SKIP_CSS.test(h))
    .map(abs)
    .filter((h): h is string => !!h)
    .slice(0, 3);
  const css = await Promise.all(sheets.map((h) => fetchText(wrap(h, "cs_"), 9000, 800_000)));
  for (const c of css) if (c) { countColors(c, 1, colorCounts); countFonts(c, 1, fontCounts); }

  const found = findLogo(root, stem);
  let logo: Logo | undefined;
  if (found?.kind === "svg") logo = { kind: "svg", src: found.value };
  else if (found) { const s = img(found.value); if (s) logo = { kind: "img", src: s }; }

  const touch = root.querySelector('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]');
  const fav = root.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
  const icon = img(attr(touch || fav || root, "href") || "/favicon.ico");
  if (!logo && touch) { const s = img(attr(touch, "href")); if (s) logo = { kind: "icon", src: s }; }
  if (!logo) {
    const og = root.querySelector('meta[property="og:image"]')?.getAttribute("content");
    const s = og ? img(og) : undefined;
    if (s) logo = { kind: "share", src: s };
  }

  const { colors, neutrals } = rankColors(colorCounts);
  const fonts = [...fontCounts.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f).slice(0, 3);
  const title = root.querySelector("title")?.text.trim().replace(/\s+/g, " ").slice(0, 120);
  return { title, logo, icon, colors, neutrals, fonts };
}

// --- Fouille --------------------------------------------------------------

function logoKey(l?: Logo) {
  if (!l) return "";
  if (l.kind === "svg") return "svg:" + l.src.length;
  const file = l.src.split("/").pop() || "";
  return file.split("?")[0].toLowerCase().replace(/[-_@]?\d+x\d+|[-_@]\dx|[-_]?(scaled|retina|small|large|white|blanc)/g, "").replace(/\.\w+$/, "");
}

function sameEra(a: Layer, b: Layer) {
  const ka = logoKey(a.logo), kb = logoKey(b.logo);
  const logoSame = ka && kb ? ka === kb : true;
  const ca = a.colors[0], cb = b.colors[0];
  const colorSame = ca && cb ? dist(hex2rgb(ca), hex2rgb(cb)) < 60 : true;
  const fontSame = a.fonts[0] && b.fonts[0] ? a.fonts[0] === b.fonts[0] : true;
  if (ka && kb && !logoSame) return false;
  return colorSame || fontSame;
}

export async function excavate(input: string): Promise<StratesResult> {
  const domain = cleanDomain(input);
  const stem = domain.split(".")[0].replace(/-/g, "");
  const cdx = await fetchText(
    `https://web.archive.org/cdx/search/cdx?url=${domain}/&output=json&fl=timestamp,original&filter=statuscode:200&filter=mimetype:text/html&collapse=timestamp:4&limit=60`,
    20000
  );
  let rows: [string, string][] = [];
  try { rows = (JSON.parse(cdx || "[]") as string[][]).slice(1).map((r) => [r[0], r[1]]); } catch { rows = []; }

  // Une capture par an, et au plus MAX_YEARS réparties sur toute la période
  const thisYear = new Date().getFullYear();
  rows = rows.filter((r) => +r[0].slice(0, 4) < thisYear);
  if (rows.length > MAX_YEARS) {
    const step = (rows.length - 1) / (MAX_YEARS - 1);
    rows = Array.from({ length: MAX_YEARS }, (_, i) => rows[Math.round(i * step)]);
  }

  const archived = await pool(rows, 4, async ([ts, original]) => {
    const page = await readPage(original, ts, stem);
    if (!page) return null;
    const layer: Layer = { year: +ts.slice(0, 4), ts, archiveUrl: `https://web.archive.org/web/${ts}/${original}`, ...page };
    return layer;
  });
  const live = await readPage(`https://${domain}/`, null, stem).then((p) => (p ? ({ year: thisYear, ts: "live", live: true, archiveUrl: `https://${domain}/`, ...p } as Layer) : null));

  const layers = [...archived, live].filter((l): l is Layer => !!l && (l.colors.length > 0 || !!l.logo));
  if (!layers.length) throw new Error(rows.length ? "Les archives de ce site sont illisibles pour l'instant. Réessayez dans un moment." : "Aucune archive trouvée pour ce domaine.");

  // Regroupe les années consécutives qui partagent la même identité
  const eras: Era[] = [];
  for (const l of layers) {
    const cur = eras[eras.length - 1];
    if (cur && sameEra(cur.rep, l)) {
      cur.layers.push(l);
      cur.to = l.year;
      if (!cur.rep.logo && l.logo) cur.rep = l;
    } else eras.push({ from: l.year, to: l.year, layers: [l], rep: l });
  }
  // Représentant de chaque ère : la capture la plus riche
  for (const e of eras) e.rep = [...e.layers].sort((a, b) => +(b.logo?.kind === "img" || b.logo?.kind === "svg") - +(a.logo?.kind === "img" || a.logo?.kind === "svg") || b.colors.length - a.colors.length)[0];

  // Couleurs abandonnées : présentes autrefois, absentes de l'identité actuelle
  const latest = layers[layers.length - 1];
  const seen: { rgb: RGB; hex: string; from: number; to: number }[] = [];
  for (const l of layers) for (const c of l.colors.slice(0, 3)) {
    const rgb = hex2rgb(c);
    const s = seen.find((x) => dist(x.rgb, rgb) < 40);
    if (s) s.to = l.year; else seen.push({ rgb, hex: c, from: l.year, to: l.year });
  }
  const lost = seen
    .filter((s) => s.to < latest.year && !latest.colors.some((c) => dist(hex2rgb(c), s.rgb) < 50))
    .sort((a, b) => b.to - b.from - (a.to - a.from))
    .slice(0, 4)
    .map(({ hex, from, to }) => ({ hex, from, to }));

  return {
    domain,
    since: rows[0] ? +rows[0][0].slice(0, 4) : undefined,
    snapshots: layers.length,
    eras: eras.reverse(),
    lost,
    logoChanges: Math.max(0, new Set(eras.map((e) => logoKey(e.rep.logo)).filter(Boolean)).size - 1),
  };
}
