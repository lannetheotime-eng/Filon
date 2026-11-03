// E-mails de prospection écrits métier par métier, sur un ton d'humain à humain.
// Règles : phrases courtes, une seule demande, pas de formules toutes faites
// (« je me permets », « n'hésitez pas », « j'espère que vous allez bien »), pas de listes à puces,
// un constat vérifiable (fiche Google, site), et ce que Theo propose : un accompagnement WordPress et une charte graphique.
import type { Lead, Profile } from "./types";

type Metier = {
  who?: string; // « un plombier »
  peers?: string; // pour qui Theo travaille déjà : « des artisans »
  search: string; // ce que tapent ses clients
  stake: string; // ce qui se joue pour lui en ligne
  site: string; // ce qu'un site doit faire pour lui, concrètement
  brand: string; // où sa charte graphique se voit au quotidien
  ask: string; // la demande, simple
  subject: { aucun: string; reseaux: string; vieux: string; equipe: string };
};

const ARTISAN = (o: Partial<Metier> & Pick<Metier, "search" | "site" | "brand">): Metier => ({
  stake: "La plupart des particuliers comparent trois artisans sur leur téléphone avant d'en appeler un, et ils choisissent celui dont ils voient le travail.",
  ask: "Est-ce que ça vous dirait qu'on s'appelle dix minutes cette semaine, ou que je passe vous voir entre deux chantiers ?",
  subject: { aucun: "vos chantiers en photos", reseaux: "vos chantiers, ailleurs que sur Facebook", vieux: "votre site, vu du téléphone", equipe: "votre logo sur le camion" },
  ...o,
});

const SHOP = (o: Partial<Metier> & Pick<Metier, "search" | "site" | "brand">): Metier => ({
  stake: "Avant de pousser la porte, les gens regardent les horaires, les photos et les avis. C'est souvent là que se joue la première visite.",
  ask: "Je passe dans le quartier la semaine prochaine : je peux vous montrer deux ou trois exemples en cinq minutes, au moment qui vous arrange ?",
  subject: { aucun: "une question sur votre fiche Google", reseaux: "votre page Instagram", vieux: "votre site, vu du téléphone", equipe: "vos sachets, vos cartes, votre vitrine" },
  ...o,
});

