// Prospection « Tableaux » : trouver les lieux qui achèteront tes œuvres pour leurs murs.
// Vente directe uniquement. Rien n'est inventé : les arguments viennent de la fiche Google,
// du registre et de ce que tu renseignes dans Réglages.
import type { Lead, Profile } from "./types";
import { activity } from "./site";

type Ch = "visite" | "email" | "message";
const h = (hh: number, mm = 0) => hh * 60 + mm;

// Tes séries, telles qu'on les voit sur ton Instagram
export const SERIES = {
  vacances: { name: "Vacances et architecture", hint: "villa et piscine, chalet, liseuse à la fenêtre, bord de mer" },
  totems: { name: "Totems géométriques", hint: "formats longs encadrés, fonds de couleur" },
  typo: { name: "Typo street", hint: "« Exhibe mes dunks », « Et je fume un dragon », « Seul face à mon reflet »" },
  ium: { name: "Portraits « -ium »", hint: "Léonium, Nikitium…" },
  sport: { name: "Sport", hint: "terrains de basket, de tennis, en aplats bleus et roses" },
  silhouettes: { name: "Silhouettes bleues", hint: "portraits en aplats bleus et rouges" },
} as const;
export type SeriesId = keyof typeof SERIES;

export type ArtVenue = {
  id: string;
  label: string; // pluriel
  singular: string;
  query: string; // requête Google Places
  hidden?: boolean; // anciens types, gardés pour les fiches déjà suivies
  // Approche
  channel: Ch;
  secondary: Ch;
  days: number[];
  window: [number, number];
  avoid: string;
  ask: string;
  why: string; // pourquoi ce canal
  // Argumentaire
  series: SeriesId[]; // séries à apporter, dans l'ordre
  wall: string; // ce que tes tableaux apportent à ce lieu
  compliment: string; // accroche sincère, à adapter
  likely: string[]; // objections les plus probables
  collab?: boolean; // tes collabs avec des restos et bars sont la meilleure preuve ici
};

const SHOP = { channel: "visite" as Ch, secondary: "message" as Ch, days: [2, 3, 4], window: [h(14, 30), h(17)] as [number, number], ask: "Demande le ou la gérante.", why: "Un tableau se vend en vrai : la matière, le format, l'effet sur le mur. Passe avec une pièce sous le bras." };
const RESTO = { ...SHOP, window: [h(15), h(17, 30)] as [number, number], avoid: "les services du midi et du soir", ask: "Demande le patron ou la patronne, hors service." };
const MAIL = { channel: "email" as Ch, secondary: "visite" as Ch, days: [2, 3], window: [h(10), h(11, 30)] as [number, number] };

