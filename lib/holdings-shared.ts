// Types et référentiels partagés pour la recherche « Dirigeants & holdings »

export type HoldingSearch = { naf: string[]; zone: string; effectif?: string; holdingOnly: boolean; pages?: number; demo?: boolean };

export type HoldingLead = {
  siren: string;
  name: string;
  naf: string;
  address: string;
  city: string;
  cp: string;
  lat?: number;
  lng?: number;
  created?: string;
  effectif?: string;
  category?: string;
  legal?: string;
  ca?: number;
  net?: number;
  finYear?: string;
  people: { name: string; role: string }[];
  holdings: { siren: string; name: string; role: string; owners: { name: string; role: string }[]; created?: string }[];
};

// Secteurs fréquents pour un cabinet de gestion de patrimoine (codes NAF rév. 2)
export const SECTORS: { label: string; naf: string[] }[] = [
  { label: "Professions de santé (médecins, dentistes, kinés)", naf: ["86.21Z", "86.22A", "86.22B", "86.22C", "86.23Z", "86.90E"] },
  { label: "Pharmacies", naf: ["47.73Z"] },
  { label: "Vétérinaires", naf: ["75.00Z"] },
  { label: "Avocats et notaires", naf: ["69.10Z"] },
  { label: "Experts-comptables", naf: ["69.20Z"] },
  { label: "Architectes et bureaux d'études", naf: ["71.11Z", "71.12B"] },
  { label: "Conseil et services aux entreprises", naf: ["70.22Z", "73.11Z", "62.02A"] },
  { label: "Informatique et logiciels", naf: ["62.01Z", "58.29C"] },
  { label: "Bâtiment : électricité, plomberie, chauffage", naf: ["43.21A", "43.22A", "43.22B"] },
  { label: "Bâtiment : maçonnerie, gros œuvre", naf: ["41.20A", "41.20B", "43.99C"] },
  { label: "Immobilier : agences et gestion", naf: ["68.31Z", "68.32A"] },
  { label: "Promotion immobilière", naf: ["41.10A"] },
  { label: "Restauration", naf: ["56.10A", "56.10C", "56.30Z"] },
  { label: "Commerce de gros", naf: ["46.90Z", "46.73A", "46.69B"] },
  { label: "Transport routier", naf: ["49.41A", "49.41B"] },
  { label: "Les holdings elles-mêmes", naf: ["64.20Z", "70.10Z"] },
];

export const NAF_LABEL: Record<string, string> = {
  "86.21Z": "Médecine générale", "86.22A": "Radiodiagnostic", "86.22B": "Chirurgie", "86.22C": "Médecine spécialisée", "86.23Z": "Dentaire", "86.90E": "Rééducation (kiné)", "86.90B": "Laboratoire d'analyses",
  "47.73Z": "Pharmacie", "75.00Z": "Vétérinaire", "69.10Z": "Juridique", "69.20Z": "Comptabilité", "71.11Z": "Architecture", "71.12B": "Ingénierie, études",
  "70.22Z": "Conseil", "73.11Z": "Agence de publicité", "62.02A": "Conseil informatique", "62.01Z": "Programmation informatique", "58.29C": "Édition de logiciels",
  "43.21A": "Électricité", "43.22A": "Plomberie", "43.22B": "Chauffage, clim", "41.20A": "Construction de maisons", "41.20B": "Construction de bâtiments", "43.99C": "Maçonnerie",
  "68.31Z": "Agence immobilière", "68.32A": "Administration d'immeubles", "41.10A": "Promotion immobilière", "56.10A": "Restauration traditionnelle", "56.10C": "Restauration rapide", "56.30Z": "Débit de boissons",
  "46.90Z": "Commerce de gros", "46.73A": "Gros : bois, matériaux", "46.69B": "Gros : fournitures industrielles", "49.41A": "Transport de marchandises", "49.41B": "Transport de proximité",
  "64.20Z": "Holding", "70.10Z": "Siège social / holding animatrice", "16.23Z": "Menuiserie",
};

// Tranches d'effectif salarié INSEE
export const EFFECTIF: { code: string; label: string }[] = [
  { code: "", label: "Toutes tailles" },
  { code: "01,02,03", label: "1 à 9 salariés" },
  { code: "11,12", label: "10 à 49 salariés" },
  { code: "21,22", label: "50 à 199 salariés" },
  { code: "31,32,41,42,51,52,53", label: "200 salariés et plus" },
];
export const EFFECTIF_LABEL: Record<string, string> = { "00": "0 salarié", "01": "1-2", "02": "3-5", "03": "6-9", "11": "10-19", "12": "20-49", "21": "50-99", "22": "100-199", "31": "200-249", "32": "250-499", "41": "500-999", "42": "1000-1999", "51": "2000-4999", "52": "5000-9999", "53": "10000+" };

// Ce qui rend ce dirigeant intéressant pour un conseil patrimonial : uniquement des faits du registre
export function signals(l: HoldingLead) {
  const out: string[] = [];
  if (l.holdings.length) out.push("Détenue via une holding");
  const age = l.created ? new Date().getFullYear() - new Date(l.created).getFullYear() : 0;
  if (age >= 20) out.push(`Créée il y a ${age} ans`);
  if (l.ca != null && l.ca >= 1_000_000) out.push(`CA ${fmtEur(l.ca)}`);
  if (l.net != null && l.net > 0) out.push(`Bénéfice ${fmtEur(l.net)}`);
  return out;
}

export function fmtEur(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${String(Math.round(n / 100_000) / 10).replace(".", ",")} M€`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1000)} k€`;
  return `${n} €`;
}

export function score(l: HoldingLead) {
  let s = l.holdings.length ? 40 : 0;
  const age = l.created ? new Date().getFullYear() - new Date(l.created).getFullYear() : 0;
  s += Math.min(20, age);
  if (l.ca) s += Math.min(25, Math.round(Math.log10(Math.max(1, l.ca)) * 4));
  if (l.net && l.net > 0) s += 15;
  return Math.min(100, s);
}