export const METIERS: Record<string, Metier> = {
  boulangerie: SHOP({ who: "une boulangerie", peers: "des commerces de quartier",
    search: "« boulangerie ouverte dimanche » ou « gâteau d'anniversaire sur commande »",
    site: "afficher les horaires du jour, les gâteaux de fête et un moyen simple de commander à l'avance",
    brand: "les sachets, les étiquettes de prix, l'ardoise et la devanture",
  }),
  boucherie: SHOP({ who: "une boucherie", peers: "des commerces de quartier",
    search: "« boucherie traiteur » avant les fêtes ou un barbecue",
    site: "présenter le traiteur, les colis et les commandes de fêtes, avec un formulaire de commande",
    brand: "le papier d'emballage, les étiquettes, la carte traiteur et la vitrine",
    subject: { aucun: "vos commandes de fêtes", reseaux: "vos commandes de fêtes", vieux: "votre site, vu du téléphone", equipe: "votre carte traiteur" },
  }),
  fleuriste: SHOP({ who: "un fleuriste", peers: "des commerces de quartier",
    search: "« fleuriste livraison » ou « fleurs mariage » à la dernière minute",
    site: "montrer vos compositions, les mariages et les deuils, et prendre les commandes avec livraison",
    brand: "les cartes jointes aux bouquets, le papier, les sacs et la camionnette",
    subject: { aucun: "vos compositions en ligne", reseaux: "vos bouquets, au-delà d'Instagram", vieux: "votre site, vu du téléphone", equipe: "vos cartes et vos emballages" },
  }),
  restaurant: SHOP({ who: "un restaurant", peers: "des restaurants et des commerces",
    search: "« restaurant ce soir » ou « où manger près de… »",
    stake: "Les gens choisissent un restaurant en trente secondes : la carte, les photos, et un bouton pour réserver.",
    site: "mettre la carte à jour facilement, de vraies photos des plats et la réservation en ligne",
    brand: "la carte, les menus, les tickets, la vitrine et les réseaux",
    ask: "Je peux passer un après-midi, hors service, vous montrer deux restaurants que j'ai accompagnés ?",
    subject: { aucun: "votre carte en ligne", reseaux: "votre carte, ailleurs que sur Instagram", vieux: "votre site, vu du téléphone", equipe: "votre carte et vos menus" },
  }),
  coiffeur: SHOP({ who: "un coiffeur", peers: "des salons et des commerces",
    search: "« coiffeur » avec un créneau dispo le samedi",
    stake: "Une cliente qui ne trouve ni vos tarifs ni un créneau en ligne réserve ailleurs, souvent sans même appeler.",
    site: "afficher vos tarifs, vos réalisations et la prise de rendez-vous",
    brand: "les cartes de fidélité, la vitrine, les tarifs affichés et Instagram",
    ask: "Est-ce que je peux passer un mardi matin, au calme, vous montrer ce que je fais pour d'autres salons ?",
    subject: { aucun: "vos tarifs et vos créneaux en ligne", reseaux: "votre salon, ailleurs qu'Instagram", vieux: "votre site, vu du téléphone", equipe: "vos cartes de fidélité" },
  }),
  beaute: SHOP({ who: "un institut de beauté", peers: "des instituts et des commerces",
    search: "« institut de beauté » avec les tarifs et une réservation en ligne",
    stake: "Une cliente qui ne trouve ni vos soins ni vos tarifs en ligne réserve ailleurs.",
    site: "présenter les soins et les tarifs, et permettre de réserver",
    brand: "les cartes cadeaux, la carte des soins, la vitrine et Instagram",
    ask: "Est-ce que je peux passer un matin en semaine vous montrer ce que je fais pour d'autres instituts ?",
    subject: { aucun: "votre carte des soins en ligne", reseaux: "votre institut, ailleurs qu'Instagram", vieux: "votre site, vu du téléphone", equipe: "vos cartes cadeaux" },
  }),
  garage: SHOP({ who: "un garage", peers: "des artisans et des commerces",
    search: "« garage de confiance » ou « vidange pas cher »",
    stake: "Un garage, c'est d'abord une question de confiance : les clients veulent voir qui vous êtes, vos prestations et les avis avant de vous laisser leur voiture.",
    site: "présenter les prestations avec des prix indicatifs et permettre de demander un rendez-vous",
    brand: "les devis, les factures, l'enseigne et les véhicules de courtoisie",
    ask: "Je peux passer en début d'après-midi, quand c'est plus calme, vous montrer deux exemples ?",
    subject: { aucun: "les avis de vos clients", reseaux: "les avis de vos clients", vieux: "votre site, vu du téléphone", equipe: "vos devis et votre enseigne" },
  }),
  plombier: ARTISAN({ who: "un plombier", peers: "des artisans", search: "« plombier » avec une fuite et pas de temps à perdre", site: "montrer vos interventions, votre zone et un moyen rapide de demander un devis", brand: "le camion, les devis, les factures et la carte de visite" }),
  electricien: ARTISAN({ who: "un électricien", peers: "des artisans", search: "« électricien » pour une mise aux normes ou une panne", site: "montrer vos réalisations, vos certifications et votre zone, avec une demande de devis rapide", brand: "le camion, les devis, les factures et la carte de visite" }),
  macon: ARTISAN({ who: "un maçon", peers: "des artisans", search: "« maçon » pour une extension ou une terrasse", site: "montrer vos chantiers en photos avant / après et recevoir des demandes de devis claires", brand: "le camion, les panneaux de chantier et les devis" }),
  menuisier: ARTISAN({ who: "un menuisier", peers: "des artisans", search: "« menuisier sur mesure » pour une cuisine ou un dressing", site: "mettre en valeur vos réalisations sur mesure, c'est ce qui fait la différence", brand: "le camion, les devis, les plans et la carte de visite", subject: { aucun: "vos réalisations sur mesure", reseaux: "vos réalisations, ailleurs que sur Facebook", vieux: "votre site, vu du téléphone", equipe: "votre logo et vos devis" } }),
  peintre: ARTISAN({ who: "un peintre", peers: "des artisans", search: "« peintre en bâtiment » avec des photos de chantiers", site: "montrer vos chantiers avant / après et recevoir des demandes de devis", brand: "le camion, les bâches de chantier et les devis" }),
  paysagiste: ARTISAN({ who: "un paysagiste", peers: "des artisans", search: "« paysagiste » pour un jardin ou de l'entretien", site: "montrer vos jardins en photos et proposer l'entretien à l'année", brand: "le camion, les devis et les panneaux de chantier" }),
  photographe: { who: "un photographe", peers: "des indépendants",
    search: "« photographe mariage » ou « photographe portrait »",
    stake: "On choisit un photographe sur ses images, mais aussi sur l'image qu'il renvoie : un site lent ou un portfolio Instagram noyé dans le reste fait perdre des réservations.",
    site: "un portfolio rapide et soigné, avec vos tarifs indicatifs et une prise de contact simple",
    brand: "le logo, la signature des photos, les devis et la carte de visite",
    ask: "Ça vous dirait qu'on prenne un café pour en parler ?",
    subject: { aucun: "votre portfolio", reseaux: "votre portfolio, au-delà d'Instagram", vieux: "votre portfolio, vu du téléphone", equipe: "votre identité de photographe" },
  },
  avocat: { who: "un avocat", peers: "des cabinets et des professions libérales",
    search: "« avocat droit de la famille » ou « avocat licenciement » suivi de la ville",
    stake: "Un justiciable cherche d'abord un avocat qui traite son problème précis. S'il ne voit pas clairement vos domaines d'intervention, il passe au cabinet suivant.",
    site: "présenter clairement vos domaines d'intervention et vos honoraires, avec une prise de rendez-vous, dans le respect des règles de la profession",
    brand: "le papier à en-tête, les conclusions, la plaque et la signature e-mail",
    ask: "Seriez-vous disponible pour un échange de quinze minutes, au cabinet ou par téléphone, dans les prochaines semaines ?",
    subject: { aucun: "vos domaines d'intervention en ligne", reseaux: "la présence en ligne du cabinet", vieux: "le site du cabinet", equipe: "l'identité visuelle du cabinet" },
  },
  notaire: { who: "un notaire", peers: "des professions libérales",
    search: "« notaire succession » ou « notaire achat immobilier »",
    stake: "Vos clients arrivent souvent stressés par une succession ou un premier achat. Ils cherchent un office qui inspire confiance et des réponses claires sur les démarches.",
    site: "présenter l'office, l'équipe et les démarches courantes (pièces à préparer, rendez-vous), dans un ton sobre et conforme à la déontologie",
    brand: "le papier à en-tête, les chemises de dossiers, la plaque et la signature e-mail",
    ask: "Accepteriez-vous un rendez-vous de quinze minutes pour que je vous présente mon travail ?",
    subject: { aucun: "la présence en ligne de l'office", reseaux: "la présence en ligne de l'office", vieux: "le site de l'office", equipe: "l'identité visuelle de l'office" },
  },
};

