import type { Lead } from "./types";

// ——— Catalogue des prestations (prix réglables dans Réglages) ———
export const SERVICES: { id: string; label: string; family: "Digital" | "Identité" | "Print" }[] = [
  { id: "site", label: "Site vitrine", family: "Digital" },
  { id: "refonte", label: "Refonte du site", family: "Digital" },
  { id: "migration", label: "Migration vers WordPress", family: "Digital" },
  { id: "maintenance", label: "Maintenance WordPress (par mois)", family: "Digital" },
  { id: "fiche-google", label: "Fiche Google optimisée + photos", family: "Digital" },
  { id: "reseaux", label: "Kit visuels réseaux sociaux", family: "Digital" },
  { id: "identite", label: "Logo et identité visuelle", family: "Identité" },
  { id: "lancement", label: "Pack lancement (logo, cartes, flyer)", family: "Identité" },
  { id: "papeterie", label: "Papeterie (en-têtes, devis, factures)", family: "Identité" },
  { id: "cartes", label: "Cartes de visite", family: "Print" },
  { id: "flyer", label: "Flyer", family: "Print" },
  { id: "affiche", label: "Affiche / vitrine", family: "Print" },
  { id: "menu", label: "Menus et cartes", family: "Print" },
  { id: "fidelite", label: "Cartes de fidélité / rendez-vous", family: "Print" },
  { id: "cadeaux", label: "Cartes cadeaux", family: "Print" },
  { id: "etiquettes", label: "Étiquettes et packaging", family: "Print" },
  { id: "qr-avis", label: "Présentoir QR « Laissez un avis »", family: "Print" },
  { id: "covering", label: "Covering véhicule", family: "Print" },
  { id: "signaletique", label: "Signalétique / enseigne", family: "Print" },
];
export const serviceLabel = (id: string) => SERVICES.find((s) => s.id === id)?.label || id;

export type Need = {
  key: string; // unique (un même service peut revenir pour deux occasions)
  service: string;
  title: string;
  why: string;
  priority: 1 | 2 | 3; // 1 = à proposer en premier
  deadline?: string; // date limite conseillée pour livrer
};

// ——— Temps forts de l'année ———
function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
// Fête des mères en France : dernier dimanche de mai (repoussée d'une semaine si c'est la Pentecôte)
function motherDay(y: number) {
  const d = new Date(y, 4, 31);
  d.setDate(31 - d.getDay());
  const pentecost = new Date(easter(y).getTime() + 49 * 864e5);
  if (d.toDateString() === pentecost.toDateString()) d.setDate(d.getDate() + 7);
  return d;
}
const fixed = (m: number, d: number) => (y: number) => new Date(y, m - 1, d);

type Moment = { name: string; date: (y: number) => Date; service: string; pitch: string };

