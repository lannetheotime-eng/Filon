import "server-only";
// Recherche de dirigeants détenant leur société via une holding, par secteur (code NAF) et zone.
// Source : API publique « Recherche d'entreprises » (annuaire-entreprises.data.gouv.fr), gratuite et sans clé.
import type { HoldingLead, HoldingSearch } from "./holdings-shared";

const API = "https://recherche-entreprises.api.gouv.fr/search";
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(params: Record<string, string>) {
  const q = new URLSearchParams({ ...params, etat_administratif: "A" });
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${API}?${q}`, { cache: "no-store", headers: { Accept: "application/json" } });
    if (res.status === 429) { await wait(1200); continue; }
    if (!res.ok) throw new Error(`Le registre des entreprises ne répond pas (${res.status}). Réessaie dans un instant.`);
    return res.json();
  }
  throw new Error("Le registre des entreprises est saturé : réessaie dans une minute.");
}

// Zone : département (31), code postal (31000) ou nom de commune (Toulouse → code INSEE)
async function zoneParams(zone: string): Promise<Record<string, string>> {
  const z = zone.trim();
  if (!z) return {};
  if (/^(\d{2}|2A|2B|97\d)$/i.test(z)) return { departement: z.toUpperCase() };
  if (/^\d{5}(,\s*\d{5})*$/.test(z)) return { code_postal: z.replace(/\s/g, "") };
  const r = await fetch(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(z)}&fields=code,nom,population&boost=population&limit=1`, { cache: "no-store" });
  const c = (await r.json().catch(() => []))[0];
  if (!c) throw new Error(`Commune introuvable : « ${zone} ». Essaie un département (31) ou un code postal.`);
  return { commune: c.code };
}

const person = (d: any) => titleCase([d.prenoms?.split(/[ ,]/)[0], d.nom].filter(Boolean).join(" "));

function lastFinances(f: any): { year?: string; ca?: number; net?: number } {
  if (!f || typeof f !== "object") return {};
  const year = Object.keys(f).sort().pop();
  if (!year) return {};
  return { year, ca: f[year]?.ca ?? undefined, net: f[year]?.resultat_net ?? undefined };
}

export async function searchHoldings(s: HoldingSearch): Promise<{ leads: HoldingLead[]; scanned: number; total: number; next?: number }> {
  const zp = await zoneParams(s.zone);
  const base: Record<string, string> = { ...zp, per_page: "25" };
  if (s.naf.length) base.activite_principale = s.naf.join(",");
  if (s.effectif) base.tranche_effectif_salarie = s.effectif;
  const pages = Math.max(1, Math.min(4, s.pages || 2));
  const from = Math.max(1, s.from || 1);

  const results: any[] = [];
  let total = 0;
  let lastPage = 1;
  for (let p = from; p < from + pages; p++) {
    const j = await call({ ...base, page: String(p) });
    total = j.total_results || total;
    results.push(...(j.results || []));
    lastPage = j.total_pages || 1;
    if (p >= lastPage) break;
    await wait(180); // l'API accepte environ 7 requêtes par seconde
  }

  // Sociétés dont un dirigeant est une personne morale = détenues ou présidées par une holding
  const rows = results.map((r) => {
    const dir: any[] = r.dirigeants || [];
    const holdings = dir.filter((d) => d.type_dirigeant === "personne morale" && d.siren);
    const people = dir.filter((d) => d.type_dirigeant !== "personne morale").map((d) => ({ name: person(d), role: d.qualite || "" })).filter((x) => x.name);
    return { r, holdings, people };
  });
  const kept = s.holdingOnly ? rows.filter((x) => x.holdings.length) : rows;

  // Qui est derrière la holding : ses propres dirigeants (une requête par holding, en série)
  const cache = new Map<string, { name: string; people: { name: string; role: string }[]; naf?: string; created?: string }>();
  for (const x of kept.slice(0, 40)) {
    for (const h of x.holdings.slice(0, 2)) {
      if (cache.has(h.siren)) continue;
      try {
        const j = await call({ q: h.siren, per_page: "1" });
        const hr = j.results?.[0];
        cache.set(h.siren, {
          name: titleCase(hr?.nom_complet || h.denomination || ""),
          people: (hr?.dirigeants || []).filter((d: any) => d.type_dirigeant !== "personne morale").map((d: any) => ({ name: person(d), role: d.qualite || "" })).filter((p: any) => p.name).slice(0, 3),
          naf: hr?.activite_principale,
          created: hr?.date_creation,
        });
      } catch {
        cache.set(h.siren, { name: titleCase(h.denomination || ""), people: [] });
      }
      await wait(160);
    }
  }

  const leads: HoldingLead[] = kept.map(({ r, holdings, people }) => {
    const fin = lastFinances(r.finances);
    const siege = r.siege || {};
    return {
      siren: r.siren,
      isHolding: /^(64\.20Z|70\.10Z)$/.test(r.activite_principale || ""),
      name: titleCase(r.nom_complet || r.nom_raison_sociale || ""),
      naf: r.activite_principale || siege.activite_principale || "",
      address: siege.adresse || "",
      city: titleCase(siege.libelle_commune || ""),
      cp: siege.code_postal || "",
      lat: siege.latitude ? Number(siege.latitude) : undefined,
      lng: siege.longitude ? Number(siege.longitude) : undefined,
      created: r.date_creation,
      effectif: r.tranche_effectif_salarie || undefined,
      category: r.categorie_entreprise || undefined,
      legal: r.nature_juridique || undefined,
      ca: fin.ca, net: fin.net, finYear: fin.year,
      people,
      holdings: holdings.map((h) => {
        const c = cache.get(h.siren);
        return { siren: h.siren, name: c?.name || titleCase(h.denomination || ""), role: h.qualite || "", owners: c?.people || [], created: c?.created };
      }),
    };
  });
  return { leads, scanned: results.length, total, next: from + pages <= lastPage ? from + pages : undefined };
}

