import type { Lead, Profile, OpenPeriod } from "./types";
import { getTrade } from "./trades";
import { detectNeeds } from "./needs";
import { activity } from "./site";
import { getArtVenue, artFit, artPrep, instagramOf, priceText } from "./art";

export type Channel = "visite" | "email" | "message";

type TradeApproach = {
  channel: Channel;
  why: string;
  days: number[]; // jours conseillés, 0 = dimanche
  window: [number, number]; // minutes depuis minuit
  avoid: string;
  secondary: Channel;
  ask: string; // à qui s'adresser
  offer: string; // première offre à proposer
  needs: string[]; // ce que ses clients cherchent en ligne
};

const h = (hh: number, mm = 0) => hh * 60 + mm;

const SHOP = (o: Partial<TradeApproach> & Pick<TradeApproach, "offer" | "needs">): TradeApproach => ({
  channel: "visite",
  why: "Le gérant est sur place : cinq minutes en face à face valent dix e-mails.",
  days: [2, 3, 4],
  window: [h(14, 30), h(16, 30)],
  avoid: "les heures de rush",
  secondary: "email",
  ask: "Demande le gérant ou la gérante.",
  ...o,
});

const ARTISAN = (o: Partial<TradeApproach> & Pick<TradeApproach, "offer" | "needs">): TradeApproach => ({
  channel: "email",
  why: "Il est sur les chantiers la journée : il lit ses e-mails tôt le matin ou le soir.",
  days: [1, 2, 3],
  window: [h(7), h(8)],
  avoid: "le vendredi après-midi et le week-end",
  secondary: "message",
  ask: "Écris directement à l'artisan, c'est lui qui décide.",
  ...o,
});

const APPROACH: Record<string, TradeApproach> = {
  boulangerie: SHOP({
    window: [h(14, 30), h(16, 30)],
    avoid: "le matin avant 11 h, le midi et le week-end (rush)",
    offer: "un site vitrine simple avec horaires, produits et commandes de gâteaux, plus sa fiche Google optimisée",
    needs: ["les horaires, surtout le dimanche", "les commandes de gâteaux et de fêtes", "l'accès"],
  }),
  coiffeur: SHOP({
    days: [2, 3],
    window: [h(9, 30), h(11)],
    avoid: "le samedi et les fins de journée",
    secondary: "message",
    offer: "un site avec prise de rendez-vous en ligne, tarifs et galerie de réalisations",
    needs: ["les tarifs", "la prise de rendez-vous", "des photos de coupes"],
  }),
  beaute: SHOP({
    days: [2, 3],
    window: [h(10), h(12)],
    avoid: "le samedi et la fin d'après-midi",
    secondary: "message",
    offer: "un site avec la carte des soins, la réservation en ligne et les cartes cadeaux",
    needs: ["la carte des soins et les tarifs", "la réservation", "les cartes cadeaux"],
  }),
  garage: SHOP({
    days: [2, 3, 4],
    window: [h(14), h(16)],
    avoid: "le lundi matin et le vendredi soir (dépôts et restitutions)",
    ask: "Demande le patron du garage, pas l'accueil.",
    offer: "un site avec les prestations, des tarifs indicatifs et une demande de rendez-vous",
    needs: ["les prestations et les tarifs", "la prise de rendez-vous", "les avis"],
  }),
  fleuriste: SHOP({
    days: [2, 3],
    window: [h(14), h(16)],
    avoid: "le samedi et les veilles de fêtes (Saint-Valentin, fête des mères, Toussaint)",
    offer: "un site avec les compositions, les commandes de mariage et de deuil, et la livraison",
    needs: ["les commandes de deuil et de mariage", "la livraison", "des photos de compositions"],
  }),
  restaurant: SHOP({
    days: [2, 3, 4],
    window: [h(15), h(17)],
    avoid: "pendant le service (11 h 30 – 14 h 30 et le soir)",
    secondary: "message",
    ask: "Demande le patron ou le chef, entre deux services.",
    offer: "un site avec la carte, le menu du jour, les photos et la réservation",
    needs: ["la carte et les prix", "les photos des plats", "la réservation"],
  }),
  boucherie: SHOP({
    window: [h(14, 30), h(16, 30)],
    avoid: "le samedi matin et les veilles de fêtes",
    offer: "un site avec les produits, l'origine des viandes et les commandes traiteur",
    needs: ["les commandes pour les fêtes", "le traiteur", "les horaires"],
  }),
  plombier: ARTISAN({
    offer: "un site qui met en avant le dépannage et la zone d'intervention, bien placé sur Google",
    needs: ["un numéro à appeler vite", "la zone d'intervention", "les avis"],
  }),
  electricien: ARTISAN({
    offer: "un site avec les services (dépannage, mise aux normes, bornes de recharge) et une demande de devis",
    needs: ["les services", "la demande de devis", "la zone d'intervention"],
  }),
  macon: ARTISAN({
    offer: "un site avec des réalisations avant/après et une demande de devis",
    needs: ["des photos de chantiers", "la demande de devis", "la zone d'intervention"],
  }),
  menuisier: ARTISAN({
    offer: "un site portfolio de ses réalisations sur mesure, avec demande de devis",
    needs: ["des photos de réalisations", "le sur-mesure", "la demande de devis"],
  }),
  peintre: ARTISAN({
    offer: "un site avec des chantiers avant/après et une demande de devis",
    needs: ["des photos avant/après", "la demande de devis", "les avis"],
  }),
  paysagiste: ARTISAN({
    offer: "un site avec ses réalisations de jardins et ses contrats d'entretien",
    needs: ["des photos de jardins", "l'entretien à l'année", "la demande de devis"],
  }),
  photographe: {
    channel: "message",
    why: "Son métier se joue sur Instagram : il lit ses messages privés.",
    days: [1, 2, 3, 4],
    window: [h(18), h(20)],
    avoid: "le week-end (mariages et séances)",
    secondary: "email",
    ask: "Écris-lui directement en message privé.",
    offer: "un portfolio en ligne qui lui appartient, avec ses prestations et un formulaire de contact",
    needs: ["le portfolio", "les tarifs des prestations", "le contact"],
  },
  avocat: {
    channel: "email",
    why: "Un cabinet ne reçoit que sur rendez-vous : un e-mail sobre et précis est le bon format.",
    days: [2, 3, 4],
    window: [h(8), h(9)],
    avoid: "les visites sans rendez-vous et le lundi",
    secondary: "message",
    ask: "Adresse-toi à l'avocat titulaire ; LinkedIn en relance.",
    offer: "un site sobre qui présente les domaines d'intervention et permet de prendre rendez-vous",
    needs: ["les domaines d'intervention", "la prise de rendez-vous", "les honoraires (principes)"],
  },
  notaire: {
    channel: "email",
    why: "Un office passe par les canaux formels : un e-mail soigné, puis LinkedIn.",
    days: [2, 3, 4],
    window: [h(8), h(9)],
    avoid: "les visites sans rendez-vous",
    secondary: "message",
    ask: "Demande le notaire associé ou la responsable de l'office.",
    offer: "un site institutionnel avec les domaines, les documents à préparer et les contacts",
    needs: ["les documents à préparer", "les domaines", "les horaires et l'accès"],
  },
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  visite: "Passer en boutique",
  email: "Envoyer un e-mail",
  message: "Envoyer un message privé",
};

