// "reseaux" = Facebook, Instagram, annuaire… mais pas de vrai site ; "vieux" = un site existe mais il est à refaire
// "equipe" = un site correct : prospect pour la maintenance, l'identité ou le print
export type WebPresence = "aucun" | "reseaux" | "vieux" | "equipe";

export type SiteAudit = {
  score: number; // 0 à 100 : plus c'est haut, plus le site est à refaire
  issues: string[];
  https: boolean;
  mobile: boolean;
  url: string;
  email?: string;
  lastYear?: number;
  cms?: string; // WordPress, Wix, Shopify…
  cmsVersion?: string;
};

export const PRESENCE_LABEL: Record<WebPresence, string> = {
  aucun: "Aucun site",
  reseaux: "Réseaux seulement",
  vieux: "Site à refaire",
  equipe: "Site correct",
};

export type Lead = {
  id: string; // place id Google
  name: string;
  tradeId: string;
  city: string;
  address: string;
  phone?: string;
  phoneIntl?: string;
  rating?: number;
  reviews?: number;
  lat: number;
  lng: number;
  mapsUrl?: string;
  presence: WebPresence;
  socialUrl?: string;
  website?: string;
  audit?: SiteAudit;
  category?: string;
  hours?: string[];
  openPeriods?: OpenPeriod[];
  photoCount?: number; // photos sur la fiche Google (10 maximum renvoyées)
  context?: LeadContext;
  score: number;
  foundAt: string;
};

// Plage d'ouverture : jour Google (0 = dimanche … 6 = samedi), minutes depuis minuit
export type OpenPeriod = { day: number; open: number; close: number };

export type LeadContext = {
  rival?: { name: string; distance: number; rating?: number; reviews?: number };
  siteShare?: number; // % des entreprises du même métier analysées qui ont un site correct
  total?: number; // nombre d'entreprises du métier analysées dans la ville
};

export type Dirigeant = {
  company: string;
  siren: string;
  address: string;
  created?: string;
  people: { name: string; role?: string }[];
  active: boolean;
};

export type Stage = "a_contacter" | "contacte" | "a_relancer" | "rdv" | "signe" | "perdu";

export const STAGES: { id: Stage; label: string }[] = [
  { id: "a_contacter", label: "À contacter" },
  { id: "contacte", label: "Contacté" },
  { id: "a_relancer", label: "À relancer" },
  { id: "rdv", label: "RDV" },
  { id: "signe", label: "Signé" },
  { id: "perdu", label: "Perdu" },
];

export type PipelineEntry = {
  stage: Stage;
  notes: string;
  updatedAt: string;
  followUp?: string; // date AAAA-MM-JJ
  amount?: number; // montant signé, en euros
  contactedAt?: string;
  channel?: "email" | "visite" | "message" | "appel";
  needs?: string[]; // besoins retenus pour la proposition
  log?: { at: string; text: string }[]; // historique des actions
  ticket?: number; // ce que rapporte un client au gérant (donné par lui)
};

export type ScanResult = {
  city: { name: string; dept: string; lat: number; lng: number; zone?: string };
  tradeId: string;
  leads: Lead[];
  scanned: number; // fiches analysées
  withSite: number; // sites corrects, écartés
  audited: number; // sites analysés
  calls: number; // requêtes Google facturées
  demo: boolean;
};

export type Details = {
  hours?: string[];
  reviews?: { author: string; rating: number; text: string; when: string }[];
  summary?: string;
};

export type Profile = {
  firstName: string;
  studio: string;
  phone: string;
  email: string;
  site: string;
  offer: string;
  price: string;
  portfolio: string;
  prices?: Record<string, number>; // tarifs par prestation
  dailyCap?: number; // plafond de requêtes Google par jour (30 = reste dans le gratuit)
  guarantees?: string; // une garantie par ligne (uniquement ce que tu offres vraiment)
  references?: string; // un client de référence par ligne
};

export const DEFAULT_PROFILE: Profile = {
  firstName: "",
  studio: "",
  phone: "",
  email: "",
  site: "",
  offer: "l'hébergement, la maintenance et le suivi du référencement local, par abonnement mensuel",
  price: "",
  portfolio: "",
};
