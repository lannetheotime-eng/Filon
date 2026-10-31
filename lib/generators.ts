import type { Lead, Profile } from "./types";
import { getTrade } from "./trades";

const signature = (p: Profile) =>
  [(p.firstName || "") + (p.studio ? ` · ${p.studio}` : ""), p.phone, p.email, p.site].filter(Boolean).join("\n");

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

const work = (p: Profile) => (p.portfolio ? ` (${p.portfolio})` : "");

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
      text: `Je crée des sites pour des commerces et des artisans du coin. Je vous montre en une minute ce que j'ai fait pour d'autres ?`,
    },
    {
      step: "Conclure",
      text: `Si ça vous parle, je vous laisse ma carte et je vous envoie quelques exemples par e-mail ce soir. On en reparle la semaine prochaine ?`,
    },
  ];
}

export function objections(l: Lead, p: Profile) {
  const t = getTrade(l.tradeId)!;
  return [
    {
      id: "deja-site",
      q: "« J'ai déjà un site. »",
      a: `Oui, et c'est une bonne base. Mais ${gap(l).replace("votre site existe, mais ", "")} : sur un téléphone, une partie de vos clients repart avant même de vous contacter. Je vous montre la différence ?`,
    },
    {
      id: "prestataire",
      q: "« C'est quelqu'un qui s'en occupe. »",
      a: `Très bien, gardez-le si vous êtes content. Je vous laisse simplement la liste de ce que j'ai relevé : vous pourrez la lui transmettre, et si un jour vous voulez un autre regard, je suis là.`,
    },
    {
      id: "facebook",
      q: "« Ma page Facebook suffit. »",
      a: `Elle est utile, mais beaucoup de gens n'ont pas Facebook et Google met en avant les entreprises qui ont un site. Le site renvoie vers votre page, les deux se complètent.`,
    },
    {
      id: "clients",
      q: "« J'ai déjà assez de clients. »",
      a: `Tant mieux, ça se voit à vos avis. Un site ne sert pas qu'à en trouver plus : il répond aux questions (horaires, tarifs, accès) à votre place et vous évite des appels.`,
    },
    {
      id: "cher",
      q: "« C'est trop cher. »",
      a: p.price
        ? `Je comprends. On parle de ${p.price}, et ça se rembourse avec quelques clients en plus. On peut commencer simple et faire évoluer ensuite.`
        : `Je comprends. On peut commencer simple, avec l'essentiel, et faire évoluer ensuite. Je vous fais une proposition chiffrée, sans engagement ?`,
    },
    {
      id: "temps",
      q: "« Je n'ai pas le temps de m'en occuper. »",
      a: `Vous n'avez presque rien à faire : je reprends vos infos Google et vos photos, je m'occupe de la mise en ligne et de l'entretien. Vous validez, c'est tout.`,
    },
    {
      id: "mail",
      q: "« Envoyez-moi un mail. »",
      a: `Avec plaisir. Je vous envoie quelques réalisations de ${t.label.toLowerCase()} et d'autres commerces. Je repasse en fin de semaine pour avoir votre avis ?`,
    },
  ];
}

export function emails(l: Lead, p: Profile, reportUrl?: string) {
  const proof = reviewsLine(l);
  const issues = l.audit?.issues || [];
  const t = getTrade(l.tradeId)!;
  const intro = `Je suis ${p.firstName}${p.studio ? `, de ${p.studio}` : ""}, graphiste près de chez vous.`;
  const close = `Je serais ravi de vous montrer quelques réalisations${work(p)} et d'en parler dix minutes, sans engagement.\n\nJe propose ${p.offer}.`;
  const first =
    l.presence === "vieux"
      ? {
          label: "Premier contact",
          subject: `Votre site ${l.name}, vu depuis un téléphone`,
          body: `Bonjour,

${intro}

En cherchant ${t.singular} à ${l.city}, je suis tombé sur ${l.name}${proof ? ` (${proof} sur Google, bravo)` : ""}. J'ai regardé votre site et j'ai relevé quelques points qui vous font sans doute perdre des clients :

${issues.slice(0, 4).map((i) => `• ${i}`).join("\n")}
${reportUrl ? `\nLe détail, avec pourquoi chaque point compte : ${reportUrl}\n` : ""}
${close}

Bonne journée,
${signature(p)}`,
        }
      : {
          label: "Premier contact",
          subject: l.context?.rival ? `${l.name} sur Google` : `Un site pour ${l.name} ?`,
          body: `Bonjour,

${intro}

En cherchant ${t.singular} à ${l.city}, je suis tombé sur votre fiche Google${proof ? ` (${proof})` : ""}. Vous avez une vraie clientèle, mais ${l.presence === "reseaux" ? "pas encore de site à vous" : "pas encore de site internet"} pour la capter quand elle vous cherche en ligne.

${close}

Bonne journée,
${signature(p)}`,
        };
  return [
    first,
    {
      label: "Relance J+3",
      subject: `Re : ${first.subject}`,
      body: `Bonjour,

Je me permets de revenir vers vous au sujet de mon message pour ${l.name}. Une réponse en une ligne me suffit, même pour me dire que ce n'est pas le moment : dans ce cas, je ne vous relancerai plus.

${signature(p)}`,
    },
    {
      label: "Dernière relance J+12",
      subject: `Je clos le dossier ${l.name} ?`,
      body: `Bonjour,

Sans retour de votre part, je n'insiste pas. Si un jour vous avez besoin d'un site ou d'un coup de main pour être mieux trouvé sur Google, mes coordonnées restent les mêmes.

Belle continuation,
${signature(p)}`,
    },
    {
      label: "Après une visite",
      subject: `Suite à mon passage chez ${l.name}`,
      body: `Bonjour,

Merci pour votre accueil aujourd'hui. Comme promis, voici quelques réalisations${work(p)} pour vous donner une idée de mon travail.

Si vous le souhaitez, je vous prépare une proposition adaptée à ${l.name}. Je repasse en fin de semaine pour en parler de vive voix.

${signature(p)}`,
    },
  ];
}

export function directMessages(l: Lead, p: Profile) {
  const situation = l.presence === "vieux" ? "un site qui mériterait un coup de neuf" : "pas encore de site";
  return [
    {
      label: "Instagram",
      body: `Bonjour ! Je suis ${p.firstName}, graphiste${p.studio ? ` chez ${p.studio}` : ""} à côté. J'aime beaucoup ce que vous faites. J'ai remarqué que ${l.name} avait ${situation} : je crée des sites pour des commerces du coin, je peux vous montrer quelques exemples ?`,
    },
    {
      label: "Facebook",
      body: `Bonjour, je suis ${p.firstName}${p.studio ? ` (${p.studio})` : ""}, graphiste à ${l.city}. Je vois que ${l.name} a ${situation}. Je crée des sites pour des entreprises locales, ça vous intéresserait d'en discuter ?`,
    },
    {
      label: "LinkedIn",
      body: `Bonjour, je suis ${p.firstName}${p.studio ? ` (${p.studio})` : ""}, je crée des sites pour les entreprises de ${l.city}. ${l.name} a de très bons retours sur Google mais ${situation} : seriez-vous ouvert à un échange de dix minutes ?`,
    },
  ];
}