const DAY = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const fmt = (m: number) => `${Math.floor(m / 60)}\u00a0h${m % 60 ? `\u00a0${String(m % 60).padStart(2, "0")}` : ""}`;

// Créneau conseillé : jours et heures du métier, croisés avec les horaires réels
export function bestSlot(a: TradeApproach, channel: Channel, periods?: OpenPeriod[]) {
  let [w0, w1] = a.window;
  const known = !!periods?.length;
  const fits = (day: number) => {
    if (channel !== "visite" || !known) return true;
    return periods!.some((p) => p.day === day && Math.min(p.close, w1) - Math.max(p.open, w0) >= 60);
  };
  let days = a.days.filter(fits);
  if (!days.length && known) days = [1, 2, 3, 4, 5, 6, 0].filter(fits).slice(0, 2);
  if (!days.length) days = a.days;
  const closed = known ? [0, 1, 2, 3, 4, 5, 6].filter((d) => !periods!.some((p) => p.day === d)) : [];
  // Resserre le créneau sur ses heures d'ouverture réelles (ex. réouverture à 15 h)
  if (channel === "visite" && known) {
    const p = periods!.find((x) => x.day === days[0] && Math.min(x.close, w1) - Math.max(x.open, w0) >= 60);
    if (p) { w0 = Math.max(p.open, w0); w1 = Math.min(p.close, w1); }
  }

  // Prochaine date correspondante
  const now = new Date();
  let next: Date | undefined;
  for (let i = 0; i < 14 && !next; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const mins = now.getHours() * 60 + now.getMinutes();
    if (days.includes(d.getDay()) && (i > 0 || mins < w1 - 30)) next = d;
  }

  const dayList = days.map((d) => DAY[d]);
  const daysText = dayList.length > 1 ? `${dayList.slice(0, -1).join(", ")} ou ${dayList[dayList.length - 1]}` : dayList[0];
  return {
    text: `${daysText.charAt(0).toUpperCase() + daysText.slice(1)}, entre ${fmt(w0)} et ${fmt(w1)}`,
    next: next
      ? `${next.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} à ${fmt(w0)}`
      : undefined,
    closed: closed.map((d) => DAY[d]),
    known,
    days,
    window: [w0, w1] as [number, number],
    label: `${fmt(w0)} – ${fmt(w1)}`,
  };
}