export const ART_VENUES: ArtVenue[] = [
  {
    id: "art-deco", label: "Boutiques de déco", singular: "boutique de déco", query: "boutique décoration intérieure",
    ...SHOP, window: [h(10, 30), h(12)], avoid: "le samedi",
    series: ["vacances", "totems"],
    wall: "Leurs clients viennent chercher ce qu'on ne trouve pas dans les grandes enseignes : des affiches originales d'un illustrateur local, encadrées, c'est exactement ça.",
    compliment: "Vous avez une sélection vraiment différente des grandes enseignes.",
    likely: ["depot", "marge", "style"],
  },
  {
    id: "art-concept", label: "Concept stores", singular: "concept store", query: "concept store",
    ...SHOP, window: [h(10, 30), h(12)], avoid: "le samedi",
    series: ["totems", "vacances", "typo"],
    wall: "Un concept store vend une sélection : tes pièces aux murs renforcent son identité, et parlent à ses clients.",
    compliment: "Votre sélection est super cohérente, on sent un vrai regard.",
    likely: ["depot", "budget", "style"],
  },
  {
    id: "art-resto", label: "Restos de caractère", singular: "restaurant", query: "restaurant cantine bistronomique",
    ...RESTO, series: ["vacances", "silhouettes"], collab: true,
    wall: "Des murs qui ont une identité, c'est ce que les clients retiennent et prennent en photo : la photo circule ensuite sur Instagram avec le nom du resto.",
    compliment: "J'adore l'ambiance de votre salle, on sent que tout est choisi.",
    likely: ["deja-deco", "budget", "proprio"],
  },
  {
    id: "art-bar", label: "Bars et bars à cocktails", singular: "bar", query: "bar à cocktails",
    ...SHOP, window: [h(17), h(18, 30)], avoid: "les soirs de forte affluence et le week-end",
    series: ["typo", "ium"], collab: true,
    wall: "Dans un bar, les murs font partie de l'ambiance : une pièce forte devient un repère (« on se retrouve sous le tableau »).",
    compliment: "L'ambiance est top ici, et vous avez de beaux murs à habiller.",
    likely: ["deja-deco", "budget", "mail"],
  },
  {
    id: "art-cafe", label: "Cafés et coffee shops", singular: "café", query: "coffee shop",
    ...SHOP, window: [h(14, 30), h(16, 30)], avoid: "le rush du matin et du midi",
    series: ["vacances", "totems"],
    wall: "Les clients y restent longtemps : ils ont le temps de regarder les murs, et de demander qui a fait l'affiche.",
    compliment: "C'est un des cafés les plus agréables du coin, on a envie d'y rester.",
    likely: ["budget", "place", "proprio"],
  },
  {
    id: "art-hotel", label: "Hôtels de caractère", singular: "hôtel", query: "hôtel boutique",
    ...MAIL, avoid: "les heures d'arrivée et de départ",
    ask: "Demande le nom du directeur ou de la personne en charge de la déco.",
    why: "La décision se prend rarement à l'accueil : un e-mail au directeur, puis un rendez-vous avec une pièce.",
    series: ["vacances", "totems"],
    wall: "Un hôtel vend une expérience : des affiches d'un illustrateur de la ville, sur l'évasion et l'architecture, dans le lobby ou les chambres, c'est un argument pour ses clients.",
    compliment: "Votre hôtel a une vraie identité, ça se ressent dans la déco.",
    likely: ["proprio", "budget", "mail"],
  },
  {
    id: "art-gite", label: "Gîtes et chambres d'hôtes", singular: "chambre d'hôtes", query: "chambre d'hôtes gîte",
    ...MAIL, secondary: "message", avoid: "le week-end (arrivées)",
    ask: "Écris directement au propriétaire, c'est lui qui décore.",
    why: "Les propriétaires sont rarement sur place en journée : un e-mail ou un message Instagram avec deux visuels.",
    series: ["vacances"],
    wall: "Ta villa ou ton chalet au mur, c'est l'ambiance « vacances » que ses voyageurs viennent chercher, et une chambre qu'on retient sur les photos de l'annonce.",
    compliment: "Votre maison est superbe sur les photos, on a envie d'y aller.",
    likely: ["budget", "deja-deco", "mail"],
  },
  {
    id: "art-archi", label: "Architectes d'intérieur et agences immo", singular: "architecte d'intérieur", query: "architecte d'intérieur",
    ...MAIL, avoid: "le lundi matin",
    ask: "Écris au fondateur ou à la fondatrice de l'agence.",
    why: "Ce sont des prescripteurs : un e-mail soigné avec tes visuels, puis un rendez-vous.",
    series: ["vacances", "totems"],
    wall: "Ta série architecture parle leur langage : pour leur agence, et pour les intérieurs qu'ils livrent à leurs clients.",
    compliment: "J'aime beaucoup vos réalisations, il y a une vraie signature.",
    likely: ["marge", "budget", "mail"],
  },
  {
    id: "art-sneakers", label: "Sneakers et streetwear", singular: "boutique streetwear", query: "boutique sneakers streetwear",
    ...SHOP, window: [h(14), h(16, 30)], avoid: "le samedi et les jours de drop",
    series: ["typo", "silhouettes"],
    wall: "Leur clientèle vit dans la culture street : « Exhibe mes dunks » sur leur mur, c'est leur univers en une image.",
    compliment: "Votre boutique a un vrai style, rien à voir avec les grandes chaînes.",
    likely: ["style", "budget", "place"],
  },
  {
    id: "art-barbier", label: "Barbiers", singular: "barber shop", query: "barber shop",
    ...SHOP, days: [2, 3], window: [h(10), h(11, 30)], avoid: "le samedi et les fins de journée",
    series: ["typo", "silhouettes"],
    wall: "Les clients passent vingt minutes face au miroir : le mur derrière eux, c'est ce qu'ils voient… et ce qu'ils prennent en photo.",
    compliment: "Votre salon a un vrai style, ça se voit dès l'entrée.",
    likely: ["budget", "deja-deco", "proprio"],
  },
  {
    id: "art-tatouage", label: "Tatoueurs", singular: "salon de tatouage", query: "salon de tatouage",
    ...SHOP, days: [2, 3], window: [h(11), h(13)], avoid: "pendant les séances (demande quand ils sont libres)",
    series: ["totems", "typo"],
    wall: "Un salon de tatouage, c'est une galerie d'images : tes totems géométriques parlent le même langage graphique que leurs flashs.",
    compliment: "Le travail affiché ici est vraiment fort.",
    likely: ["style", "budget", "place"],
  },
  {
    id: "art-padel", label: "Clubs de padel et de tennis", singular: "club de padel", query: "club de padel",
    ...SHOP, days: [2, 3, 4], window: [h(10), h(12)], avoid: "les soirs et le week-end (pleins)",
    ask: "Demande le gérant ou la gérante du club.",
    series: ["sport"],
    wall: "Ta série sport, c'est leur terrain en affiche : au club-house, à l'accueil ou au bar, ça habille le lieu et ça plaît aux joueurs.",
    compliment: "Le club est super bien tenu, et l'espace d'accueil a du potentiel.",
    likely: ["budget", "proprio", "deja-deco"],
  },
  {
    id: "art-geek", label: "Bars à jeux et boutiques BD", singular: "bar à jeux", query: "bar à jeux boutique bd",
    ...SHOP, window: [h(15), h(17, 30)], avoid: "les soirs de tournoi et le week-end",
    series: ["ium", "typo"],
    wall: "Un public pop culture, qui reconnaît tout de suite les références de tes portraits « -ium ».",
    compliment: "Le concept est génial, c'est exactement le genre d'endroit qui manquait.",
    likely: ["budget", "deja-deco", "proprio"],
  },
  {
    id: "art-disquaire", label: "Disquaires et boutiques vintage", singular: "disquaire", query: "disquaire vinyle",
    ...SHOP, window: [h(14), h(16, 30)], avoid: "le samedi",
    series: ["ium", "typo"],
    wall: "Un public qui aime l'objet, l'image, la pochette : l'affiche lui parle.",
    compliment: "Votre boutique a une vraie âme, on pourrait y passer des heures.",
    likely: ["depot", "place", "budget"],
  },
  {
    id: "art-galerie", label: "Galeries d'art", singular: "galerie", query: "galerie d'art",
    ...MAIL, window: [h(10), h(12)], avoid: "les jours de vernissage",
    ask: "Écris au galeriste ou au directeur artistique, par son nom.",
    why: "Les galeries reçoivent beaucoup de demandes : un e-mail court avec tes visuels et ton Instagram est la règle.",
    series: ["totems", "vacances"],
    wall: "Une galerie cherche des artistes qui ont un univers reconnaissable et une communauté : montre une série complète, pas des pièces isolées.",
    compliment: "J'ai beaucoup aimé votre dernière exposition.",
    likely: ["depot", "style", "mail"],
  },
  // Anciens types, gardés pour les fiches déjà dans le pipeline
  { id: "art-japonais", label: "Restos japonais", singular: "restaurant japonais", query: "restaurant japonais", hidden: true, ...RESTO, series: ["totems", "silhouettes"], wall: "Des murs qui ont une identité, c'est ce que les clients retiennent et prennent en photo.", compliment: "J'adore l'ambiance de votre salle.", likely: ["deja-deco", "budget", "proprio"] },
  { id: "art-asie", label: "Restos asiatiques", singular: "restaurant asiatique", query: "restaurant asiatique", hidden: true, ...RESTO, series: ["totems", "silhouettes"], wall: "Des murs qui ont une identité, c'est ce que les clients retiennent et prennent en photo.", compliment: "Votre déco a une vraie personnalité.", likely: ["style", "budget", "proprio"] },
  { id: "art-manga", label: "Boutiques manga", singular: "boutique manga", query: "boutique manga", hidden: true, ...SHOP, avoid: "le samedi", series: ["ium", "typo"], wall: "Un public pop culture, qui reconnaît tout de suite tes références.", compliment: "C'est une des meilleures boutiques du coin.", likely: ["depot", "marge", "place"] },
  { id: "art-jeux", label: "Bars à jeux", singular: "bar à jeux", query: "bar à jeux", hidden: true, ...SHOP, avoid: "les soirs de tournoi", series: ["ium", "typo"], wall: "Un public pop culture, qui reconnaît tout de suite tes références.", compliment: "Le concept est génial.", likely: ["budget", "deja-deco", "proprio"] },
];

