import type { Lead, Profile } from "./types";
import { getTrade } from "./trades";

const ARTISANS = ["plombier", "electricien", "macon", "menuisier", "peintre", "paysagiste"];

// Ce qu'on demande au gérant pour chiffrer la valeur d'un client
export function ticketQuestion(tradeId: string) {
  if (ARTISANS.includes(tradeId)) return { label: "Un chantier moyen lui rapporte", ask: "Combien vous rapporte un chantier moyen ?" };
  if (tradeId === "avocat" || tradeId === "notaire") return { label: "Un dossier moyen lui rapporte", ask: "Combien représente un dossier moyen pour le cabinet ?" };
  if (tradeId === "photographe") return { label: "Une prestation moyenne lui rapporte", ask: "Combien vous rapporte une prestation moyenne ?" };
  if (tradeId === "fleuriste") return { label: "Une commande moyenne lui rapporte", ask: "Combien rapporte une commande moyenne (mariage, deuil, événement) ?" };
  if (tradeId === "coiffeur" || tradeId === "beaute") return { label: "Une cliente fidèle lui rapporte, sur un an", ask: "Une cliente fidèle, elle vous rapporte combien sur un an ?" };
  return { label: "Un client fidèle lui rapporte, sur un an", ask: "Un client fidèle, il vous rapporte combien sur un an ?" };
}

// Rentabilité : combien de clients en plus pour rembourser l'investissement
export function roi(price: number, ticket: number) {
  if (!price || !ticket) return null;
  const n = Math.max(1, Math.ceil(price / ticket));
  const perMonth = n / 12;
  return {
    n,
    text:
      `Avec ${price.toLocaleString("fr-FR")} € investis, il suffit de ${n} ${n > 1 ? "clients" : "client"} en plus pour être remboursé` +
      (n <= 12 ? `, soit ${perMonth <= 1 ? "moins d'un client par mois" : `${Math.ceil(perMonth)} par mois`} pendant un an.` : "."),
  };
}

// La preuve que le gérant voit lui-même, sur son propre téléphone
export function liveProof(l: Lead) {
  const t = getTrade(l.tradeId)!;
  const steps: string[] = [`« Prenez votre téléphone et tapez ${t.singular} ${l.city} dans Google Maps. »`];
  const rival = l.context?.rival;
  if (l.presence === "aucun" || l.presence === "reseaux") {
    steps.push(
      rival
        ? `« Regardez ${rival.name} : il a un bouton Site web. Vous, vos clients n'ont que votre fiche. »`
        : "« Regardez les fiches qui ont un bouton Site web : ce sont elles qu'on ouvre en premier. »"
    );
    if (l.presence === "reseaux") steps.push("« Combien de vos clients ne sont pas sur Facebook ou Instagram ? Eux ne vous voient pas. »");
  }
  if (l.presence === "vieux" || l.presence === "equipe") {
    steps.push("« Ouvrez maintenant votre site sur ce téléphone. »");
    if (l.audit?.mobile === false) steps.push("« Il faut zoomer pour lire : la plupart de vos clients repartent à ce moment-là. »");
    if (l.audit?.https === false) steps.push("« Regardez la barre d'adresse : votre navigateur affiche Non sécurisé. »");
    if (l.audit?.lastYear) steps.push(`« Tout en bas : ${l.audit.lastYear}. Pour un client, ça veut dire que l'entreprise n'est peut-être plus active. »`);
  }
  if (l.photoCount != null && l.photoCount < 5) steps.push(`« Et sur votre fiche, ${l.photoCount} photo${l.photoCount > 1 ? "s" : ""} : c'est la première image qu'on a de vous. »`);
  return steps;
}

export function closingLine(firstNeed: string | undefined, price: number | undefined) {
  // « Noël : flyer et affiche… » devient « le flyer et l'affiche…, pour Noël »
  let what = "l'essentiel";
  if (firstNeed?.includes(" : ")) {
    const [moment, item] = firstNeed.split(" : ");
    what = `${item}, pour ${moment.charAt(0) === "L" && moment.startsWith("L'") ? "l'" + moment.slice(2) : moment.replace(/^(La|Le|Les) /, (m) => m.toLowerCase())}`;
  } else if (firstNeed) what = firstNeed.charAt(0).toLowerCase() + firstNeed.slice(1);
  return `« Je vous propose de commencer par ${what}${price ? `, pour ${price.toLocaleString("fr-FR")} €` : ""}. Vous jugez sur pièce, et on voit la suite ensemble. Je vous prépare ça ? »`;
}

export const lines = (s?: string) => (s || "").split("\n").map((x) => x.trim()).filter(Boolean);

export const GUARANTEE_IDEAS = [
  "Sans engagement de durée",
  "Paiement en 3 fois sans frais",
  "Retouches jusqu'à validation",
  "Je m'occupe de tout, vous validez",
  "Le site vous appartient, sans abonnement obligatoire",
  "Interlocuteur unique, du premier rendez-vous à la mise en ligne",
];

export type _P = Profile;
