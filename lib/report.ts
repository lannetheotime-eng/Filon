import type { Lead, Profile } from "./types";

// Le rapport tient entièrement dans le lien : aucune donnée stockée côté serveur.
export type ReportData = {
  n: string; // nom de l'entreprise
  c: string; // ville
  u: string; // site analysé
  s: number; // score sur 100 (plus c'est haut, plus il y a à faire)
  i: string[]; // défauts relevés
  m: boolean; // adapté au mobile
  h: boolean; // HTTPS
  d: string; // date de l'analyse
  f: { s: string; n: string; e: string; p: string; w: string }; // studio, prénom, e-mail, téléphone, site
};

const toB64url = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export function encodeReport(l: Lead, p: Profile): string | null {
  if (!l.audit) return null;
  const data: ReportData = {
    n: l.name,
    c: l.city,
    u: l.website || l.audit.url,
    s: l.audit.score,
    i: l.audit.issues,
    m: l.audit.mobile,
    h: l.audit.https,
    d: (l.foundAt || new Date().toISOString()).slice(0, 10),
    f: { s: p.studio, n: p.firstName, e: p.email, p: p.phone, w: p.site },
  };
  return toB64url(JSON.stringify(data));
}

export function decodeReport(s: string): ReportData | null {
  try {
    const d = JSON.parse(fromB64url(s));
    return d && typeof d.n === "string" && Array.isArray(d.i) ? (d as ReportData) : null;
  } catch {
    return null;
  }
}

// Pourquoi chaque défaut compte, en langage de commerçant
export function explain(issue: string): { title: string; why: string } {
  const rules: [RegExp, string][] = [
    [/téléphone/i, "La plupart de vos clients vous cherchent depuis leur téléphone. Ici, le site s'affiche en miniature : il faut zoomer pour lire, et beaucoup abandonnent."],
    [/HTTPS|sécurisée/i, "Les navigateurs affichent « Non sécurisé » à côté de votre adresse. C'est la première chose que voit un visiteur, et ça inquiète."],
    [/mis à jour/i, "Une date ancienne en bas de page donne l'impression que l'entreprise n'est plus active, même quand tout va bien."],
    [/outil gratuit/i, "Les sites gratuits affichent la marque de la plateforme, parfois de la publicité, et sont moins bien mis en avant par Google."],
    [/Technologies anciennes/i, "Certaines briques techniques ne sont plus maintenues : affichage cassé sur les navigateurs récents et failles de sécurité possibles."],
    [/tableaux/i, "Une mise en page conçue pour les écrans d'ordinateur des années 2000, qui ne s'adapte pas aux écrans d'aujourd'hui."],
    [/titre pour Google/i, "Sans titre, Google choisit lui-même ce qu'il affiche dans les résultats : vous perdez la main sur votre première impression."],
    [/description pour Google/i, "Sans description, Google affiche un extrait pris au hasard sur la page, souvent peu engageant."],
    [/Lent/i, "Chaque seconde d'attente fait partir des visiteurs, surtout sur téléphone avec une connexion moyenne."],
    [/pas affiché|inaccessible|erreur/i, "Le site ne s'est pas affiché correctement lors de l'analyse. Vérifiez qu'il est toujours en ligne : un client qui tombe sur une erreur ne revient pas."],
  ];
  const hit = rules.find(([r]) => r.test(issue));
  return { title: issue, why: hit ? hit[1] : "Un point qui freine vos visiteurs et votre visibilité sur Google." };
}
