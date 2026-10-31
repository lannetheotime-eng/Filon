import type { Lead } from "./types";

// Ce qu'on sait du site, en clair, pour la liste et la fiche
export function siteStatus(l: Lead): { label: string; kind: "wp" | "other" | "unknown" | "none"; detail: string } {
  if (!l.website && (l.presence === "aucun" || l.presence === "reseaux"))
    return { label: "Pas de site", kind: "none", detail: l.presence === "reseaux" ? "Seulement une page sur les réseaux." : "Aucun site à son nom." };
  const cms = l.audit?.cms;
  if (cms === "WordPress") return { label: `WordPress${l.audit?.cmsVersion ? ` ${l.audit.cmsVersion}` : ""}`, kind: "wp", detail: "Tu peux intervenir dessus directement." };
  if (cms) return { label: `${cms}, pas WordPress`, kind: "other", detail: "Tu ne peux pas le reprendre : il faudra repartir sur WordPress." };
  if (l.audit) return { label: "CMS non reconnu", kind: "unknown", detail: "Site fait à la main ou outil non identifié : ouvre-le pour vérifier." };
  return { label: "Site non analysé", kind: "unknown", detail: "Active « Analyser les sites existants » et relance le scan pour savoir s'il est sous WordPress." };
}

// Ancienneté, depuis la date de création du registre
export function activity(created?: string) {
  if (!created) return null;
  const d = new Date(created);
  if (isNaN(d.getTime())) return null;
  const years = Math.floor((Date.now() - d.getTime()) / (365.25 * 864e5));
  const since = d.getFullYear();
  return {
    since,
    years,
    label: years < 1 ? `Créée en ${since}, moins d'un an` : `Depuis ${since}, ${years} an${years > 1 ? "s" : ""}`,
  };
}
