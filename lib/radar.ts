import "server-only";
// Radar des nouvelles entreprises : annonces du BODACC (bulletin officiel des annonces civiles et commerciales).
// API ouverte de la DILA (Opendatasoft), gratuite et sans clé.
import type { RadarItem, RadarKind, RadarQuery, RadarResult, SectorId } from "./radar-shared";
import { SECTORS, fmtEur, fmtDay } from "./radar-shared";

const API = "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";
const PAGE = 100; // maximum autorisé par l'API

const json = (s: unknown): any => {
  if (typeof s !== "string") return s ?? null;
  try { return JSON.parse(s); } catch { return null; }
};
const one = (x: any) => (Array.isArray(x) ? x[0] : x) || {};
const lit = (s: string) => `"${s.replace(/["\\]/g, " ")}"`;
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

// « ROSSI-LEFEVRE » → « Rossi-Lefevre » ; les sigles courts restent en capitales (SCP, SAS, ADM)
function smartCase(s: string) {
  return squash(s || "").replace(/[\p{L}][\p{L}'’]*/gu, (w) => (w.length > 3 && w === w.toUpperCase() ? w.charAt(0) + w.slice(1).toLowerCase() : w));
}
const person = (prenom?: string, nom?: string) => smartCase([String(prenom || "").split(/[ ,]/)[0], nom].filter(Boolean).join(" "));

// ——— Zone et requête ———
function zoneWhere(zone: string) {
  const parts = zone.split(/[\s,;]+/).map((p) => p.trim().toUpperCase()).filter(Boolean);
  const depts = parts.filter((p) => /^(\d{2}|2A|2B|97\d)$/.test(p));
  const cps = parts.filter((p) => /^\d{5}$/.test(p));
  if (!depts.length && !cps.length) throw new Error("Zone : indique un ou plusieurs départements (31, 82) ou codes postaux (31000).");
  const c: string[] = [];
  if (depts.length) c.push(`numerodepartement in (${depts.map(lit).join(", ")})`);
  if (cps.length) c.push(`cp in (${cps.map(lit).join(", ")})`);
  return `(${c.join(" or ")})`;
}

export function buildWhere(q: RadarQuery) {
  const fam = [...(q.creations ? ["creation", "immatriculation"] : []), ...(q.reprises ? ["vente"] : [])];
  if (!fam.length) throw new Error("Coche au moins « Créations » ou « Rachats ».");
  const since = new Date(Date.now() - Math.max(1, Math.min(365, q.days)) * 864e5).toISOString().slice(0, 10);
  const terms = SECTORS.find((s) => s.id === q.sector)?.terms || [];
  return [
    `familleavis in (${fam.map(lit).join(", ")})`,
    zoneWhere(q.zone),
    `dateparution >= date'${since}'`,
    // Dans l'activité ou le nom de l'entreprise, pas dans tout l'acte : une vente cite souvent l'avocat ou le notaire qui l'a rédigée
    terms.length ? `(${terms.map((t) => `listeetablissements like ${lit(`*${t}*`)} or listepersonnes like ${lit(`*${t}*`)}`).join(" or ")})` : "",
  ].filter(Boolean).join(" and ");
}

// ——— Ce qui n'est pas un prospect ———
const NOT_A_CLIENT_FORM = /civile immobili|participations financi|soci[ée]t[ée] civile de moyens|groupement foncier|civile de construction|civile d'attribution|fonds commun|fiducie|groupement d'int[ée]r[êe]t [ée]conomique/i;
const NOT_A_CLIENT_ACT = /holding|prises? de participations?|(acquisition|d[ée]tention)[^.]{0,140}(immobili|participations|titres|valeurs mobili)|gestion (de|des) (titres|participations|valeurs mobili[èe]res|ses participations)|acquisition[^.]{0,80}(immeubles?|biens? immobiliers?|b[âa]timents?|terrains?|locaux)|location (de |d'|en )?(logements?|meubl[ée]s?|biens|locaux|immeubles?|appartements?)|location meubl[ée]e|loueur en meubl[ée]|marchand de biens|gestion de (son|leur) patrimoine|livraison (de repas|[àa] domicile|de colis)|livreur|coursier|chauffeur vtc|\bvtc\b|transport de personnes|v[ée]hicule de transport avec chauffeur|dropshipping|vente (en ligne|[àa] distance) sur (des |les )?plateformes?/i;
const FRANCHISE = /carrefour|intermarch|franprix|\bspar\b|\bcasino\b|auchan|\blidl\b|leclerc|monoprix|\bpicard\b|mc ?donald|burger king|\bkfc\b|domino'?s|basic.?fit|o'?tacos|subway|five guys|marie blach[èe]re|la mie c[âa]line|\btchip\b|franck provost|jean louis david|camille albane|dessange|optic 2000|afflelou|\bkrys\b|g[ée]n[ée]rale d'optique|century 21|\borpi\b|lafor[êe]t|st[ée]phane plaza|guy hoquet|era immobilier|\bfnac\b|biocoop|naturalia/i;

// ——— Secteur, métier Filon le plus proche, étiquette ———
type Rule = [RegExp, SectorId | "autre", string, string];
const RULES: Rule[] = [
  [/avocat/i, "juridique", "avocat", "Cabinet d'avocats"],
  [/notair|notarial/i, "juridique", "notaire", "Office notarial"],
  [/commissaire de justice|huissier/i, "juridique", "entreprise", "Commissaire de justice"],
  [/mandataire judiciaire|administrateur judiciaire|juriste|conseil juridique/i, "juridique", "entreprise", "Droit"],
  [/expert[- ]comptable|expertise comptable|commissaire aux comptes/i, "liberal", "comptable", "Expertise comptable"],
  [/architect/i, "liberal", "architecte", "Architecte"],
  [/kin[ée]sith[ée]rap|masseur/i, "liberal", "kine", "Kinésithérapie"],
  [/dentaire|dentiste|orthodont/i, "liberal", "dentiste", "Dentaire"],
  [/v[ée]t[ée]rinaire/i, "liberal", "veterinaire", "Vétérinaire"],
  [/m[ée]decin|m[ée]dical|ost[ée]opath|infirmi|psycholog|orthophon|podolog|sage-femme|pharmac|di[ée]t[ée]tic|exercice lib[ée]ral/i, "liberal", "entreprise", "Santé"],
  [/opticien|optique|lunett/i, "commerce", "opticien", "Optique"],
  [/boulang/i, "commerce", "boulangerie", "Boulangerie"],
  [/p[âa]tiss|chocolat/i, "commerce", "patissier", "Pâtisserie"],
  [/boucher|charcut/i, "commerce", "boucherie", "Boucherie"],
  [/traiteur/i, "commerce", "traiteur", "Traiteur"],
  [/restaura|brasserie|pizz|snack|cr[êe]perie|salon de th[ée]|\bbars?\b|caf[ée]|d[ée]bit de boissons|food/i, "commerce", "restaurant", "Restauration"],
  [/barbier|barber/i, "commerce", "barbier", "Barbier"],
  [/coiff/i, "commerce", "coiffeur", "Coiffure"],
  [/esth[ée]ti|beaut[ée]|onglerie|manucur|soins? du visage|[ée]pilation|\bspa\b/i, "commerce", "beaute", "Beauté"],
  [/fleur/i, "commerce", "fleuriste", "Fleuriste"],
  [/tatou/i, "commerce", "tatoueur", "Tatouage"],
  [/\bvins?\b|caviste|spiritueux|\bcave\b/i, "commerce", "caviste", "Cave à vins"],
  [/h[ôo]tel|chambres? d'h[ôo]tes|g[îi]te/i, "commerce", "hotel", "Hébergement"],
  [/toilett(age|eur)/i, "commerce", "toiletteur", "Toilettage"],
  [/garage|r[ée]paration (automobile|de v[ée]hicules)|m[ée]canique (automobile|auto)|carrosserie/i, "artisans", "garage", "Garage"],
  [/plomb|chauffag|sanitaire|climatis/i, "artisans", "plombier", "Plomberie"],
  [/[ée]lectricit[ée] g[ée]n[ée]rale|[ée]lectricien|travaux d'[ée]lectricit[ée]|installation [ée]lectrique/i, "artisans", "electricien", "Électricité"],
  [/menuis|[ée]b[ée]nist/i, "artisans", "menuisier", "Menuiserie"],
  [/ma[çc]onn|gros (œ|oe)uvre/i, "artisans", "macon", "Maçonnerie"],
  [/peinture|pl[âa]tr/i, "artisans", "peintre", "Peinture"],
  [/paysag|espaces verts|jardin/i, "artisans", "paysagiste", "Paysagiste"],
  [/couverture|charpente|toiture|zinguerie|carrelage|serrurerie|r[ée]novation/i, "artisans", "entreprise", "Bâtiment"],
  [/graphis|agence (de )?communication|agence web|d[ée]veloppement (de sites|web)|cr[ée]ation de sites|marketing digital|webdesign/i, "services", "entreprise", "Concurrent (com, web)"],
  [/photograph/i, "services", "photographe", "Photographe"],
  [/auto-[ée]cole|enseignement de la conduite/i, "services", "auto-ecole", "Auto-école"],
  [/salle de sport|fitness|coach(ing)? sporti|remise en forme|yoga|pilates|crossfit/i, "services", "sport", "Sport"],
  [/nettoyage/i, "services", "nettoyage", "Nettoyage"],
  [/d[ée]m[ée]nag/i, "services", "demenageur", "Déménagement"],
  [/[ée]v[ée]nementiel|wedding|organisation de mariages/i, "services", "evenementiel", "Événementiel"],
  [/agence immobili|transactions? (sur )?(immeubles|immobili)|immobili/i, "services", "immobilier", "Immobilier"],
  [/formation/i, "services", "formation", "Formation"],
  [/pr[êe]t-[àa]-porter|v[êe]tements|boutique|commerce de d[ée]tail|[ée]picerie|magasin|concept store|d[ée]coration|librairie|bijou/i, "commerce", "entreprise", "Commerce"],
  [/conseil|consult|courtage|courtier|assurance|recrutement|patrimoine|conciergerie/i, "services", "entreprise", "Conseil et services"],
];

function shortForm(form: string, pp: boolean) {
  if (pp) return "Entrepreneur individuel";
  const f = form.toLowerCase();
  if (/exercice lib[ée]ral [àa] responsabilit[ée] limit[ée]e/.test(f)) return "SELARL";
  if (/exercice lib[ée]ral par actions simplifi[ée]e/.test(f)) return "SELAS";
  if (/exercice lib[ée]ral/.test(f)) return "SEL";
  if (/civile professionnelle/.test(f)) return "SCP";
  if (/par actions simplifi[ée]e (unipersonnelle|[àa] associ[ée] unique)/.test(f)) return "SASU";
  if (/par actions simplifi[ée]e/.test(f)) return "SAS";
  if (/unipersonnelle [àa] responsabilit[ée] limit[ée]e|responsabilit[ée] limit[ée]e \([àa] associ[ée] unique/.test(f)) return "EURL";
  if (/responsabilit[ée] limit[ée]e/.test(f)) return "SARL";
  if (/anonyme/.test(f)) return "SA";
  if (/nom collectif/.test(f)) return "SNC";
  if (/civile/.test(f)) return "Société civile";
  return squash(form).slice(0, 32);
}

function address(a: any) {
  if (!a || typeof a !== "object") return { line: "", cp: "", city: "" };
  const street = squash([a.numeroVoie, a.indiceRepetition, a.typeVoie, a.nomVoie].filter(Boolean).join(" "));
  const cp = String(a.codePostal || "").trim();
  const city = smartCase(String(a.ville || "").trim());
  return { line: squash([street, a.complGeographique, [cp, city].filter(Boolean).join(" ")].filter(Boolean).join(", ")), cp, city };
}

// « Gérant : Bouin, Charlotte, Président : SAS Exemple » → [{ name: "Charlotte Bouin", role: "Gérant" }, …]
export function parseAdministration(s: unknown): { name: string; role?: string }[] {
  if (typeof s !== "string" || !s.trim()) return [];
  const out: { name: string; role?: string }[] = [];
  for (const seg of s.split(/,\s*(?=[\p{L}' -]{3,60}\s:\s)/u)) {
    const m = seg.match(/^\s*([^:]{2,60}?)\s*:\s*(.+)$/);
    if (!m) continue;
    const role = squash(m[1]);
    if (/commissaire aux comptes/i.test(role)) continue;
    let v = squash(m[2]).replace(/\s*nom d'usage\s*:.*$/i, "");
    const parts = v.split(/\s*,\s*/);
    // Personne : « Nom, Prénoms » ; société : un seul bloc
    v = parts.length >= 2 && !/\b(SAS|SARL|SELARL|SELAS|SCP|EURL|SA|holding|soci[ée]t[ée])\b/i.test(parts[0]) ? person(parts[1], parts[0]) : smartCase(v);
    if (v && !out.some((x) => x.name === v)) out.push({ name: v, role });
  }
  return out.slice(0, 4);
}

function priceOf(origine: unknown) {
  const m = String(origine || "").match(/prix[^0-9]{0,30}([\d\s.]+(?:,\d{1,2})?)\s*(?:euros?|€|eur)\b/i);
  if (!m) return undefined;
  const n = Number(m[1].replace(/[\s.]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

type Parsed = { item: RadarItem } | { hidden: string };

export function parseRecord(r: any, today = new Date().toISOString().slice(0, 10)): Parsed {
  const pers = one(json(r.listepersonnes)?.personne);
  const etab = one(json(r.listeetablissements)?.etablissement);
  const acte = json(r.acte) || {};
  const pp = pers.typePersonne === "pp";
  const formLong = String(pers.formeJuridique || "");
  // L'activité déclarée ; à défaut, le début du texte de l'acte (qui cite souvent l'avocat ou le notaire de la vente :
  // on ne s'en sert donc pas pour deviner le secteur)
  const declared = squash(String(etab.activite || pers.activite || ""));
  const activity = declared || squash(String(acte.descriptif || "")).slice(0, 220);
  const cat = JSON.stringify(acte).slice(0, 2000);

  if (NOT_A_CLIENT_FORM.test(formLong)) return { hidden: "forme" };
  if (/sans activit[ée]|n'exerce aucune activit[ée]/i.test(cat) || !activity) return { hidden: "sans activité" };
  if (NOT_A_CLIENT_ACT.test(declared || activity)) return { hidden: "activité" };

  const legalName = pp ? person(pers.prenom, pers.nom) : smartCase(String(pers.denomination || r.commercant || ""));
  const brandRaw = etab.enseigne || etab.nomCommercial || pers.nomCommercial || "";
  const brand = brandRaw ? smartCase(String(brandRaw)) : undefined;
  if (FRANCHISE.test(`${brandRaw} ${pers.denomination || ""}`)) return { hidden: "franchise" };

  const where = address(etab.adresse?.codePostal ? etab.adresse : pers.adresseSiegeSocial || pers.adresse || etab.adresse);
  const siren = String((r.registre || [])[0] || pers.numeroImmatriculation?.numeroIdentification || "").replace(/\s/g, "");
  if (!siren) return { hidden: "sans SIREN" };

  const origine = String(etab.origineFonds || "");
  const fam = r.familleavis as string;
  const kind: RadarKind = fam === "vente" || /achat|location-g[ée]rance|apport/i.test(origine) ? "reprise" : fam === "immatriculation" ? "arrivee" : "creation";
  const price = kind === "reprise" ? priceOf(origine) : undefined;
  const prev = one(json(r.listeprecedentproprietaire)?.personne || json(r.listeprecedentexploitant)?.personne);
  const previous = prev && (prev.denomination || prev.nom) ? (prev.typePersonne === "pp" ? person(prev.prenom, prev.nom) : smartCase(String(prev.denomination))) : undefined;

  const people = pp ? [{ name: legalName, role: "Entrepreneur" }] : parseAdministration(pers.administration);
  const registered = acte.dateImmatriculation ? String(acte.dateImmatriculation).slice(0, 10) : undefined;
  const starts = String(acte.dateCommencementActivite || acte.immatriculation?.dateEffet || "").slice(0, 10) || undefined;
  const capital = Number(String(pers.capital?.montantCapital || "").replace(/\s/g, "").replace(",", ".")) || undefined;

  const text = `${declared} ${legalName} ${brand || ""} ${formLong}`;
  const rule = RULES.find(([re]) => re.test(text));
  const sector = rule?.[1] || "autre";
  const competitor = rule?.[3].startsWith("Concurrent");
  const form = shortForm(formLong, pp);

  // Potentiel pour un studio (identité, site WordPress, print) : métier, solidité, moment
  let score = 25;
  score += { juridique: 35, liberal: 25, commerce: 20, artisans: 12, services: 12, autre: 0 }[sector];
  if (competitor) score -= 25;
  if (!pp) score += 10;
  if ((capital || 0) >= 10_000) score += 5;
  if (brand) score += 5;
  if (kind === "reprise") score += 8;
  if ((price || 0) >= 50_000) score += 7;
  if (starts && starts >= today) score += 10;
  if (registered && (Date.parse(today) - Date.parse(registered)) / 864e5 <= 14) score += 5;
  score = Math.max(0, Math.min(100, score));

  const tags = [
    rule?.[3],
    form,
    starts && starts > today ? `Ouvre le ${fmtDay(starts)}` : undefined,
    kind === "reprise" ? (price ? `Rachat ${fmtEur(price)}` : /location-g[ée]rance/i.test(origine) ? "Location-gérance" : "Rachat") : undefined,
    (capital || 0) >= 10_000 ? `Capital ${fmtEur(capital!)}` : undefined,
  ].filter(Boolean) as string[];

  return {
    item: {
      id: String(r.id), kind, siren, name: brand || legalName, legalName, brand, form, capital,
      activity, address: where.line || [r.cp, r.ville].filter(Boolean).join(" "), cp: where.cp || String(r.cp || ""), city: where.city || smartCase(String(r.ville || "")),
      people, registered, starts, published: String(r.dateparution || "").slice(0, 10), price, previous,
      sector, tradeId: rule?.[2] || "entreprise", score, tags,
      url: r.url_complete || `https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:${encodeURIComponent(r.id)}`,
    },
  };
}

// ——— Lecture du BODACC, avec un petit cache par instance ———
const cache = new Map<string, { at: number; data: RadarResult }>();

export async function radar(q: RadarQuery): Promise<RadarResult> {
  const offset = Math.max(0, Math.min(9900, q.offset || 0));
  const where = buildWhere(q);
  const key = `${where}|${offset}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 15 * 60_000) return hit.data;

  const params = new URLSearchParams({ where, order_by: "dateparution desc", limit: String(PAGE), offset: String(offset) });
  let res: Response;
  try {
    res = await fetch(`${API}?${params}`, { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new Error("Le BODACC ne répond pas pour l'instant. Réessaie dans un moment.");
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Le BODACC a refusé la recherche (${res.status}). ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  const records: any[] = j.results || [];
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set<string>();
  const items: RadarItem[] = [];
  let hidden = 0;
  for (const r of records) {
    const p = parseRecord(r, today);
    if ("hidden" in p) { hidden++; continue; }
    // La recherche plein texte du BODACC ratisse large (une vente cite souvent l'avocat qui l'a rédigée) :
    // on ne garde que les entreprises dont l'activité relève vraiment du secteur demandé
    if (q.sector !== "tout" && p.item.sector !== q.sector) continue;
    if (seen.has(p.item.siren)) continue;
    seen.add(p.item.siren);
    items.push(p.item);
  }
  const total = Number(j.total_count) || 0;
  const data: RadarResult = { items, total, read: records.length, hidden, next: offset + PAGE < total ? offset + PAGE : undefined };
  cache.set(key, { at: Date.now(), data });
  if (cache.size > 200) cache.delete(cache.keys().next().value!);
  return data;
}

// Coordonnées d'une adresse (Géoplateforme de l'IGN, puis l'ancienne API Adresse), sinon le centre de la commune
export async function geocode(addr: string, cp: string): Promise<{ lat: number; lng: number } | null> {
  const q = encodeURIComponent(addr);
  const pc = /^\d{5}$/.test(cp) ? `&postcode=${cp}` : "";
  for (const u of [`https://data.geopf.fr/geocodage/search?q=${q}&limit=1${pc}`, `https://api-adresse.data.gouv.fr/search/?q=${q}&limit=1${pc}`]) {
    try {
      const r = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(5000) });
      if (!r.ok) continue;
      const c = (await r.json()).features?.[0]?.geometry?.coordinates;
      if (Array.isArray(c)) return { lng: c[0], lat: c[1] };
    } catch {}
  }
  if (/^\d{5}$/.test(cp)) {
    try {
      const r = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=centre&format=json`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
      const c = (await r.json())?.[0]?.centre?.coordinates;
      if (Array.isArray(c)) return { lng: c[0], lat: c[1] };
    } catch {}
  }
  return null;
}
