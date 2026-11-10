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
  lastUpdate?: string; // dernière modification d'une page ou d'un article (API WordPress), AAAA-MM-JJ
  php?: string; // version de PHP annoncée par le serveur
  theme?: string; // thème WordPress
  builder?: string; // constructeur de pages (Elementor, Divi…)
  ms?: number; // temps de chargement de l'accueil, en millisecondes
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
  created?: string; // date de création (registre officiel des entreprises)
  legalName?: string; // nom officiel trouvé dans le registre, pour vérifier la correspondance
  registry?: "ok" | "none"; // recherche dans le registre faite
  details?: Details; // avis chargés une fois (1 requête), gardés ensuite
  email?: string; // e-mail de contact (trouvé sur son site ou saisi à la main)
  emailOthers?: string[]; // autres adresses trouvées
  emailChecked?: boolean; // recherche automatique déjà faite
  deep?: import("./deep-types").DeepAudit; // audit complet, lancé depuis la fiche
  people?: { name: string; role?: string }[]; // dirigeants connus (annonce BODACC)
  source?: "bodacc"; // trouvée par le radar des nouvelles entreprises (pas une fiche Google)
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
  mails?: SentMail[]; // e-mails envoyés depuis Filon
};

export type SentMail = { id: string; to: string; subject: string; at: string; status?: string; checkedAt?: string };

// Statut renvoyé par Resend → libellé et couleur
export const MAIL_STATUS: Record<string, { label: string; tone: "wait" | "ok" | "hot" | "bad" }> = {
  queued: { label: "En cours d'envoi", tone: "wait" },
  scheduled: { label: "Programmé", tone: "wait" },
  sent: { label: "Envoyé", tone: "wait" },
  delivery_delayed: { label: "Retardé", tone: "wait" },
  delivered: { label: "Bien reçu", tone: "ok" },
  opened: { label: "Bien reçu", tone: "ok" },
  clicked: { label: "A cliqué sur un lien", tone: "hot" },
  bounced: { label: "Adresse invalide", tone: "bad" },
  complained: { label: "Signalé comme spam", tone: "bad" },
  failed: { label: "Échec d'envoi", tone: "bad" },
  canceled: { label: "Annulé", tone: "bad" },
};
export const FINAL_MAIL = ["clicked", "bounced", "complained", "failed", "canceled"];

export type ScanResult = {
  city: { name: string; dept: string; lat: number; lng: number; zone?: string };
  tradeId: string;
  leads: Lead[];
  scanned: number; // fiches analysées
  withSite: number; // sites corrects, écartés
  audited: number; // sites analysés
  calls: number; // requêtes Google facturées
  demo: boolean;
  next?: string; // jeton Google pour les 20 résultats suivants
  cachedAt?: string; // résultat repris du cache local (aucune requête)
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
  gmail?: string; // compte Gmail qui ouvre les brouillons
  why?: string; // pourquoi te choisir, un point par ligne (repris dans les e-mails)
  about?: string; // qui tu es, en une ou deux phrases (repris dans les e-mails)
  art?: ArtProfile; // prospection de tes tableaux
};

export type ArtProfile = {
  instagram?: string; // ton compte, ex. @moncompte
  style?: string; // ex. « des tableaux sérigraphiés, univers manga et Japon »
  priceFrom?: number;
  priceTo?: number;
  formats?: string; // ex. « 30×40, 50×70 et 70×100 cm »
  extras?: string; // un avantage réel par ligne (livraison, accrochage…)
  references?: string; // lieux qui ont déjà tes pièces ou une collab, un par ligne
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
