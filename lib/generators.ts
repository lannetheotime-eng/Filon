import type { Lead, Profile, Details } from "./types";
import { getTrade, pickVariant } from "./trades";

const signature = (p: Profile) =>
  [p.firstName + (p.studio ? ` · ${p.studio}` : ""), p.phone, p.email, p.site].filter(Boolean).join("\n");

const FEMININE = new Set(["boulangerie", "boucherie"]);
export const aTrade = (singular: string) => (FEMININE.has(singular) ? `une ${singular}` : `un ${singular}`);

function reviewsLine(l: Lead) {
  if (!l.reviews) return "";
  return `${l.reviews} avis${l.rating ? ` et une note de ${String(l.rating).replace(".", ",")}` : ""}`;
}

// Le constat, formulé selon la situation de l'entreprise
function gap(l: Lead) {
  if (l.presence === "vieux") {
    const top = (l.audit?.issues || []).slice(0, 2).map((i) => i.charAt(0).toLowerCase() + i.slice(1));
    return top.length ? `votre site existe, mais ${top.join(" et ")}` : "votre site mériterait un coup de neuf";
  }
  if (l.presence === "reseaux") return "vous avez une page sur les réseaux, mais pas de site à vous";
  return "vous n'avez pas encore de site internet";
}

const offerWord = (l: Lead) => (l.presence === "vieux" ? "une nouvelle version de votre site" : "une maquette de votre site");

export function visitScript(l: Lead, p: Profile) {
  const t = getTrade(l.tradeId)!;
  const proof = reviewsLine(l);
  return [
    {
      step: "En entrant",
      text: `Bonjour, je suis ${p.firstName}, ${p.studio ? `graphiste chez ${p.studio}` : "graphiste"}. Est-ce que je peux parler au responsable deux minutes, quand il aura un moment ?`,
    },
    {
      step: "Le constat",
      text: `Je suis tombé sur votre fiche Google${proof ? ` : ${proof}, vos clients vous adorent` : ""}. Par contre, ${gap(l)}. Aujourd'hui, ${t.hookDetail}.`,
    },
    {
      step: "Montrer",
      text: `J'ai préparé ${offerWord(l)} pour ${l.name}, avec vos vraies infos. Je vous la montre sur mon téléphone, ça prend une minute.`,
    },
    {
      step: "Conclure",
      text: `Si ça vous parle, je vous laisse ma carte et je vous envoie la maquette par e-mail ce soir. On peut se revoir la semaine prochaine pour en discuter ?`,
    },
  ];
}

export function objections(l: Lead, p: Profile) {
  const t = getTrade(l.tradeId)!;
  const list = [
    {
      q: "« J'ai déjà assez de clients. »",
      a: `Tant mieux, ça se voit à vos avis. Un site ne sert pas qu'à en trouver plus : il répond aux questions (horaires, tarifs, accès) à votre place et vous évite des appels.`,
    },
    {
      q: "« C'est trop cher. »",
      a: p.price
        ? `Je comprends. On parle de ${p.price}, et ça se rembourse avec quelques clients en plus. Regardez d'abord la maquette, vous jugerez ensuite.`
        : `Je comprends. Regardez d'abord la maquette : si elle ne vous plaît pas, ça ne vous aura rien coûté, et sinon on en parle à votre rythme.`,
    },
    {
      q: "« Je n'ai pas le temps de m'en occuper. »",
      a: `Vous n'avez rien à faire : je reprends vos infos Google, vos photos, et je m'occupe de la mise en ligne et de l'entretien. Vous validez, c'est tout.`,
    },
    {
      q: "« Envoyez-moi un mail. »",
      a: `Avec plaisir. Je vous envoie la maquette de votre ${t.singular} directement, c'est plus parlant qu'une plaquette. Je repasse en fin de semaine pour avoir votre avis ?`,
    },
  ];
  if (l.presence === "vieux")
    list.unshift({
      q: "« J'ai déjà un site. »",
      a: `Oui, et c'est une bonne base. Mais ${gap(l).replace("votre site existe, mais ", "")} : sur un téléphone, une partie de vos clients repart avant même de vous appeler. Je vous montre la différence ?`,
    });
  else
    list.unshift({
      q: "« Ma page Facebook suffit. »",
      a: `Elle est utile, mais beaucoup de gens n'ont pas Facebook et Google met en avant les entreprises qui ont un site. Le site renvoie vers votre page, les deux se complètent.`,
    });
  return list;
}

