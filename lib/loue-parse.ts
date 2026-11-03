// Vendu loué : lecture d'une annonce immobilière (texte libre) pour en sortir
// le statut locatif, le prix, la surface Carrez, le loyer et le bail.
// Partagé entre la page /loue (analyse d'un texte collé) et /api/loue (annonces Melo).

export type Statut = "loue" | "verifier" | "libre" | "viager" | "none";

export type Parsed = {
  titre: string;
  ville: string;
  prix: number | null;
  carrez: number | null;
  surfaceSource: "carrez" | "habitable" | null;
  loyer: number | null;
  finBail: string;
  statut: Statut;
  preuve: string;
};

export const STATUTS: Record<Statut, string> = {
  loue: "Vendu avec locataire",
  verifier: "Peut-être loué, à vérifier",
  libre: "Vendu libre, sans locataire",
  viager: "Viager : occupé par le vendeur",
  none: "Aucun locataire mentionné",
};

export const CLASSES = [
  { k: "A", label: "10 % et plus", color: "#009C6D" },
  { k: "B", label: "8 à 10 %", color: "#52B153" },
  { k: "C", label: "7 à 8 %", color: "#A5CC74", dark: true },
  { k: "D", label: "6 à 7 %", color: "#F4E70F", dark: true },
  { k: "E", label: "5 à 6 %", color: "#F0B40F", dark: true },
  { k: "F", label: "4 à 5 %", color: "#EB8235" },
  { k: "G", label: "moins de 4 %", color: "#D7221F" },
] as const;