export const getArtVenue = (id: string) => ART_VENUES.find((v) => v.id === id) || ART_VENUES[0];
export const isArt = (tradeId?: string) => !!tradeId && tradeId.startsWith("art-");
export const seriesFor = (tradeId: string) => getArtVenue(tradeId).series.map((id) => SERIES[id]);
const pickText = (v: ArtVenue) => {
  const [a, b] = v.series.map((id) => SERIES[id]);
  return `une pièce de ta série ${a.name} (${a.hint})${b ? `, et une de ${b.name} en plan B` : ""}`;
};

// Lieu à forte identité : mots-clés dans le nom ou la catégorie Google
const UNIVERSE = /design|d[ée]co|concept|atelier|vintage|r[ée]tro|street|sneaker|urban|graphi|\bart\b|galerie|loft|studio|cr[ée]ateur|craft|vinyl|tattoo|tatou|\bink\b|brunch|cantine|guinguette|rooftop|speakeasy|padel|villa|chalet|lodge|boh[eè]me|archi/i;

export function instagramOf(l: Lead) {
  return [l.socialUrl, l.website].find((u) => u && /instagram\.com/i.test(u));
}

// Pourquoi ce lieu est une bonne cible : uniquement des faits observés
export function artFit(l: Lead) {
  const reasons: string[] = [];
  let score = 0;
  // On retire les mots du type de lieu cherché : « boutique de déco » ne compte pas comme un signe
  const v = getArtVenue(l.tradeId);
  const own = `${v.query} ${v.singular}`.toLowerCase().split(/[\s']+/).filter((w) => w.length > 3);
  const text = `${l.name} ${l.category || ""}`.split(/[\s']+/).filter((w) => !own.includes(w.toLowerCase())).join(" ");
  const universe = UNIVERSE.test(text);
  if (universe) { score += 40; reasons.push("Lieu à forte identité : il a l'œil pour la déco"); }
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
const refs = (p: Profile) => lines(p.art?.references).slice(0, 3);
const style = (p: Profile) => p.art?.style?.trim() || "des tableaux";
const me = (p: Profile) => p.firstName || "moi";

// Les étapes de l'approche, côté tableaux
export function artSteps(l: Lead, p: Profile) {
  const v = getArtVenue(l.tradeId)!;
  const price = priceText(p);
  const extras = lines(p.art?.extras);
  return [
    { title: "Arriver avec une pièce", text: `Viens avec ${pickText(v)}. Le tableau fait le pitch à ta place : on ne vend pas une œuvre en photo.` },
    { title: "Lui montrer chez lui", text: "Propose de poser la pièce contre le mur, là où elle irait. Il ne s'imagine plus le tableau : il le voit chez lui, et c'est là que la décision se prend." },
    { title: "Prouver ton univers", text: `Ouvre ton Instagram${handle(p) ? ` (${handle(p)})` : ""} sur ton téléphone : la série complète${refs(p).length ? `, puis tes collabs (${refs(p).join(", ")})${v.collab ? " : ici, c'est ton meilleur argument" : ""}` : ", et si tu l'as, une photo d'une de tes pièces déjà accrochée chez quelqu'un"}.` },
    { title: "Annoncer le prix simplement", text: price ? `Pièces ${price}${p.art?.formats ? `, formats : ${p.art.formats}` : ""}.${extras.length ? ` ${extras.join(". ")}.` : ""}` : "Renseigne ta fourchette de prix dans Réglages › Tes tableaux." },
    { title: "Conclure", text: "« Celle-ci, ou on part sur une série de deux ou trois pour ce mur ? » Une question à choix, pas « vous en pensez quoi ? »." },
  ];
}

export function artScript(l: Lead, p: Profile) {
  const v = getArtVenue(l.tradeId)!;
  const price = priceText(p);
  return [
    { step: "En entrant", text: `Bonjour, je suis ${me(p)}, je fais ${style(p)} ici, à ${l.city}. Est-ce que je peux voir le ou la responsable deux minutes, quand vous aurez un moment ?` },
    { step: "L'accroche", text: `${v.compliment} Je me suis dit que mes tableaux auraient leur place sur vos murs.` },
    { step: "Montrer", text: `(Tu poses la pièce contre le mur.) Regardez ce que ça donne ici. ${v.wall.split(":")[0]}.` },
    { step: "La preuve", text: `Voilà le reste de la série${handle(p) ? `, tout est sur mon Instagram ${handle(p)}` : ""}. Ce sont des créations originales, faites ici.${refs(p).length ? ` J'ai aussi travaillé avec ${refs(p).join(" et ")}.` : ""}` },
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

${refs(p).length ? `J'ai déjà travaillé avec ${refs(p).join(", ")}. ` : ""}Vous pouvez voir mon travail ici${instaUrl(p) ? ` : ${instaUrl(p)}` : " (visuels en pièce jointe)"}.${price ? ` Les pièces sont ${price}${p.art?.formats ? `, en ${p.art.formats}` : ""}.` : ""}

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
    `Choisir ${pickText(v)}.`,
    instagramOf(l) ? "Regarder leur Instagram : repère les murs nus ou ternes sur leurs photos." : "Chercher leur Instagram pour voir la salle et les murs.",
    "Option qui marche très bien : un montage de ta pièce sur une photo de leur mur, à montrer sur ton téléphone.",
    "Prendre des cartes avec ton Instagram (ou un QR code).",
  ];
  if (!p.art?.priceFrom) prep.push("Renseigner tes prix dans Réglages › Tes tableaux.");
  return prep;
}