export function emails(l: Lead, p: Profile) {
  const proof = reviewsLine(l);
  const issues = l.audit?.issues || [];
  const first =
    l.presence === "vieux"
      ? {
          label: "Premier contact",
          subject: `Votre site ${l.name}, vu depuis un téléphone`,
          body: `Bonjour,

Je suis ${p.firstName}${p.studio ? `, de ${p.studio}` : ""}, graphiste près de chez vous.

En cherchant ${getTrade(l.tradeId)!.singular} à ${l.city}, je suis tombé sur ${l.name}${proof ? ` (${proof} sur Google, bravo)` : ""}. J'ai regardé votre site et j'ai relevé quelques points qui vous font sans doute perdre des clients :

${issues.slice(0, 4).map((i) => `• ${i}`).join("\n")}

J'ai préparé une nouvelle version de votre site, avec vos vraies infos, pour vous montrer la différence. Je vous l'envoie ?

Je propose ${p.offer}.

Bonne journée,
${signature(p)}`,
        }
      : {
          label: "Premier contact",
          subject: `Une idée de site pour ${l.name}`,
          body: `Bonjour,

Je suis ${p.firstName}${p.studio ? `, de ${p.studio}` : ""}, graphiste près de chez vous.

En cherchant ${getTrade(l.tradeId)!.singular} à ${l.city}, je suis tombé sur votre fiche Google${proof ? ` (${proof})` : ""}. Vous avez une vraie clientèle, mais ${l.presence === "reseaux" ? "pas encore de site à vous" : "pas encore de site internet"} pour la capter quand elle vous cherche en ligne.

J'ai préparé une maquette de ce que pourrait être le site de ${l.name}, avec vos horaires, votre adresse et vos avis. Je vous l'envoie ?

Je propose ${p.offer}.

Bonne journée,
${signature(p)}`,
        };
  return [
    first,
    {
      label: "Relance J+3",
      subject: `Re : ${first.subject}`,
      body: `Bonjour,

Je me permets de revenir vers vous au sujet de ${offerWord(l)} pour ${l.name}. Elle est prête, il me suffit d'une réponse pour vous l'envoyer.

Si ce n'est pas le moment, dites-le-moi simplement et je ne vous relancerai plus.

${signature(p)}`,
    },
    {
      label: "Dernière relance J+10",
      subject: `Je clos le dossier ${l.name} ?`,
      body: `Bonjour,

Sans retour de votre part, je range la maquette que j'avais préparée pour ${l.name}. Si un jour vous en avez besoin, mes coordonnées restent les mêmes.

Belle continuation,
${signature(p)}`,
    },
    {
      label: "Après une visite",
      subject: `Suite à mon passage chez ${l.name}`,
      body: `Bonjour,

Merci pour votre accueil aujourd'hui. Comme promis, voici ${offerWord(l)} que je vous ai montrée.

[Lien ou pièce jointe de la maquette]

Elle reprend vos vraies infos ; tout reste modifiable selon vos envies. Je repasse en fin de semaine si vous voulez en parler de vive voix.

${signature(p)}`,
    },
  ];
}

