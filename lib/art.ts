// Prospection « Tableaux » : trouver les lieux qui achèteront tes œuvres pour leurs murs.
// Vente directe uniquement. Rien n'est inventé : les arguments viennent de la fiche Google,
// du registre et de ce que tu renseignes dans Réglages.
import type { Lead, Profile } from "./types";
import { activity } from "./site";

type Ch = "visite" | "email" | "message";
const h = (hh: number, mm = 0) => hh * 60 + mm;

export type ArtVenue = {
  id: string;
  label: string; // pluriel
  singular: string;
  query: string; // requête Google Places
  // Approche
  channel: Ch;
  secondary: Ch;
  days: number[];
  window: [number, number];
  avoid: string;
  ask: string;
  why: string; // pourquoi ce canal
  // Argumentaire
  wall: string; // ce que tes tableaux apportent à ce lieu
  pick: string; // quelles pièces apporter
  compliment: string; // accroche sincère, à adapter
  likely: string[]; // objections les plus probables
};

const SHOP = { channel: "visite" as Ch, secondary: "message" as Ch, days: [2, 3, 4], window: [h(14, 30), h(17)] as [number, number], ask: "Demande le ou la gérante, c'est lui ou elle qui choisit la déco.", why: "Un tableau se vend en vrai : la matière, le format, l'effet sur le mur. Passe avec une pièce sous le bras." };
const RESTO = { ...SHOP, window: [h(15), h(17, 30)] as [number, number], avoid: "les services du midi et du soir", ask: "Demande le patron ou la patronne, hors service." };

