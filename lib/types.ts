// "reseaux" = Facebook, Instagram, annuaire… mais pas de vrai site ; "vieux" = un site existe mais il est à refaire
export type WebPresence = "aucun" | "reseaux" | "vieux";

export type SiteAudit = {
  score: number; // 0 à 100 : plus c'est haut, plus le site est à refaire
  issues: string[];
  https: boolean;
  mobile: boolean;
  url: string;
  email?: string;
  lastYear?: number;
};

export const PRESENCE_LABEL: Record<WebPresence, string> = {
  aucun: "Aucun site",
  reseaux: "Réseaux seulement",
  vieux: "Site à refaire",
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
  score: number;
  foundAt: string;
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
};

export type ScanResult = {
  city: { name: string; dept: string; lat: number; lng: number };
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
};

export const DEFAULT_PROFILE: Profile = {
  firstName: "Theo",
  studio: "Thot Studio",
  phone: "",
  email: "",
  site: "thot-studio.fr",
  offer: "un site vitrine sur mesure, optimisé pour Google en local, avec la maintenance incluse",
  price: "",
};