const MOMENTS: Record<string, Moment[]> = {
  boulangerie: [
    { name: "Noël", date: fixed(12, 24), service: "flyer", pitch: "flyer et affiche pour les commandes de bûches" },
    { name: "l'Épiphanie", date: fixed(1, 6), service: "affiche", pitch: "affiche vitrine pour les galettes" },
    { name: "Pâques", date: easter, service: "affiche", pitch: "affiche et étiquettes pour les chocolats" },
  ],
  fleuriste: [
    { name: "la Saint-Valentin", date: fixed(2, 14), service: "flyer", pitch: "flyer et affiche pour les précommandes" },
    { name: "la fête des mères", date: motherDay, service: "flyer", pitch: "flyer et cartes de message" },
    { name: "la Toussaint", date: fixed(11, 1), service: "affiche", pitch: "affiche vitrine et flyer" },
    { name: "Noël", date: fixed(12, 24), service: "etiquettes", pitch: "étiquettes et cartes pour les compositions de fêtes" },
  ],
  restaurant: [
    { name: "les fêtes de fin d'année", date: fixed(12, 24), service: "menu", pitch: "menu de fêtes et flyer pour les réservations" },
    { name: "la Saint-Valentin", date: fixed(2, 14), service: "menu", pitch: "menu spécial et visuel réseaux sociaux" },
    { name: "l'ouverture des terrasses", date: fixed(4, 15), service: "signaletique", pitch: "chevalet et signalétique de terrasse" },
  ],
  boucherie: [
    { name: "les fêtes de fin d'année", date: fixed(12, 24), service: "flyer", pitch: "flyer pour les commandes traiteur de fêtes" },
    { name: "Pâques", date: easter, service: "affiche", pitch: "affiche pour les commandes d'agneau" },
    { name: "la saison des barbecues", date: fixed(6, 1), service: "flyer", pitch: "flyer « plateaux barbecue »" },
  ],
  coiffeur: [
    { name: "Noël", date: fixed(12, 20), service: "cadeaux", pitch: "cartes cadeaux à vendre au comptoir" },
    { name: "la fête des mères", date: motherDay, service: "cadeaux", pitch: "cartes cadeaux et affiche vitrine" },
    { name: "la saison des mariages", date: fixed(4, 1), service: "flyer", pitch: "flyer « coiffure de mariée »" },
  ],
  beaute: [
    { name: "Noël", date: fixed(12, 20), service: "cadeaux", pitch: "cartes cadeaux et coffrets" },
    { name: "la Saint-Valentin", date: fixed(2, 14), service: "cadeaux", pitch: "cartes cadeaux duo" },
    { name: "la fête des mères", date: motherDay, service: "cadeaux", pitch: "cartes cadeaux et affiche vitrine" },
  ],
  garage: [
    { name: "le passage aux pneus hiver", date: fixed(11, 1), service: "flyer", pitch: "flyer et affiche « pneus hiver »" },
    { name: "les départs en vacances", date: fixed(7, 1), service: "flyer", pitch: "flyer « révision avant les vacances »" },
  ],
  plombier: [{ name: "la reprise du chauffage", date: fixed(10, 1), service: "flyer", pitch: "flyer boîtes aux lettres « entretien chaudière »" }],
  electricien: [{ name: "la reprise du chauffage", date: fixed(10, 1), service: "flyer", pitch: "flyer « chauffage et mise aux normes »" }],
  paysagiste: [
    { name: "le printemps", date: fixed(3, 15), service: "flyer", pitch: "flyer boîtes aux lettres « entretien de jardin »" },
    { name: "la taille d'automne", date: fixed(10, 15), service: "flyer", pitch: "flyer « taille et nettoyage d'automne »" },
  ],
  macon: [{ name: "la saison des travaux", date: fixed(3, 15), service: "flyer", pitch: "flyer boîtes aux lettres et panneau de chantier" }],
  menuisier: [{ name: "la saison des travaux", date: fixed(3, 15), service: "flyer", pitch: "flyer et panneau de chantier" }],
  peintre: [{ name: "la saison des ravalements", date: fixed(4, 1), service: "flyer", pitch: "flyer et panneau de chantier" }],
  photographe: [
    { name: "la saison des mariages", date: fixed(3, 1), service: "flyer", pitch: "plaquette tarifaire mariage pour les salons" },
    { name: "Noël", date: fixed(12, 1), service: "cadeaux", pitch: "bons cadeaux « séance photo »" },
  ],
};

