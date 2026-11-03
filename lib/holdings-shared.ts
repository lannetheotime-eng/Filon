// Types et référentiels partagés pour la recherche « Dirigeants & holdings »

export type HoldingSearch = { name?: string; naf: string[]; zone: string; effectif?: string; holdingOnly: boolean; pages?: number; from?: number; demo?: boolean };

export type HoldingLead = {
  isHolding?: boolean; // la société est elle-même une holding (code NAF 64.20Z ou 70.10Z)
  siren: string;
  name: string;
  brand?: string; // nom commercial ou enseigne
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
  { label: "Toutes les holdings (64.20Z, 70.10Z)", naf: ["64.20Z", "70.10Z"] },
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
  { label: "Design graphique, graphistes (74.10Z)", naf: ["74.10Z"] },
  { label: "Photographes (74.20Z)", naf: ["74.20Z"] },
  { label: "Publicité, agences de communication", naf: ["73.11Z", "73.12Z", "70.21Z"] },
  { label: "Web, hébergement, portails", naf: ["63.11Z", "63.12Z", "62.09Z"] },
  { label: "Coiffure et soins de beauté", naf: ["96.02A", "96.02B"] },
  { label: "Boulangeries, pâtisseries", naf: ["10.71C", "10.71D", "47.24Z"] },
  { label: "Boucheries, commerces alimentaires", naf: ["47.22Z", "47.29Z", "47.25Z"] },
  { label: "Hôtels et hébergement", naf: ["55.10Z", "55.20Z"] },
  { label: "Garages et réparation auto", naf: ["45.20A", "45.20B", "45.11Z"] },
  { label: "Commerce de détail (habillement, déco, sport)", naf: ["47.71Z", "47.59B", "47.64Z", "47.78C"] },
  { label: "Enseignement et formation", naf: ["85.59A", "85.59B", "85.53Z"] },
  { label: "Sport, salles et coachs", naf: ["93.13Z", "93.12Z", "85.51Z"] },
  { label: "Nettoyage et services aux bâtiments", naf: ["81.21Z", "81.22Z", "81.30Z"] },
  { label: "Taxis, VTC, ambulances", naf: ["49.32Z", "86.90A"] },
  { label: "Événementiel et spectacle", naf: ["82.30Z", "90.01Z", "90.02Z"] },
  { label: "Agriculture et viticulture", naf: ["01.21Z", "01.11Z", "11.02B"] },
  { label: "Industrie et fabrication", naf: ["25.62B", "28.99B", "33.12Z"] },
  { label: "Assurances et courtage", naf: ["66.22Z", "65.12Z"] },
  { label: "Activités financières, gestion de patrimoine", naf: ["66.19B", "66.30Z", "64.99Z"] },
  { label: "Autre : tape les codes NAF", naf: [] },
];

export const NAF_LABEL: Record<string, string> = {
  "86.21Z": "Médecine générale", "86.22A": "Radiodiagnostic", "86.22B": "Chirurgie", "86.22C": "Médecine spécialisée", "86.23Z": "Dentaire", "86.90E": "Rééducation (kiné)", "86.90B": "Laboratoire d'analyses",
  "47.73Z": "Pharmacie", "75.00Z": "Vétérinaire", "69.10Z": "Juridique", "69.20Z": "Comptabilité", "71.11Z": "Architecture", "71.12B": "Ingénierie, études",
  "70.22Z": "Conseil", "73.11Z": "Agence de publicité", "62.02A": "Conseil informatique", "62.01Z": "Programmation informatique", "58.29C": "Édition de logiciels",
  "43.21A": "Électricité", "43.22A": "Plomberie", "43.22B": "Chauffage, clim", "41.20A": "Construction de maisons", "41.20B": "Construction de bâtiments", "43.99C": "Maçonnerie",
  "68.31Z": "Agence immobilière", "68.32A": "Administration d'immeubles", "41.10A": "Promotion immobilière", "56.10A": "Restauration traditionnelle", "56.10C": "Restauration rapide", "56.30Z": "Débit de boissons",
  "46.90Z": "Commerce de gros", "46.73A": "Gros : bois, matériaux", "46.69B": "Gros : fournitures industrielles", "49.41A": "Transport de marchandises", "49.41B": "Transport de proximité",
  "74.10Z": "Design graphique", "74.20Z": "Photographie", "73.12Z": "Régie publicitaire", "70.21Z": "Relations publiques", "63.11Z": "Hébergement web", "63.12Z": "Portails internet", "62.09Z": "Services informatiques",
  "96.02A": "Coiffure", "96.02B": "Soins de beauté", "10.71C": "Boulangerie", "10.71D": "Pâtisserie", "47.24Z": "Boulangerie (commerce)", "47.22Z": "Boucherie", "47.29Z": "Alimentation", "47.25Z": "Boissons, caviste",
  "55.10Z": "Hôtel", "55.20Z": "Hébergement touristique", "45.20A": "Garage auto", "45.20B": "Carrosserie, entretien", "45.11Z": "Vente de voitures", "47.71Z": "Habillement", "47.59B": "Équipement de la maison", "47.64Z": "Articles de sport", "47.78C": "Commerce de détail divers",
  "85.59A": "Formation continue", "85.59B": "Enseignement", "85.53Z": "Auto-école", "93.13Z": "Salle de sport", "93.12Z": "Club de sport", "85.51Z": "Coaching sportif",
  "81.21Z": "Nettoyage", "81.22Z": "Nettoyage spécialisé", "81.30Z": "Paysagiste, espaces verts", "49.32Z": "Taxi, VTC", "86.90A": "Ambulance", "82.30Z": "Événementiel", "90.01Z": "Spectacle vivant", "90.02Z": "Technique de spectacle",
  "01.21Z": "Viticulture", "01.11Z": "Grandes cultures", "11.02B": "Vinification", "25.62B": "Mécanique industrielle", "28.99B": "Fabrication de machines", "33.12Z": "Réparation de machines",
  "66.22Z": "Courtage d'assurance", "65.12Z": "Assurance", "66.19B": "Conseil financier", "66.30Z": "Gestion de fonds", "64.99Z": "Services financiers",
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