// Exemple fictif, pour la démonstration (aucun appel au registre)
export function demoHoldings(s: HoldingSearch): { leads: HoldingLead[]; scanned: number; total: number } {
  if (s.naf.some((n) => n === "64.20Z" || n === "70.10Z")) {
    const ppl = ["Claire Martin", "Julien Fabre", "Sophie Garcia", "Thomas Roux", "Marie Lefebvre", "Antoine Dupuy", "Laura Bonnet", "Nicolas Sarda", "Paul Esquerré", "Inès Castan"];
    return {
      leads: ppl.map((n, i) => ({
        siren: `8${String(30000000 + i * 4567891).slice(0, 8)}`, isHolding: true, name: `${n.split(" ")[1]} Holding (démo)`, naf: i % 3 ? "64.20Z" : "70.10Z",
        address: `${4 + i * 9} allée ${["Jean Jaurès", "des Demoiselles", "de Brienne", "Frédéric Mistral", "de Barcelone"][i % 5]}, 31000 Toulouse`, city: "Toulouse", cp: "31000",
        created: `${[2004, 2011, 2016, 1999, 2019, 2008, 2013, 2021, 2002, 2015][i]}-06-01`, effectif: i % 4 ? "00" : "01",
        ca: i % 3 ? undefined : [450000, 0, 0, 1200000][i % 4] || undefined, net: i % 3 ? undefined : 120000 + i * 10000, finYear: i % 3 ? undefined : "2024",
        people: [{ name: n, role: "Président" }], holdings: [],
      })),
      scanned: 50, total: 2840,
    };
  }
  const names = ["Pharmacie des Carmes", "Cabinet Dentaire Saint-Cyprien", "Atelier Riquet Architecture", "Garonne Électricité", "Expertise Capitole", "Clinique Vétérinaire du Canal", "Toulouse Menuiserie Bois", "Laboratoire Compans"];
  const owners = ["Claire Martin", "Julien Fabre", "Sophie Garcia", "Thomas Roux", "Marie Lefebvre", "Antoine Dupuy", "Laura Bonnet", "Nicolas Sarda"];
  const leads: HoldingLead[] = names.map((n, i) => ({
    siren: `9${String(10000000 + i * 1234567).slice(0, 8)}`,
    name: `${n} (démo)`,
    naf: ["47.73Z", "86.23Z", "71.11Z", "43.21A", "69.20Z", "75.00Z", "16.23Z", "86.90B"][i],
    address: `${10 + i * 7} rue ${["des Lois", "de Metz", "Riquet", "Bayard", "d'Alsace-Lorraine", "Pargaminières", "du Taur", "Matabiau"][i]}, 31000 Toulouse`,
    city: "Toulouse", cp: "31000",
    created: `${[1998, 2006, 2012, 1991, 2015, 2003, 2009, 2018][i]}-03-01`,
    effectif: ["11", "03", "02", "12", "21", "11", "03", "12"][i],
    category: i % 3 === 0 ? "PME" : "PME",
    ca: [2400000, 880000, 640000, 3100000, 1900000, 1200000, 720000, 2600000][i],
    net: [180000, 95000, 72000, 210000, 160000, 88000, 41000, 230000][i], finYear: "2024",
    people: i % 2 ? [{ name: owners[i], role: "Directeur général" }] : [],
    holdings: [{ siren: `8${String(20000000 + i * 7654321).slice(0, 8)}`, name: `${owners[i].split(" ")[1]} Holding (démo)`, role: "Président", owners: [{ name: owners[i], role: "Président" }], created: `${[2010, 2014, 2016, 2001, 2017, 2008, 2012, 2019][i]}-01-01` }],
  }));
  return { leads, scanned: 50, total: 312 };
}