// ——— Besoins de fond, selon le métier ———
const BASE: Record<string, [string, string][]> = {
  boulangerie: [["etiquettes", "Étiquettes produits, sacs et boîtes à gâteaux à son nom."], ["fidelite", "Carte de fidélité : simple, et ça fait revenir."]],
  restaurant: [["menu", "La carte est le premier support de marque d'un restaurant."], ["signaletique", "Chevalet, vitrophanie, carte affichée dehors."]],
  coiffeur: [["fidelite", "Cartes de rendez-vous et de fidélité."], ["affiche", "Grille tarifaire en vitrine."]],
  beaute: [["fidelite", "Cartes de rendez-vous et de fidélité."], ["cadeaux", "Cartes cadeaux toute l'année."]],
  garage: [["cartes", "Cartes de visite à laisser avec chaque véhicule."], ["covering", "Covering du véhicule de courtoisie : une publicité qui roule."]],
  fleuriste: [["etiquettes", "Cartes de message, étiquettes et rubans à son nom."], ["affiche", "Vitrine et chevalet."]],
  boucherie: [["etiquettes", "Étiquettes, sacs et papier à son nom."], ["flyer", "Flyer traiteur à glisser dans les sacs."]],
  plombier: [["covering", "Son utilitaire est vu toute la journée : c'est sa meilleure publicité."], ["papeterie", "Devis et factures à en-tête : ça rassure les particuliers."], ["cartes", "Cartes de visite à laisser après chaque intervention."]],
  electricien: [["covering", "Son utilitaire est vu toute la journée : c'est sa meilleure publicité."], ["papeterie", "Devis et factures à en-tête."], ["cartes", "Cartes de visite."]],
  macon: [["covering", "Covering de l'utilitaire."], ["signaletique", "Panneau de chantier à son nom."], ["papeterie", "Devis et factures à en-tête."]],
  menuisier: [["covering", "Covering de l'utilitaire."], ["papeterie", "Devis et factures à en-tête."]],
  peintre: [["covering", "Covering de l'utilitaire."], ["signaletique", "Panneau de chantier à son nom."]],
  paysagiste: [["covering", "Covering de l'utilitaire et de la remorque."], ["cartes", "Cartes de visite."]],
  photographe: [["identite", "Son image de marque est sa vitrine."], ["cartes", "Cartes de visite et plaquette tarifaire."]],
  avocat: [["papeterie", "Papeterie du cabinet : en-têtes, cartes, correspondances."], ["signaletique", "Plaque professionnelle."]],
  notaire: [["papeterie", "Papeterie de l'office."], ["signaletique", "Plaque et signalétique de l'office."]],
};

const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

export function upcomingMoments(tradeId: string, now = new Date(), horizonDays = 75) {
  const out: { m: Moment; date: Date; days: number }[] = [];
  for (const m of MOMENTS[tradeId] || []) {
    for (const y of [now.getFullYear(), now.getFullYear() + 1]) {
      const date = m.date(y);
      const days = Math.round((date.getTime() - now.getTime()) / 864e5);
      if (days >= 10 && days <= horizonDays) out.push({ m, date, days });
    }
  }
  return out.sort((a, b) => a.days - b.days);
}