export const ART_VENUES: ArtVenue[] = [
  {
    id: "art-japonais", label: "Restos japonais et ramen", singular: "restaurant japonais", query: "restaurant japonais ramen",
    ...RESTO, days: [2, 3, 4],
    wall: "Un tableau à l'univers japonais prolonge l'expérience de la carte : les clients le prennent en photo, et la photo circule sur Instagram avec le nom du resto.",
    pick: "deux pièces à thème Japon (rue, cuisine, personnages) dans des formats moyens, faciles à accrocher en salle",
    compliment: "J'adore l'ambiance de votre salle, on sent que l'univers est soigné.",
    likely: ["deja-deco", "budget", "proprio"],
  },
  {
    id: "art-asie", label: "Restos coréens et asiatiques", singular: "restaurant asiatique", query: "restaurant coréen asiatique",
    ...RESTO,
    wall: "Des murs qui racontent un univers, c'est ce qui fait revenir et ce qui se partage en photo.",
    pick: "deux pièces colorées, très graphiques, qui ressortent même en photo de téléphone",
    compliment: "Votre déco a une vraie personnalité, ça change des restos tous pareils.",
    likely: ["style", "budget", "proprio"],
  },
  {
    id: "art-bar", label: "Bars et bars à cocktails", singular: "bar", query: "bar à cocktails",
    ...SHOP, days: [2, 3, 4], window: [h(17), h(18, 30)], avoid: "les soirs de forte affluence et le week-end",
    wall: "Dans un bar, les murs font partie de l'ambiance : une pièce forte devient un repère (« on se retrouve sous le tableau »).",
    pick: "une grande pièce qui claque et une plus petite pour le comptoir ou les toilettes",
    compliment: "L'ambiance est top ici, et vous avez de beaux murs à habiller.",
    likely: ["deja-deco", "budget", "mail"],
  },
  {
    id: "art-cafe", label: "Cafés et coffee shops", singular: "café", query: "coffee shop",
    ...SHOP, window: [h(14, 30), h(16, 30)], avoid: "le rush du matin et du midi",
    wall: "Les clients y restent longtemps, ordinateur ou café à la main : ils ont le temps de regarder les murs, et de demander qui a fait le tableau.",
    pick: "deux formats moyens, ambiance douce ou pop selon le lieu",
    compliment: "C'est un des cafés les plus agréables du coin, on a envie d'y rester.",
    likely: ["budget", "place", "proprio"],
  },
  {
    id: "art-concept", label: "Concept stores", singular: "concept store", query: "concept store",
    ...SHOP, window: [h(10, 30), h(12)], avoid: "le samedi",
    wall: "Un concept store vend une sélection : tes tableaux aux murs renforcent son identité, et peuvent intéresser ses clients.",
    pick: "trois pièces de styles proches pour montrer une vraie série",
    compliment: "Votre sélection est super cohérente, on sent un vrai regard.",
    likely: ["depot", "budget", "style"],
  },
  {
    id: "art-deco", label: "Boutiques de déco", singular: "boutique de déco", query: "boutique décoration intérieure",
    ...SHOP, window: [h(10, 30), h(12)], avoid: "le samedi",
    wall: "Leurs clients viennent chercher ce qu'on ne trouve pas ailleurs : des pièces originales d'un artiste local, c'est exactement ça.",
    pick: "trois pièces de formats différents pour montrer la gamme",
    compliment: "Vous avez une sélection vraiment différente des grandes enseignes.",
    likely: ["depot", "marge", "style"],
  },
  {
    id: "art-manga", label: "Boutiques manga et BD", singular: "boutique manga", query: "boutique manga",
    ...SHOP, window: [h(14), h(16, 30)], avoid: "le samedi et les jours de sortie",
    wall: "Leur clientèle est exactement ton public : tes pièces y sont à leur place, aux murs comme à la vente.",
    pick: "tes pièces les plus manga, dont une en grand format pour le mur principal",
    compliment: "Je viens souvent ici, c'est une des meilleures boutiques du coin.",
    likely: ["depot", "marge", "place"],
  },
  {
    id: "art-galerie", label: "Galeries d'art", singular: "galerie", query: "galerie d'art",
    channel: "email", secondary: "visite", days: [2, 3], window: [h(10), h(12)], avoid: "les jours de vernissage",
    ask: "Écris au galeriste ou au directeur artistique, par son nom.",
    why: "Les galeries reçoivent beaucoup de demandes : un e-mail court avec tes visuels et ton Instagram est la règle.",
    wall: "Une galerie cherche des artistes qui ont un univers reconnaissable et une communauté : montre les deux.",
    pick: "un dossier de cinq à huit visuels de la même série, avec formats et prix",
    compliment: "J'ai beaucoup aimé votre dernière exposition.",
    likely: ["depot", "style", "mail"],
  },
  {
    id: "art-tatouage", label: "Tatoueurs", singular: "salon de tatouage", query: "salon de tatouage",
    ...SHOP, days: [2, 3], window: [h(11), h(13)], avoid: "pendant les séances (demande quand ils sont libres)",
    secondary: "message",
    wall: "Un salon de tatouage, c'est une galerie d'images : les clients attendent, regardent les murs, et partagent un univers graphique proche du tien.",
    pick: "deux pièces très graphiques, contrastées",
    compliment: "Le travail affiché ici est vraiment fort.",
    likely: ["style", "budget", "place"],
  },
  {
    id: "art-barbier", label: "Barbiers", singular: "barber shop", query: "barber shop",
    ...SHOP, days: [2, 3], window: [h(10), h(11, 30)], avoid: "le samedi et les fins de journée",
    wall: "Les clients passent vingt minutes face au miroir : le mur derrière eux, c'est ce qu'ils voient… et ce qu'ils prennent en photo.",
    pick: "deux pièces au style affirmé, format moyen",
    compliment: "Votre salon a un vrai style, ça se voit dès l'entrée.",
    likely: ["budget", "deja-deco", "proprio"],
  },
  {
    id: "art-hotel", label: "Hôtels de caractère", singular: "hôtel", query: "hôtel boutique",
    channel: "email", secondary: "visite", days: [2, 3], window: [h(10), h(11, 30)], avoid: "les heures d'arrivée et de départ",
    ask: "Demande le nom du directeur ou de la personne en charge de la déco.",
    why: "La décision se prend rarement à l'accueil : un e-mail au directeur, puis un rendez-vous.",
    wall: "Un hôtel de caractère vend une expérience locale : des œuvres d'un artiste de la ville dans le lobby ou les chambres, c'est un argument pour ses clients.",
    pick: "une sélection de visuels pensée par pièce (lobby, couloirs, chambres)",
    compliment: "Votre hôtel a une vraie identité, ça se ressent dans la déco.",
    likely: ["proprio", "budget", "mail"],
  },
  {
    id: "art-jeux", label: "Bars à jeux et gaming", singular: "bar à jeux", query: "bar à jeux",
    ...SHOP, window: [h(15), h(17, 30)], avoid: "les soirs de tournoi et le week-end",
    wall: "Un public geek et pop culture : un univers manga sur les murs leur parle immédiatement.",
    pick: "tes pièces les plus pop et manga",
    compliment: "Le concept est génial, c'est exactement le genre d'endroit qui manquait.",
    likely: ["budget", "deja-deco", "proprio"],
  },
  {
    id: "art-disquaire", label: "Disquaires et boutiques vintage", singular: "disquaire", query: "disquaire vinyle",
    ...SHOP, window: [h(14), h(16, 30)], avoid: "le samedi",
    wall: "Un public qui aime l'objet, l'image, la pochette : la sérigraphie et l'affiche lui parlent.",
    pick: "deux pièces dans un esprit affiche ou pochette",
    compliment: "Votre boutique a une vraie âme, on pourrait y passer des heures.",
    likely: ["depot", "place", "budget"],
  },
];

