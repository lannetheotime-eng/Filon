import "server-only";
import type { Dirigeant } from "./types";

// API publique « Recherche d'entreprises » (data.gouv.fr) : gratuite, sans clé.
const API = "https://recherche-entreprises.api.gouv.fr/search";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());

function overlap(a: string, b: string) {
  const A = new Set(norm(a).split(" ").filter((w) => w.length > 2));
  const B = new Set(norm(b).split(" ").filter((w) => w.length > 2));
  if (!A.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / A.size;
}

export function parseRegistry(json: any, name: string): Dirigeant[] {
  const results: any[] = json?.results || [];
  return results
    .map((r) => {
      const label = [r.nom_complet, r.nom_raison_sociale, ...(r.matching_etablissements || []).map((e: any) => e.nom_commercial || e.enseigne || "")]
        .filter(Boolean)
        .join(" ");
      const people = (r.dirigeants || [])
        .map((d: any) =>
          d.type_dirigeant === "personne morale"
            ? { name: titleCase(d.denomination || ""), role: d.qualite }
            : { name: titleCase([d.prenoms?.split(" ")[0], d.nom].filter(Boolean).join(" ")), role: d.qualite }
        )
        .filter((p: any) => p.name);
      return {
        score: overlap(name, label),
        d: {
          company: titleCase(r.nom_complet || r.nom_raison_sociale || ""),
          siren: r.siren,
          address: r.siege?.adresse || "",
          created: r.date_creation,
          people,
          active: (r.etat_administratif || r.siege?.etat_administratif) !== "C",
        } as Dirigeant,
      };
    })
    .filter((x) => x.d.active)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.d);
}

export async function findDirigeant(name: string, address: string): Promise<Dirigeant[]> {
  const cp = address.match(/\b\d{5}\b/)?.[0];
  const q = new URLSearchParams({ q: name, per_page: "5", page: "1" });
  if (cp) q.set("code_postal", cp);
  const res = await fetch(`${API}?${q}`, { cache: "no-store", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Le registre des entreprises ne répond pas (${res.status}). Réessaie dans un instant.`);
  return parseRegistry(await res.json(), name);
}