export function toNum(s: unknown): number | null {
  if (s == null || s === "") return null;
  if (typeof s === "number") return isFinite(s) ? s : null;
  let t = String(s).replace(/[\s  ]/g, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  t = t.replace(",", ".");
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

export function rentaClass(r: number | null | undefined): string | null {
  if (r == null || !isFinite(r)) return null;
  if (r >= 10) return "A";
  if (r >= 8) return "B";
  if (r >= 7) return "C";
  if (r >= 6) return "D";
  if (r >= 5) return "E";
  if (r >= 4) return "F";
  return "G";
}

function snippet(flat: string, idx: number, len: number) {
  const a = Math.max(0, idx - 30), b = Math.min(flat.length, idx + len + 40);
  return (a > 0 ? "…" : "") + flat.slice(a, b).trim() + (b < flat.length ? "…" : "");
}

export function parseAnnonce(raw: string): Parsed {
  const text = String(raw || "").replace(/\r/g, "");
  const flat = text.replace(/[\s  ]+/g, " ");
  const low = flat.toLowerCase();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const res: Parsed = { titre: "", ville: "", prix: null, carrez: null, surfaceSource: null, loyer: null, finBail: "", statut: "none", preuve: "" };

  res.titre = (lines.find((l) => l.length > 6 && l.length < 140 && !/^\d/.test(l) && !/€/.test(l) && !/^(accueil|ventes immobili|leboncoin)/i.test(l)) || (lines[0] || "").split(/,\s/)[0]).slice(0, 120);

  const v = flat.match(/([A-ZÀ-Ý][A-Za-zÀ-ÿ'’\-]+(?: [A-Za-zÀ-ÿ'’\-]+){0,3}) \(?(\d{5})\)?\b(?!\s*(?:€|euros|k€|m²|m2))/);
  if (v) res.ville = v[1].trim() + " " + v[2];

  type Amount = { n: number; idx: number; len: number; before: string; after: string };
  const amounts: Amount[] = [];
  let m: RegExpExecArray | null;
  const re = /(\d{1,3}(?:[ .]\d{3})+|\d+(?:[.,]\d+)?)\s*(€|euros?\b|eur\b)/gi;
  while ((m = re.exec(flat))) amounts.push({ n: toNum(m[1]) ?? 0, idx: m.index, len: m[0].length, before: "", after: "" });
  const reK = /(\d+(?:[.,]\d+)?)\s*k\s?€/gi;
  while ((m = reK.exec(flat))) amounts.push({ n: (toNum(m[1]) ?? 0) * 1000, idx: m.index, len: m[0].length, before: "", after: "" });
  amounts.sort((a, b) => a.idx - b.idx);
  amounts.forEach((x) => {
    x.before = low.slice(Math.max(0, x.idx - 45), x.idx);
    x.after = low.slice(x.idx + x.len, x.idx + x.len + 30);
  });

  // Loyer
  const rentWord = /(loyer|lou[ée]e?s?\b|locataire|bail|revenus? locatifs?|location)/;
  const cands: { v: number; score: number; idx: number }[] = [];
  for (const x of amounts) {
    const annual = /^\s*(?:hc|cc|charges comprises|hors charges)?\s*(?:\/\s*an\b|par an|annuel|l'an)/.test(x.after) || /annuel/.test(x.before);
    const monthly = /^\s*(?:hc|cc|hors charges|charges comprises|\/\s*mois|par mois|mensuel)/.test(x.after) || /mensuel/.test(x.before);
    const ctx = rentWord.test(x.before.slice(-35));
    if (/(charges? de copro|taxe|honoraires|frais|prix|travaux)/.test(x.before.slice(-25))) continue;
    if (annual && ctx && x.n >= 1200 && x.n <= 200000) cands.push({ v: x.n / 12, score: 3, idx: x.idx });
    else if (!annual && (ctx || monthly) && x.n >= 100 && x.n <= 15000) cands.push({ v: x.n, score: (ctx ? 2 : 0) + (monthly ? 1 : 0), idx: x.idx });
  }
  cands.sort((a, b) => b.score - a.score || a.idx - b.idx);
  if (cands.length) res.loyer = Math.round(cands[0].v);
  const loyerIdx = cands.length ? cands[0].idx : -1;

  // Prix
  const bad = /(taxe|charges|frais|honoraires|loyer|revenu|copro|travaux|m²|m2|par mois|mensuel|annuel)/;
  const big = amounts.filter((x) => x.n >= 15000 && x.idx !== loyerIdx && !/^\s*(?:\/\s*m|le m|par m)/.test(x.after) && !/(annuel|par an|\/\s*an)/.test(x.after.slice(0, 12)));
  const p = big.find((x) => /prix|vente|vendu|propos/.test(x.before.slice(-25))) || big.find((x) => !bad.test(x.before.slice(-25))) || big[0];
  if (p) res.prix = Math.round(p.n);

  // Surface Carrez
  let c = flat.match(/carrez[^0-9]{0,30}(\d+(?:[.,]\d+)?)\s*(?:m²|m2|m\b|mètres)/i)
    || flat.match(/(\d+(?:[.,]\d+)?)\s*(?:m²|m2|m\b|mètres? carrés?)\s*\(?\s*(?:en\s+|selon\s+(?:la\s+)?)?(?:loi\s+)?carrez/i);
  if (c) { res.carrez = toNum(c[1]); res.surfaceSource = "carrez"; }
  else {
    c = flat.match(/surface(?: habitable)?\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:m²|m2|m\b)/i) || flat.match(/\b(\d+(?:[.,]\d+)?)\s*(?:m²|m2)/i);
    if (c) { const n = toNum(c[1]); if (n != null && n >= 9 && n <= 2000) { res.carrez = n; res.surfaceSource = "habitable"; } }
  }

  // Statut locatif
  const strong = [/locataires?\s+en\s+place/i, /vendu\s+lou[ée]e?s?/i, /vendu\s+occup[ée]e?/i, /vente\s+occup[ée]e?/i, /bail\s+en\s+cours/i,
    /actuellement\s+lou[ée]e?s?/i, /lou[ée]e?s?\s+actuellement/i, /(?:est|sont)\s+(?:actuellement\s+)?lou[ée]e?s?/i, /lou[ée]e?s?\s+depuis/i,
    /lou[ée]e?s?\s+(?:à|a|pour)?\s*\d/i, /occup[ée]e?\s+par\s+(?:un|une|des|le|la|son|sa|ses)\s+locataires?/i,
    /avec\s+(?:son|ses|un|une|le|la|les)\s+locataires?/i, /loyer\s+actuel/i, /en\s+cours\s+de\s+location/i,
    /bail\s+(?:commercial|d['’]habitation|meublé|3\s*\/\s*6\s*\/\s*9|de\s+\d)/i, /locataires?\s+(?:depuis|sérieux|fiable|stable|en\s+poste)/i, /(?:enti[èe]rement|int[ée]gralement|tous|toutes)\s+(?:les\s+\w+\s+)?(?:sont\s+)?lou[ée]e?s?/i];
  const weak = [/investissement\s+locatif/i, /id[ée]al\s+investisseurs?/i, /rentabilit[ée]/i, /\bloyer\b/i, /rendement/i, /pour\s+investisseurs?/i, /revenus?\s+locatifs?/i];
  const neg = [/libre\s+de\s+(?:toute\s+occupation|tout\s+locataire|toute\s+location|suite|d['’]occupation)/i, /vendu\s+libre/i,
    /libre\s+(?:à|a)\s+la\s+(?:vente|signature)/i, /libre\s+(?:dès|des)\s+(?:la\s+)?(?:signature|vente)/i, /bien\s+libre/i];
  const hit = (list: RegExp[]) => { for (const r of list) { const mm = flat.match(r); if (mm) return mm; } return null; };
  const s = hit(strong), n = hit(neg), w = hit(weak), vi = flat.match(/viager/i);
  if (vi && !s) { res.loyer = null; res.statut = "viager"; res.preuve = snippet(flat, vi.index!, vi[0].length); }
  else if (s && n) { res.statut = "verifier"; res.preuve = snippet(flat, s.index!, s[0].length); }
  else if (s) { res.statut = "loue"; res.preuve = snippet(flat, s.index!, s[0].length); }
  else if (n) { res.statut = "libre"; res.preuve = snippet(flat, n.index!, n[0].length); }
  else if (w) { res.statut = "verifier"; res.preuve = snippet(flat, w.index!, w[0].length); }

  // Bail
  const b = flat.match(/(fin\s+(?:du\s+|de\s+)?bail|bail[^.;\n]{0,15}?jusqu['’]?\s*(?:au|en|à|a)|bail\s+(?:jusqu['’]?\s*(?:au|en|à|a)|se\s+termin\w*|expir\w*|court\s+jusqu\w*|renouvel\w*)|[ée]ch[ée]ance\s+(?:du\s+)?bail|bail\s+(?:commercial|meublé|3\s*\/\s*6\s*\/\s*9))[^.;!\n]{0,45}/i);
  if (b) res.finBail = b[0].trim().replace(/\s+/g, " ");

  return res;
}

/** Un bien prêt à afficher, quelle que soit sa source (Melo, exemple, saisie). */
export type Bien = {
  id: string;
  titre: string;
  ville: string;
  prix: number | null;
  surface: number | null;
  carrez: boolean;
  loyer: number | null;
  bail: string;
  statut: Statut;
  preuve: string;
  lien: string;
  source: string;
  date?: string;
};

export function chiffres(b: Pick<Bien, "prix" | "surface" | "loyer">) {
  const m2 = b.prix && b.surface ? b.prix / b.surface : null;
  const renta = b.prix && b.loyer ? (b.loyer * 12) / b.prix * 100 : null;
  return { m2, renta, classe: rentaClass(renta) };
}