export const getArtVenue = (id: string) => ART_VENUES.find((v) => v.id === id);
export const isArt = (tradeId?: string) => !!tradeId && tradeId.startsWith("art-");

// Univers proche du tien : mots-clés dans le nom ou la catégorie Google
const UNIVERSE = /japon|japan|tokyo|osaka|kyoto|nippon|ramen|sushi|izakaya|udon|gyoza|bento|matcha|manga|otaku|anime|kawaii|sakura|ninja|samoura|samurai|geek|r[ée]tro|arcade|pixel|tattoo|tatou|ink|vinyl|street|pop|cor[ée]e|korea|seoul|kimchi|bao|dim sum|neon|n[ée]on|comics|bd/i;

export function instagramOf(l: Lead) {
  return [l.socialUrl, l.website].find((u) => u && /instagram\.com/i.test(u));
}

// Pourquoi ce lieu est une bonne cible : uniquement des faits observés
export function artFit(l: Lead) {
  const reasons: string[] = [];
  let score = 0;
  const text = `${l.name} ${l.category || ""}`;
  const universe = UNIVERSE.test(text);
  if (universe) { score += 40; reasons.push("Univers proche du tien"); }
  const reviews = l.reviews || 0;
  if (reviews >= 300) { score += 30; reasons.push(`Très fréquenté (${reviews} avis) : tes tableaux seront vus`); }
  else if (reviews >= 80) { score += 18; reasons.push(`Bien fréquenté (${reviews} avis)`); }
  if ((l.rating || 0) >= 4.5 && reviews >= 30) { score += 10; reasons.push(`Note de ${String(l.rating).replace(".", ",")} : un lieu soigné`); }
  if (instagramOf(l)) { score += 12; reasons.push("Actif sur Instagram : ils aiment l'image"); }
  const act = activity(l.created);
  if (act && act.years < 2) { score += 15; reasons.push(`Ouvert en ${act.since} : la déco se construit encore`); }
  else if (act && act.years >= 12) { score += 5; reasons.push(`Installé depuis ${act.since} : un coup de frais aux murs`); }
  return { score, universe, reasons, insta: !!instagramOf(l) };
}

const lines = (s?: string) => (s || "").split("\n").map((x) => x.trim()).filter(Boolean);
const eur = (n?: number) => (n != null && !isNaN(n) ? n.toLocaleString("fr-FR") + " €" : "");

export function priceText(p: Profile) {
  const a = p.art || {};
  if (a.priceFrom && a.priceTo) return `de ${eur(a.priceFrom)} à ${eur(a.priceTo)}`;
  if (a.priceFrom) return `à partir de ${eur(a.priceFrom)}`;
  return "";
}

