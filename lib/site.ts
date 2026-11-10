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

// Site WordPress à refaire : ce que tu peux reprendre directement
export const isWpRedo = (l: Lead) => l.presence === "vieux" && l.audit?.cms === "WordPress";

// Les faits marquants de l'analyse, en une ligne courte : « WP 5.2 · PHP 7.4 · contenu de 2019 · Divi »
export function siteSignals(l: Lead): string {
  const a = l.audit;
  if (!a || (l.presence !== "vieux" && l.presence !== "equipe")) return "";
  const year = new Date().getFullYear();
  const parts: string[] = [];
  if (a.cms === "WordPress" && a.cmsVersion) parts.push(`WP ${a.cmsVersion}`);
  if (a.php) parts.push(`PHP ${a.php}`);
  const upd = a.lastUpdate ? Number(a.lastUpdate.slice(0, 4)) : undefined;
  if (upd && upd <= year - 2) parts.push(`contenu de ${upd}`);
  else if (!upd && a.lastYear && a.lastYear <= year - 3) parts.push(`© ${a.lastYear}`);
  if (!a.mobile) parts.push("pas mobile");
  if (!a.https) parts.push("sans HTTPS");
  if (a.builder || a.theme) parts.push(a.builder || a.theme!);
  return parts.join(" · ");
}

// Une seule étiquette qui résume la situation, pour la liste
export function rowStatus(l: Lead): { label: string; tone: "none" | "social" | "old" | "ok" | "wp" } {
  const cms = l.audit?.cms;
  if (l.presence === "aucun") return { label: "Pas de site", tone: "none" };
  if (l.presence === "reseaux") return { label: "Réseaux seulement", tone: "social" };
  if (l.presence === "vieux") return { label: `${cms || "Site"} à refaire`, tone: cms === "WordPress" ? "wp" : "old" };
  return { label: `${cms || "Site"} correct`, tone: cms === "WordPress" ? "wp" : "ok" };
}
