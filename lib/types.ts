export type WebPresence = "aucun" | "reseaux"; // "reseaux" = Facebook, Instagram, annuaire… mais pas de vrai site

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
};

export type ScanResult = {
  city: { name: string; dept: string; lat: number; lng: number };
  tradeId: string;
  leads: Lead[];
  scanned: number; // fiches analysées
  withSite: number;
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