export function directMessages(l: Lead, p: Profile) {
  const situation = l.presence === "vieux" ? "un site qui mériterait un coup de neuf" : "pas encore de site";
  return [
    {
      label: "Instagram",
      body: `Bonjour ! Je suis ${p.firstName}, graphiste${p.studio ? ` chez ${p.studio}` : ""} à côté. J'adore ce que vous faites. J'ai remarqué que ${l.name} avait ${situation}, alors j'ai préparé une petite maquette avec vos vraies infos. Je vous l'envoie ici ?`,
    },
    {
      label: "Facebook",
      body: `Bonjour, je suis ${p.firstName}${p.studio ? ` (${p.studio})` : ""}, graphiste à ${l.city}. Je vois que ${l.name} a ${situation}. J'ai préparé une maquette pour vous montrer ce que ça pourrait donner, ça vous intéresse ?`,
    },
    {
      label: "LinkedIn",
      body: `Bonjour, je suis ${p.firstName}${p.studio ? ` (${p.studio})` : ""}, je crée des sites pour les entreprises de ${l.city}. ${l.name} a de très bons retours sur Google mais ${situation} : j'ai préparé une maquette, je peux vous la partager ?`,
    },
  ];
}

export function sitePrompt(l: Lead, d: Details | null) {
  const t = getTrade(l.tradeId)!;
  const v = pickVariant(t, l.id);
  const hours = d?.hours?.length ? d.hours.map((h) => `  - ${h}`).join("\n") : "  - (non communiqués : laisser un emplacement « Horaires à compléter »)";
  const reviews = d?.reviews?.filter((r) => r.text).length
    ? d.reviews!.filter((r) => r.text).map((r) => `  - ${r.author} (${r.rating}/5, ${r.when}) : « ${r.text.replace(/\s+/g, " ").trim()} »`).join("\n")
    : "  - (aucun avis récupéré : ne pas inventer d'avis, masquer la section)";

  return `Crée le site vitrine d'${aTrade(t.singular)} en un seul fichier HTML (HTML + CSS + JS inline, aucune dépendance sauf Google Fonts). Le site doit être prêt à montrer au gérant tel quel.

## L'entreprise (données réelles, ne rien inventer)
- Nom : ${l.name}
- Activité : ${l.category || t.singular}
- Adresse : ${l.address}
- Téléphone : ${l.phone || "(non communiqué : bouton « Nous contacter » à la place)"}
- Note Google : ${l.rating ? `${l.rating}/5 sur ${l.reviews} avis` : "non disponible"}
- Fiche Google Maps : ${l.mapsUrl || "—"}
${l.socialUrl ? `- Réseau social existant : ${l.socialUrl}\n` : ""}${l.website ? `- Site actuel (à remplacer, ne pas copier son design) : ${l.website}\n- Défauts relevés sur le site actuel, à corriger : ${(l.audit?.issues || []).join(" ; ")}\n` : ""}${d?.summary ? `- Description Google : ${d.summary}\n` : ""}- Horaires :
${hours}
- Avis clients (à citer tels quels, sans les modifier) :
${reviews}

## Direction artistique : « ${v.name} »
- Couleurs : fond ${v.palette.bg}, texte ${v.palette.ink}, accent ${v.palette.accent}, fond secondaire ${v.palette.soft}
- Typographies : ${v.fonts}
- Mise en page : ${v.layout}
- Ton des textes : chaleureux, local, concret, phrases courtes. Pas de superlatifs creux.

## Effet signature : « ${t.effect.name} »
${t.effect.description}
Un seul effet fort, joué une fois ; respecter prefers-reduced-motion (version statique).

## Sections
${t.sections.map((s) => `- ${s}`).join("\n")}

## Exigences
- Mobile d'abord : bouton « Appeler » fixe en bas d'écran sur mobile (lien tel:).
- Photos : emplacements clairement marqués « Photo à fournir » avec un dégradé dans la palette, pas d'images inventées.
- Ne jamais inventer de prix, d'horaires, d'avis ou de prestations précises : utiliser des formulations génériques et des emplacements à compléter.
- SEO local : balise title « ${l.name}, ${t.singular} à ${l.city} », meta description, données structurées JSON-LD LocalBusiness avec nom, adresse, téléphone et note.
- Carte : lien vers la fiche Google Maps (pas d'iframe).
- Pied de page : mentions légales à compléter, lien vers la fiche Google.
- Accessibilité : contrastes AA, focus visible, textes alternatifs.`;
}
