import type { Lead, Profile, Details } from "./types";
import { getTrade, pickVariant } from "./trades";

const signature = (p: Profile) =>
  [p.firstName + (p.studio ? ` · ${p.studio}` : ""), p.phone, p.site].filter(Boolean).join("\n");

function reviewsLine(l: Lead) {
  if (!l.reviews) return "";
  return `${l.reviews} avis${l.rating ? ` et une note de ${String(l.rating).replace(".", ",")}` : ""}`;
}

export function callScript(l: Lead, p: Profile) {
  const t = getTrade(l.tradeId)!;
  const presence =
    l.presence === "reseaux"
      ? "j'ai vu que vous aviez une page sur les réseaux, mais pas de site à vous"
      : "j'ai vu que vous n'aviez pas encore de site internet";
  const proof = reviewsLine(l);
  return [
    {
      step: "Ouverture",
      text: `Bonjour, je suis ${p.firstName}, ${p.studio ? `graphiste chez ${p.studio}` : "graphiste"}, juste à côté de chez vous. Je vous prends 30 secondes, je ne vous dérange pas ?`,
    },
    {
      step: "Le constat",
      text: `Je suis tombé sur votre fiche Google${proof ? ` : ${proof}, bravo` : ""}. Par contre, ${presence}. Aujourd'hui, ${t.hookDetail}.`,
    },
    {
      step: "La proposition",
      text: `J'ai préparé une maquette de ce que pourrait être le site de ${l.name}, avec vos vraies infos. Je peux vous l'envoyer par SMS ou passer vous la montrer, ça prend cinq minutes. Ça vous dit ?`,
    },
    {
      step: "Si c'est oui",
      text: `Parfait. Je vous l'envoie sur ce numéro ? Et on se cale un créneau ${["mardi", "jeudi"][l.name.length % 2]} en fin de matinée pour en parler ?`,
    },
  ];
}

export function objections(l: Lead, p: Profile) {
  const t = getTrade(l.tradeId)!;
  return [
    {
      q: "« J'ai déjà assez de clients. »",
      a: `Tant mieux, c'est justement pour ça que vos avis sont bons. Un site ne sert pas qu'à en trouver plus : il répond aux questions (horaires, tarifs, accès) à votre place et vous évite des appels.`,
    },
    {
      q: "« Ma page Facebook suffit. »",
      a: `Elle est utile, mais beaucoup de gens n'ont pas Facebook et Google met en avant les entreprises qui ont un site. Le site renvoie vers votre page, les deux se complètent.`,
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
      a: `Avec plaisir. Je vous envoie la maquette de votre ${t.singular} directement, c'est plus parlant qu'une plaquette. Je vous rappelle jeudi pour avoir votre avis ?`,
    },
  ];
}

export function emails(l: Lead, p: Profile) {
  const proof = reviewsLine(l);
  return [
    {
      label: "Premier contact",
      subject: `Une idée de site pour ${l.name}`,
      body: `Bonjour,

Je suis ${p.firstName}${p.studio ? `, de ${p.studio}` : ""}, graphiste près de chez vous.

En cherchant ${getTrade(l.tradeId)!.singular} à ${l.city}, je suis tombé sur votre fiche Google${proof ? ` (${proof})` : ""}. Vous avez une vraie clientèle, mais ${l.presence === "reseaux" ? "pas encore de site à vous" : "pas encore de site internet"} pour la capter quand elle vous cherche en ligne.

J'ai préparé une maquette de ce que pourrait être le site de ${l.name}, avec vos horaires, votre adresse et vos avis. Je vous l'envoie ?

Je propose ${p.offer}.

Bonne journée,
${signature(p)}`,
    },
    {
      label: "Relance J+3",
      subject: `Re : Une idée de site pour ${l.name}`,
      body: `Bonjour,

Je me permets de revenir vers vous au sujet de la maquette de site pour ${l.name}. Elle est prête, il me suffit d'une réponse pour vous l'envoyer.

Si ce n'est pas le moment, dites-le-moi simplement et je ne vous relancerai plus.

${signature(p)}`,
    },
    {
      label: "Dernière relance J+10",
      subject: `Je clos le dossier ${l.name} ?`,
      body: `Bonjour,

Sans retour de votre part, je range la maquette que j'avais préparée pour ${l.name}. Si un jour vous voulez un site, mon numéro reste le même.

Belle continuation,
${signature(p)}`,
    },
  ];
}

export function directMessages(l: Lead, p: Profile) {
  return [
    {
      label: "Instagram",
      body: `Bonjour ! Je suis ${p.firstName}, graphiste${p.studio ? ` chez ${p.studio}` : ""} à côté. J'adore ce que vous faites. J'ai remarqué que ${l.name} n'avait pas de site, alors j'ai préparé une petite maquette avec vos vraies infos. Je vous l'envoie ici ?`,
    },
    {
      label: "LinkedIn",
      body: `Bonjour, je suis ${p.firstName}${p.studio ? ` (${p.studio})` : ""}, je crée des sites pour les entreprises de ${l.city}. ${l.name} a de très bons retours sur Google mais pas encore de site : j'ai préparé une maquette, je peux vous la partager ?`,
    },
    {
      label: "SMS après appel",
      body: `Bonjour, c'est ${p.firstName}, suite à notre appel : voici la maquette du site de ${l.name}. Dites-moi ce que vous en pensez !${p.site ? `\n${p.site}` : ""}`,
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

  return `Crée le site vitrine d'une ${t.singular} en un seul fichier HTML (HTML + CSS + JS inline, aucune dépendance sauf Google Fonts). Le site doit être prêt à montrer au gérant tel quel.

## L'entreprise (données réelles, ne rien inventer)
- Nom : ${l.name}
- Activité : ${l.category || t.singular}
- Adresse : ${l.address}
- Téléphone : ${l.phone || "(non communiqué : bouton « Nous contacter » à la place)"}
- Note Google : ${l.rating ? `${l.rating}/5 sur ${l.reviews} avis` : "non disponible"}
- Fiche Google Maps : ${l.mapsUrl || "—"}
${l.socialUrl ? `- Réseau social existant : ${l.socialUrl}\n` : ""}${d?.summary ? `- Description Google : ${d.summary}\n` : ""}- Horaires :
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
