import "server-only";
// Trouve l'e-mail public d'une entreprise sur son site : accueil, page contact, mentions légales.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const BAD = /(sentry|wixpress|example|exemple|domain\.|yourdomain|votredomaine|email\.com|godaddy|schema\.org|w3\.org|placeholder|noreply|no-reply|ne-pas-repondre|\.png|\.jpe?g|\.gif|\.webp|\.svg|@2x|@3x|cloudflare|jsdelivr|wordpress\.org|gravatar)/i;

async function get(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", cache: "no-store", headers: { "User-Agent": UA, Accept: "text/html" } });
    if (!r.ok) return { html: "", url };
    return { html: (await r.text()).slice(0, 800_000), url: r.url || url };
  } catch {
    return { html: "", url };
  } finally {
    clearTimeout(t);
  }
}

function emails(html: string) {
  const txt = html
    .replace(/&#0*64;|&#x0*40;|%40/gi, "@").replace(/&#0*46;|&#x0*2e;/gi, ".")
    .replace(/\s*[\[(]\s*(at|arobase)\s*[\])]\s*/gi, "@").replace(/\s*[\[(]\s*(dot|point)\s*[\])]\s*/gi, ".");
  return [...new Set((txt.match(/[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9.-]+\.[a-z]{2,10}/gi) || []).map((e) => e.toLowerCase().replace(/^mailto:/, "")))].filter((e) => !BAD.test(e));
}

export async function findEmail(site: string): Promise<{ email?: string; others: string[]; page?: string }> {
  const start = /^https?:\/\//i.test(site) ? site : `https://${site}`;
  const home = await get(start);
  if (!home.html) return { others: [] };
  const origin = new URL(home.url).origin;
  const host = new URL(home.url).hostname.replace(/^www\./, "");
  const found = new Map<string, string>();
  for (const e of emails(home.html)) found.set(e, home.url);
  if (!found.size) {
    // Pages où l'e-mail se cache le plus souvent
    const links = [...home.html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .filter((m) => /contact|mentions|l[ée]gal|a-propos|about|qui-sommes|cabinet|equipe/i.test(m[1] + " " + m[2]))
      .map((m) => { try { return new URL(m[1], origin).href; } catch { return ""; } })
      .filter((u) => u.startsWith(origin));
    const cand = [...new Set([...links, `${origin}/contact`, `${origin}/contact/`, `${origin}/mentions-legales`, `${origin}/mentions-legales/`])].slice(0, 6);
    const pages = await Promise.all(cand.map(get));
    for (const p of pages) for (const e of emails(p.html)) if (!found.has(e)) found.set(e, p.url);
  }
  const list = [...found.keys()];
  // Priorité à l'adresse du même domaine que le site, puis contact@ / accueil@
  const rank = (e: string) => (e.endsWith(`@${host}`) ? 0 : 2) + (/^(contact|accueil|info|bonjour|hello|cabinet|secretariat)@/.test(e) ? 0 : 1);
  list.sort((a, b) => rank(a) - rank(b));
  return { email: list[0], others: list.slice(1, 4), page: list[0] ? found.get(list[0]) : undefined };
}
