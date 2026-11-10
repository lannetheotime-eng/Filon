// Radar des nouvelles entreprises : types et réglages partagés (navigateur et serveur)
// Source : annonces du BODACC (créations, immatriculations, ventes de fonds de commerce), données publiques et gratuites.
// Les termes des secteurs sont cherchés comme fragments (« *terme* ») dans l'activité et le nom de l'entreprise.

export type RadarKind = "creation" | "arrivee" | "reprise";

export type RadarItem = {
  id: string; // identifiant de l'annonce BODACC
  kind: RadarKind;
  siren: string;
  name: string; // ce qu'on affiche : enseigne, dénomination ou prénom et nom
  legalName: string; // dénomination officielle
  brand?: string; // enseigne ou nom commercial
  form?: string; // forme juridique courte (SAS, SELARL, entreprise individuelle…)
  capital?: number;
  activity: string;
  address: string;
  cp: string;
  city: string;
  people: { name: string; role?: string }[];
  registered?: string; // date d'immatriculation (AAAA-MM-JJ)
  starts?: string; // début d'activité annoncé
  published: string; // date de parution au BODACC
  price?: number; // prix de rachat du fonds
  previous?: string; // ancien exploitant
  sector: SectorId | "autre";
  tradeId: string; // métier Filon le plus proche (pour les textes d'approche)
  score: number; // potentiel pour un studio de design, sur 100
  tags: string[];
  url: string; // annonce sur bodacc.fr
};

export type SectorId = "juridique" | "liberal" | "commerce" | "artisans" | "services";

export const SECTORS: { id: SectorId | "tout"; label: string; short: string; terms: string[] }[] = [
  { id: "juridique", label: "Avocats, notaires et professions du droit", short: "Droit", terms: ["avocat", "notaire", "notarial", "commissaire de justice", "huissier", "mandataire judiciaire", "administrateur judiciaire", "conseil juridique"] },
  { id: "liberal", label: "Santé, chiffre et autres professions libérales", short: "Libéral", terms: ["exercice libéral", "médecin", "médicale", "dentaire", "kinésithérap", "ostéopath", "infirmier", "psychologue", "orthophoniste", "podologue", "sage-femme", "vétérinaire", "expertise comptable", "expert-comptable", "commissaire aux comptes", "architecte", "architecture", "géomètre"] },
  { id: "commerce", label: "Commerces, restaurants et beauté", short: "Commerces", terms: ["restauration", "restaurant", "boulangerie", "pâtisserie", "boucherie", "charcuterie", "traiteur", "coiffure", "barbier", "esthétique", "institut de beauté", "onglerie", "fleuriste", "fleurs", "épicerie", "caviste", "vins", "bar", "café", "salon de thé", "prêt-à-porter", "boutique", "magasin", "commerce de détail", "opticien", "optique", "tatouage", "fromagerie", "chocolaterie", "glacier"] },
  { id: "artisans", label: "Artisans et bâtiment", short: "Artisans", terms: ["plomberie", "chauffage", "électricité", "électricien", "menuiserie", "maçonnerie", "peinture", "plâtrerie", "couverture", "charpente", "carrelage", "serrurerie", "paysagiste", "espaces verts", "rénovation", "climatisation", "toiture", "ébénisterie"] },
  { id: "services", label: "Conseil, immobilier et services aux entreprises", short: "Services", terms: ["conseil", "consultant", "formation", "agence immobili", "transaction immobili", "transactions immobili", "courtage", "courtier", "assurance", "coaching", "recrutement", "gestion de patrimoine", "conciergerie", "auto-école", "salle de sport", "fitness"] },
  { id: "tout", label: "Tous les secteurs", short: "Tout", terms: [] },
];

export const KIND_LABEL: Record<RadarKind, string> = {
  creation: "Création",
  arrivee: "Arrivée",
  reprise: "Rachat",
};

export type RadarQuery = {
  zone: string; // départements (31, 82) ou codes postaux (31000), séparés par des virgules
  sector: SectorId | "tout";
  days: number;
  creations: boolean; // créations et arrivées (immatriculations)
  reprises: boolean; // rachats de fonds de commerce
  offset?: number;
};

export type RadarResult = {
  items: RadarItem[];
  total: number; // annonces correspondantes au BODACC, avant tri
  read: number; // annonces lues dans ce lot
  hidden: number; // écartées : SCI, holdings, sociétés sans activité, franchises, livreurs…
  next?: number; // décalage pour le lot suivant
  demo?: boolean;
};

export const fmtEur = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;

export function fmtDay(iso?: string) {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
}