const n = (x?: number) => String(x ?? "").replace(".", ",");
const network = (url?: string) =>
  !url ? "" : /instagram/i.test(url) ? "Instagram" : /facebook|fb\.com/i.test(url) ? "Facebook" : /tiktok/i.test(url) ? "TikTok" : "un annuaire";

// Lieux pour tes tableaux : même forme de plan, autre argumentaire
function artPlan(l: Lead, p: Profile) {
  const v = getArtVenue(l.tradeId)!;
  let channel: Channel = v.channel;
  const reasons = [v.why];
  if (channel === "visite" && !l.openPeriods?.length && instagramOf(l)) reasons.push("Horaires inconnus mais compte Instagram trouvé : un message peut ouvrir la porte avant la visite.");
  const secondary: Channel = channel === v.secondary ? "email" : v.secondary;
  const slot = bestSlot({ channel, why: v.why, days: v.days, window: v.window, avoid: v.avoid, secondary, ask: v.ask, offer: "", needs: [] }, channel, l.openPeriods);
  const fit = artFit(l);
  const facts = [...fit.reasons];
  if (l.reviews) facts.push(`${l.reviews} avis Google${l.rating ? `, note de ${n(l.rating)} / 5` : ""} : autant de personnes qui passent devant ses murs.`);
  if (slot.known && slot.closed.length) facts.push(`Fermé le ${slot.closed.join(" et le ")}.`);
  const price = priceText(p);
  return {
    channel, secondary, reasons, slot, avoid: v.avoid, ask: v.ask,
    angle: v.wall,
    facts,
    offer: `Vente directe de tes pièces${price ? `, ${price}` : ""}`,
    needs: [] as string[],
    prep: artPrep(l, p),
    likely: v.likely,
    cadence: channel === "visite"
      ? ["Le soir même : message Instagram avec la série complète.", "J+5 : repasser avec deux autres pièces.", "J+12 : dernier message, puis on classe."]
      : ["J+4 : relance courte.", `J+8 : passer en vrai avec une pièce.`, "J+15 : dernier message, puis on classe."],
  };
}