const GENERIC: Metier = SHOP({
  search: "votre métier suivi de la ville",
  site: "présenter clairement ce que vous faites, vos horaires et un moyen simple de vous contacter",
  brand: "vos cartes, vos devis et votre devanture",
});

const formal = (id: string) => id === "avocat" || id === "notaire";
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function sign(p: Profile) {
  return [p.firstName, [p.studio, "directeur artistique"].filter(Boolean).join(" · "), p.phone, p.site].filter(Boolean).join("\n");
}

function whoAmI(p: Profile, m: Metier) {
  if (p.about?.trim()) return p.about.trim();
  return `Je suis ${p.firstName || "…"}, directeur artistique indépendant${p.studio ? ` (${p.studio})` : ""}. Je crée des chartes graphiques et des sites WordPress pour ${m.peers || "des indépendants"}, et je reste leur seul interlocuteur ensuite.`;
}

const note = (l: Lead) => (l.reviews ? `${l.reviews} avis${l.rating ? `, ${String(l.rating).replace(".", ",")} de moyenne` : ""}` : "");

// Le constat, en une ou deux phrases, à partir de ce qui a vraiment été vu
function observation(l: Lead, m: Metier, f: boolean) {
  const who = m.who || "votre activité";
  const n = note(l);
  if (l.presence === "aucun") return `En cherchant ${who} à ${l.city}, je suis tombé sur votre fiche Google${n ? ` (${n})` : ""}. ${f ? "En revanche" : "Par contre"}, pas de site : quelqu'un qui veut en savoir plus avant ${f ? "de prendre rendez-vous" : "de venir"} s'arrête là.`;
  if (l.presence === "reseaux") return `En cherchant ${who} à ${l.city}, je suis tombé sur ${l.name}${n ? ` (${n})` : ""}. Votre page sur les réseaux est active, mais c'est la seule chose qu'on trouve, et elle ne vous appartient pas vraiment.`;
  if (l.presence === "vieux") {
    const deep = l.deep?.checks.filter((c) => c.status === "fail").slice(0, 2).map((c) => lc(c.title));
    const pts = deep?.length ? deep : (l.audit?.issues || []).slice(0, 2).map(lc);
    const wp = l.audit?.cms === "WordPress" || l.deep?.cms === "WordPress";
    return `J'ai regardé ${f ? "votre site" : "votre site"} depuis mon téléphone. ${pts.length ? `J'ai relevé ${pts.length > 1 ? "deux points" : "un point"} : ${pts.join(", et ")}.` : "Il a pris quelques années."}${wp ? " Bonne nouvelle : il est sous WordPress, donc pas besoin de tout reprendre de zéro." : ""}`;
  }
  const wp = l.audit?.cms === "WordPress" || l.deep?.cms === "WordPress";
  return wp
    ? `Votre site est sous WordPress et il tient la route. Je ne viens donc pas vous proposer de le refaire, mais de m'en occuper : mises à jour, sécurité, sauvegardes, et les petites évolutions qu'on repousse toujours.`
    : `Votre site est correct, je ne viens pas vous parler de le refaire. Je pense plutôt à ce qu'on voit tous les jours : ${m.brand}.`;
}

