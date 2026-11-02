// Audit complet d'un site : types partagés (navigateur et serveur)

export type Cat = "vitesse" | "mobile" | "seo" | "local" | "securite" | "legal" | "conversion";
export type Status = "ok" | "warn" | "fail" | "info";
export type Effort = "rapide" | "moyen" | "lourd";

export type Check = {
  id: string;
  cat: Cat;
  status: Status;
  title: string; // le constat, court
  found?: string; // ce qui a été mesuré, précisément
  why: string; // pourquoi ça compte, en langage de commerçant
  fix: string; // quoi faire, concrètement
  wp?: string; // comment faire sous WordPress
  effort: Effort;
  impact: 1 | 2 | 3; // 3 = gros impact sur les clients ou Google
};

export type DeepAudit = {
  url: string;
  finalUrl: string;
  at: string;
  health: number; // santé globale sur 100 (100 = parfait)
  cats: { id: Cat; label: string; score: number; fails: number; warns: number }[];
  checks: Check[];
  cms?: string;
  cmsVersion?: string;
  wpLatest?: string;
  plugins?: { slug: string; version?: string; latest?: string }[];
  theme?: string;
  builder?: string;
  psi?: { perf?: number; seo?: number; a11y?: number; bp?: number; lcp?: string; cls?: string; tbt?: string; fcp?: string; weight?: string };
  psiError?: string;
  verdict: { kind: "maintenance" | "optimisation" | "refonte"; text: string };
};

export const CAT_LABEL: Record<Cat, string> = {
  vitesse: "Vitesse",
  mobile: "Téléphone",
  seo: "Référencement Google",
  local: "Visibilité locale",
  securite: "Sécurité et maintenance",
  legal: "Obligations légales",
  conversion: "Prise de contact",
};

export const EFFORT_LABEL: Record<Effort, string> = { rapide: "Rapide (moins d'1 h)", moyen: "Moyen (une demi-journée)", lourd: "Lourd (refonte ou gros chantier)" };