export function approachPlan(l: Lead, p: Profile, created?: string) {
  if (l.tradeId.startsWith("art-")) return artPlan(l, p);
  const t = getTrade(l.tradeId)!;
  const a = APPROACH[l.tradeId] || SHOP({ offer: "un site vitrine clair et bien placé sur Google", needs: ["les horaires", "les services", "le contact"] });

  // Canal : celui du métier, ajusté à la situation
  let channel = a.channel;
  const reasons = [a.why];
  if (l.presence === "reseaux" && /instagram/i.test(l.socialUrl || "") && channel !== "visite") {
    channel = "message";
    reasons.push("Il est actif sur Instagram : écris-lui là-bas.");
  }
  if ((l.presence === "vieux" || l.presence === "equipe") && l.audit?.email && channel === "email") {
    reasons.push(`Son e-mail est affiché sur son site : ${l.audit.email}.`);
  }
  if (channel === "email" && !l.audit?.email) {
    reasons.push("Pas d'e-mail connu : cherche-le sur sa page ou dans l'annuaire, sinon passe par un message privé.");
  }
  const secondary = channel === a.secondary ? (channel === "email" ? "message" : "email") : a.secondary;
  const slot = bestSlot(a, channel, l.openPeriods);

  // Angle
  const reviews = l.reviews || 0;
  const needs = detectNeeds(l, { created });
  const top = needs.filter((x) => x.priority <= 2).slice(0, 3);
  const cms = l.audit?.cms;
  const angle =
    l.presence === "equipe"
      ? `Son site tient la route : ne lui parle pas de site. Ouvre avec un besoin concret${top[0] ? ` : ${top[0].title.charAt(0).toLowerCase() + top[0].title.slice(1)}` : ""}.`
      : l.presence === "vieux" && cms && cms !== "WordPress"
      ? `Son site est fait avec ${cms} : impossible de le reprendre, mais c'est souvent justement ce qui le bloque (modèle figé, peu visible sur Google). Propose un site WordPress à lui, qu'il pourra faire évoluer.`
      : l.presence === "vieux"
      ? `Il a déjà investi dans un site : inutile de le convaincre qu'il en faut un. Montre-lui ce que le sien lui fait perdre.`
      : l.presence === "reseaux"
      ? `Il communique déjà sur ${network(l.socialUrl)} : il sait que la visibilité compte. Le site devient une vitrine qui lui appartient et que Google met en avant.`
      : reviews >= 30
      ? `Ses clients l'adorent (${reviews} avis), mais ceux qui le cherchent sur Google ne trouvent rien de plus que sa fiche. Tu ne lui vends pas « un site », tu lui fais gagner les clients qu'il rate.`
      : `Peu d'avis pour l'instant : l'enjeu est d'être trouvé tout court. Le site et la fiche Google travaillent ensemble pour ça.`;

  // Arguments : uniquement des faits vérifiés par le scan
  const facts: string[] = [];
  if (reviews) facts.push(`${reviews} avis Google${l.rating ? `, note de ${n(l.rating)} / 5` : ""}${l.rating && l.rating >= 4.5 ? " : excellent, à mettre en avant" : ""}.`);
  if (l.context?.rival)
    facts.push(
      `${l.context.rival.name}, à ${l.context.rival.distance < 1000 ? `${l.context.rival.distance} m` : `${n(Math.round(l.context.rival.distance / 100) / 10)} km`}, a un site${l.context.rival.reviews ? ` (${l.context.rival.reviews} avis)` : ""}.`
    );
  if (l.context?.siteShare != null && (l.context.total || 0) >= 5)
    facts.push(`${l.context.siteShare} % des ${t.label.toLowerCase()} analysées à ${l.city} ont un site correct.`);
  const act = activity(created || l.created);
  if (act)
    facts.push(
      act.years >= 15
        ? `En activité depuis ${act.since} (${act.years} ans) : une adresse installée, qui mérite une image à sa hauteur.`
        : act.years < 2
        ? `Créée en ${act.since} : tout est encore à construire, c'est le bon moment pour une image solide.`
        : `En activité depuis ${act.since} (${act.years} ans).`
    );
  if (cms)
    facts.push(
      `Son site est fait avec ${cms}${l.audit?.cmsVersion ? ` ${l.audit.cmsVersion}` : ""}${cms === "WordPress" ? " : tu peux intervenir dessus directement." : " : pas WordPress, il faudra repartir de zéro."}`
    );
  if (l.audit?.issues.length) for (const i of l.audit.issues.slice(0, 4)) facts.push(`Son site : ${i.charAt(0).toLowerCase() + i.slice(1)}.`);
  if (l.photoCount != null && l.photoCount < 5) facts.push(`Seulement ${l.photoCount} photo${l.photoCount > 1 ? "s" : ""} sur sa fiche Google.`);
  if (l.presence === "reseaux") facts.push(`Sa seule présence en ligne est sur ${network(l.socialUrl)}.`);
  if (slot.known && slot.closed.length) facts.push(`Fermé le ${slot.closed.join(" et le ")}.`);

  // Offre
  const first = top.length
    ? top.map((x) => x.title.charAt(0).toLowerCase() + x.title.slice(1)).join(", puis ")
    : l.presence === "vieux"
      ? `une refonte de son site${l.audit?.mobile === false ? ", pensée d'abord pour le téléphone" : ""}${l.audit?.https === false ? " et sécurisée" : ""}`
      : l.presence === "reseaux"
      ? `${a.offer}, relié à sa page ${network(l.socialUrl)}`
      : a.offer;

  // Préparation
  const prep: string[] = [];
  prep.push("Lire ses derniers avis Google et en retenir un à citer.");
  if (l.website) prep.push("Ouvrir son site sur ton téléphone pour constater les défauts toi-même.");
  prep.push(`Avoir deux réalisations proches de son métier à montrer${p.portfolio ? ` (${p.portfolio})` : ""}.`);
  prep.push("Retrouver le nom du dirigeant pour le demander par son nom.");
  if (channel === "visite") prep.push("Prévoir ta carte de visite.");
  if (channel === "email") prep.push(l.audit?.email ? `Écrire à ${l.audit.email}.` : "Trouver son e-mail (page Facebook, site, annuaire).");

  // Objections les plus probables
  const likely =
    (l.presence === "equipe" ? ["prestataire", "cher"] : l.presence === "vieux" ? ["deja-site", "prestataire"] : l.presence === "reseaux" ? ["facebook", "temps"] : reviews >= 50 ? ["clients", "bouche"] : ["cher", "temps"]).concat(["reflechir"]);

  const cadence =
    channel === "visite"
      ? ["Le soir même : e-mail de suivi avec tes réalisations.", "J+5 : repasser ou relancer par e-mail.", "J+12 : dernier message, puis on classe."]
      : ["J+3 : relance courte.", `J+7 : changer de canal (${CHANNEL_LABEL[secondary].toLowerCase()}).`, "J+12 : dernier message, puis on classe."];

  return { channel, secondary, reasons, slot, avoid: a.avoid, ask: a.ask, angle, facts, offer: first, needs: a.needs, prep, likely, cadence };
}