const handle = (p: Profile) => {
  const h = (p.art?.instagram || "").trim();
  if (!h) return "";
  return h.startsWith("http") ? h : `@${h.replace(/^@/, "")}`;
};
const instaUrl = (p: Profile) => {
  const h = (p.art?.instagram || "").trim().replace(/^@/, "");
  return !h ? "" : h.startsWith("http") ? h : `instagram.com/${h}`;
};
const style = (p: Profile) => p.art?.style?.trim() || "des tableaux";
const me = (p: Profile) => p.firstName || "moi";

// Les étapes de l'approche, côté tableaux
export function artSteps(l: Lead, p: Profile) {
  const v = getArtVenue(l.tradeId)!;
  const price = priceText(p);
  const extras = lines(p.art?.extras);
  return [
    { title: "Arriver avec une pièce", text: `Viens avec ${v.pick}. Le tableau fait le pitch à ta place : on ne vend pas une œuvre en photo.` },
    { title: "Lui montrer chez lui", text: "Propose de poser la pièce contre le mur, là où elle irait. Il ne s'imagine plus le tableau : il le voit chez lui, et c'est là que la décision se prend." },
    { title: "Prouver ton univers", text: `Ouvre ton Instagram${handle(p) ? ` (${handle(p)})` : ""} sur ton téléphone : la série complète, et si tu l'as, une photo d'une de tes pièces déjà accrochée chez quelqu'un.` },
    { title: "Annoncer le prix simplement", text: price ? `Pièces ${price}${p.art?.formats ? `, formats : ${p.art.formats}` : ""}.${extras.length ? ` ${extras.join(". ")}.` : ""}` : "Renseigne ta fourchette de prix dans Réglages › Tes tableaux." },
    { title: "Conclure", text: "« Celle-ci, ou on part sur une série de deux ou trois pour ce mur ? » Une question à choix, pas « vous en pensez quoi ? »." },
  ];
}

export function artScript(l: Lead, p: Profile) {
  const v = getArtVenue(l.tradeId)!;
  const price = priceText(p);
  return [
    { step: "En entrant", text: `Bonjour, je suis ${me(p)}, je fais ${style(p)} ici à ${l.city}. Est-ce que je peux voir le ou la responsable deux minutes, quand vous aurez un moment ?` },
    { step: "L'accroche", text: `${v.compliment} Je me suis dit que mes tableaux auraient leur place sur vos murs.` },
    { step: "Montrer", text: `(Tu poses la pièce contre le mur.) Regardez ce que ça donne ici. ${v.wall.split(":")[0]}.` },
    { step: "La preuve", text: `Voilà le reste de la série${handle(p) ? `, tout est sur mon Instagram ${handle(p)}` : ""}. Ce sont des pièces originales, faites ici.` },
    { step: "Le prix", text: price ? `Les pièces sont ${price}. ${lines(p.art?.extras)[0] ? lines(p.art?.extras)[0] + "." : ""}` : "Les pièces sont à [ton prix]." },
    { step: "Conclure", text: "Vous préférez celle-ci, ou je vous en apporte deux ou trois pour composer le mur ?" },
    { step: "S'il hésite", text: "Pas de souci. Je vous laisse ma carte et je repasse la semaine prochaine avec deux autres pièces, comme ça vous comparez en vrai." },
  ];
}

export function artMessages(l: Lead, p: Profile) {
  const v = getArtVenue(l.tradeId)!;
  const price = priceText(p);
  return [
    {
      label: "Premier message Instagram",
      body: `Bonjour ! Je suis ${me(p)}, je fais ${style(p)} à ${l.city}${handle(p) ? ` (${handle(p)})` : ""}. ${v.compliment} Je pense que mes pièces iraient super bien chez ${l.name}. Je peux passer vous en montrer une en vrai, sans engagement ?`,
    },
    {
      label: "Relance (J+5)",
      body: `Re-bonjour ! Je me permets de revenir vers vous pour mes tableaux. Je passe dans le quartier ${["mardi", "mercredi", "jeudi"][l.name.length % 3]} après-midi : je peux vous en montrer une ou deux, ça prend cinq minutes.`,
    },
    {
      label: "Après la visite",
      body: `Merci pour l'accueil ! Comme promis, voici la série complète${instaUrl(p) ? ` : ${instaUrl(p)}` : ""}.${price ? ` Les pièces sont ${price}.` : ""} Dites-moi celles qui vous plaisent pour votre mur, je vous les apporte.`,
    },
  ];
}