export function metierEmails(l: Lead, p: Profile, opts: { reportUrl?: string; trade: string }) {
  const m = METIERS[l.tradeId] || GENERIC;
  const f = formal(l.tradeId);
  const hello = f ? "Maître," : "Bonjour,";
  const link = p.portfolio ? `\n\nQuelques réalisations : ${p.portfolio}` : p.site ? `\n\nMon travail : ${p.site}` : "";
  const report = l.presence === "vieux" && opts.reportUrl ? `\n\nJ'ai noté ce que j'ai relevé, avec une solution pour chaque point : ${opts.reportUrl}` : "";
  const offer =
    l.presence === "equipe"
      ? `L'accompagnement WordPress se fait au mois${p.prices?.maintenance ? ` (à partir de ${p.prices.maintenance} € par mois)` : ""}. Et si un jour l'envie vient, une charte graphique pour que ${m.brand} parlent le même langage.`
      : `Pour vous, ce serait une charte graphique, déclinée sur ${m.brand}, et un site WordPress pour ${m.site}.`;

  const first = {
    label: "Premier contact",
    subject: l.presence === "equipe" && (l.audit?.cms === "WordPress" || l.deep?.cms === "WordPress") ? (f ? "le site WordPress du cabinet" : "votre site WordPress") : m.subject[l.presence],
    body: `${hello}

${observation(l, m, f)}${l.presence === "equipe" ? "" : `\n\n${m.stake}`}

${whoAmI(p, m)} ${offer}${report}${link}

${m.ask}

${sign(p)}`,
  };

  const relance = {
    label: "Relance (J+4)",
    subject: `Re : ${first.subject}`,
    body: `${hello}

Je reviens vers vous au sujet de mon message de la semaine dernière. Si ce n'est pas le moment, dites-le-moi simplement, je n'insisterai pas.

${p.firstName}`,
  };

  const last = {
    label: "Dernier message (J+12)",
    subject: `${l.name}`,
    body: `${hello}

Pas de nouvelles, donc je n'insiste pas. Si un jour vous avez besoin d'un coup de main pour votre site ou votre image, vous savez où me trouver.

Bonne continuation,
${p.firstName}`,
  };

  const after = {
    label: "Après une visite",
    subject: f ? `Suite à notre échange` : `Merci pour tout à l'heure`,
    body: `${hello}

Merci de m'avoir accordé ce moment${f ? "" : " aujourd'hui"}. Comme promis, voici quelques réalisations${p.portfolio ? ` : ${p.portfolio}` : p.site ? ` : ${p.site}` : ""}.

Je vous prépare une proposition pour ${l.name}, avec les priorités dont on a parlé. Je vous l'envoie d'ici la fin de semaine.

${sign(p)}`,
  };

  return [first, relance, last, after];
}