export function detectNeeds(l: Lead, opts: { now?: Date; created?: string } = {}): Need[] {
  const now = opts.now || new Date();
  const year = now.getFullYear();
  const needs: Need[] = [];
  const add = (n: Need) => { if (!needs.some((x) => x.key === n.key)) needs.push(n); };

  // Temps forts à venir : le print se prépare 3 à 4 semaines avant
  for (const { m, date, days } of upcomingMoments(l.tradeId, now)) {
    const deadline = new Date(date.getTime() - 21 * 864e5);
    add({
      key: `${m.service}-${m.name}`,
      service: m.service,
      title: `${m.name.charAt(0).toUpperCase() + m.name.slice(1)} : ${m.pitch}`,
      why: `${m.name.charAt(0).toUpperCase() + m.name.slice(1)}, c'est le ${fmtDate(date)}, dans ${days} jours : le temps de créer, d'imprimer et de distribuer.`,
      priority: days <= 60 ? 1 : 2,
      deadline: `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, "0")}-${String(deadline.getDate()).padStart(2, "0")}`,
    });
  }

  // Présence en ligne
  if (l.presence === "aucun") add({ key: "site", service: "site", title: "Site vitrine", why: "Aucun site : ceux qui le cherchent sur Google ne trouvent que sa fiche.", priority: 1 });
  if (l.presence === "reseaux") {
    add({ key: "site", service: "site", title: "Site vitrine", why: "Seulement une page sur les réseaux : rien qui lui appartienne vraiment.", priority: 1 });
    add({ key: "reseaux", service: "reseaux", title: "Kit visuels réseaux sociaux", why: "Il publie déjà : des modèles à son image rendront ses publications plus pros, sans effort.", priority: 2 });
  }
  const cms = l.audit?.cms;
  const isWp = cms === "WordPress";
  if (l.presence === "vieux") {
    const issues = (l.audit?.issues || []).slice(0, 2).join(", ");
    if (isWp || !cms) {
      add({ key: "refonte", service: "refonte", title: "Refonte du site", why: `${isWp ? "Site sous WordPress : tu peux reprendre l'existant sans migration. " : ""}${issues}.`, priority: 1 });
      if (isWp) add({ key: "maintenance", service: "maintenance", title: "Maintenance WordPress", why: "Mises à jour, sauvegardes et sécurité chaque mois : un revenu récurrent après la refonte.", priority: 2 });
    } else {
      add({ key: "migration", service: "migration", title: `Nouveau site sur WordPress (aujourd'hui sur ${cms})`, why: `Fait avec ${cms} : tu ne peux pas le reprendre tel quel, il faut repartir sur WordPress. ${issues}.`, priority: 1 });
    }
    if (l.audit?.lastYear && l.audit.lastYear <= year - 6)
      add({ key: "identite", service: "identite", title: "Rafraîchir le logo et l'identité", why: `Un site de ${l.audit.lastYear} va souvent avec un logo de la même époque : refaire les deux ensemble donne une image cohérente.`, priority: 2 });
  }

  if (l.presence === "equipe") {
    if (isWp) add({ key: "maintenance", service: "maintenance", title: "Maintenance WordPress", why: `Site correct sous WordPress${l.audit?.cmsVersion ? ` ${l.audit.cmsVersion}` : ""} : propose les mises à jour, sauvegardes et la sécurité par abonnement.`, priority: 1 });
    else if (cms) add({ key: "site-ok", service: "identite", title: "Le site est correct : pars sur le print et l'identité", why: `Site fait avec ${cms} : tu ne pourras pas intervenir dessus, concentre-toi sur le reste.`, priority: 3 });
  }

  // Fiche Google
  if (l.photoCount != null && l.photoCount < 5)
    add({ key: "fiche-google", service: "fiche-google", title: "Fiche Google et photos", why: `Seulement ${l.photoCount} photo${l.photoCount > 1 ? "s" : ""} sur sa fiche Google : c'est souvent la première image qu'on voit de lui.`, priority: 2 });
  if ((l.rating || 0) >= 4.3 && (l.reviews || 0) < 40)
    add({ key: "qr-avis", service: "qr-avis", title: "Présentoir QR « Laissez un avis »", why: `Très bonne note (${String(l.rating).replace(".", ",")}) mais seulement ${l.reviews || 0} avis : un QR code au comptoir en fait gagner vite.`, priority: 2 });

  // Entreprise récente
  const created = opts.created || l.created;
  if (created) {
    const age = (now.getTime() - new Date(created).getTime()) / (365 * 864e5);
    if (age < 2) add({ key: "lancement", service: "lancement", title: "Pack lancement", why: `Entreprise créée il y a ${age < 1 ? "moins d'un an" : "moins de deux ans"} : logo, cartes et flyer d'ouverture sont souvent encore à faire proprement.`, priority: 1 });
  }

  // Besoins propres au métier
  for (const [service, why] of BASE[l.tradeId] || []) add({ key: service, service, title: serviceLabel(service), why, priority: 3 });

  return needs.sort((a, b) => a.priority - b.priority);
}

// Proposition chiffrée à partir des besoins retenus
export function proposal(needs: Need[], prices: Record<string, number>) {
  const lines = needs.map((n) => ({ title: n.title, price: prices[n.service] }));
  const priced = lines.filter((l) => l.price != null && !isNaN(l.price));
  const total = priced.reduce((s, l) => s + (l.price || 0), 0);
  return { lines, total, complete: priced.length === lines.length };
}