export function artEmails(l: Lead, p: Profile) {
  const v = getArtVenue(l.tradeId)!;
  const price = priceText(p);
  const sig = [p.firstName, handle(p) ? `Instagram : ${handle(p)}` : "", p.phone, p.email].filter(Boolean).join("\n");
  return [
    {
      label: "Premier contact",
      subject: `Des tableaux pour les murs de ${l.name}`,
      body: `Bonjour,

Je suis ${me(p)}, je fais ${style(p)} à ${l.city}.

${v.compliment} ${v.wall}

Vous pouvez voir mon travail ici${instaUrl(p) ? ` : ${instaUrl(p)}` : " (visuels en pièce jointe)"}.${price ? ` Les pièces sont ${price}${p.art?.formats ? `, en ${p.art.formats}` : ""}.` : ""}

Je peux passer vous en montrer une ou deux en vrai, sur le mur où elles iraient : cela prend cinq minutes.

Belle journée,
${sig}`,
    },
    {
      label: "Relance",
      subject: `Re : des tableaux pour ${l.name}`,
      body: `Bonjour,

Je me permets de revenir vers vous au sujet de mes tableaux. Si l'idée vous parle, je passe vous en montrer deux en vrai la semaine prochaine : dites-moi le jour qui vous arrange.

${sig}`,
    },
  ];
}

// Réponses aux objections, en vente directe
export function artObjections(p: Profile) {
  return [
    { id: "deja-deco", q: "« On a déjà notre déco. »", a: "Justement, je ne viens pas tout changer : une seule pièce bien placée suffit à donner du relief. On regarde ensemble le mur qui manque un peu de vie ?" },
    { id: "budget", q: "« On n'a pas de budget déco. »", a: `On peut commencer par une seule pièce${p.art?.priceFrom ? `, à partir de ${eur(p.art.priceFrom)}` : ""}. C'est un achat unique, qui reste des années et que vos clients photographient.` },
    { id: "proprio", q: "« C'est le patron / le propriétaire qui décide. »", a: "Bien sûr. Je peux vous laisser une photo de la pièce sur votre mur pour la lui montrer ? Et quel jour est-il là, que je repasse ?" },
    { id: "style", q: "« Ce n'est pas trop notre style. »", a: "Je comprends. J'ai d'autres séries : qu'est-ce qui irait le mieux avec votre lieu, selon vous ? Je reviens avec deux pièces plus proches." },
    { id: "depot", q: "« On ne travaille qu'en dépôt-vente. »", a: "Je propose la vente directe : vous choisissez une pièce, elle est à vous. Si vous voulez commencer petit, prenons un petit format." },
    { id: "marge", q: "« Comment je me rémunère ? »", a: "Ici je vous propose la pièce pour vos murs, pas à la revente. Si vous voulez en revendre, on en reparle à part." },
    { id: "place", q: "« On n'a pas de place. »", a: "Un petit format au comptoir, dans l'entrée ou aux toilettes marche très bien, et c'est souvent là qu'on le remarque le plus." },
    { id: "mail", q: "« Envoyez-moi un mail. »", a: "Avec plaisir. Je vous envoie la série ce soir, et je repasse jeudi avec la pièce que vous aurez préférée, d'accord ?" },
  ];
}

export function artPrep(l: Lead, p: Profile) {
  const v = getArtVenue(l.tradeId)!;
  const prep = [
    `Choisir ${v.pick}.`,
    instagramOf(l) ? "Regarder leur Instagram : repère les murs nus ou ternes sur leurs photos." : "Chercher leur Instagram pour voir la salle et les murs.",
    "Option qui marche très bien : un montage de ta pièce sur une photo de leur mur, à montrer sur ton téléphone.",
    "Prendre des cartes avec ton Instagram (ou un QR code).",
  ];
  if (!p.art?.priceFrom) prep.push("Renseigner tes prix dans Réglages › Tes tableaux.");
  return prep;
}
