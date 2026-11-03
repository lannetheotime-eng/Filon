// « La dernière bouteille » : murder party pour 3 ou 4 joueurs.
// Chaque joueur incarne un suspect. Marc Delorme est le coupable (et il le sait).
// À 3 joueurs, Paul Vidal n'est pas distribué : il devient un témoin joué par l'IA.

export type CharId = "lucie" | "marc" | "helene" | "paul";
export type NpcId = "ines" | "carrel" | "paul";
export type ActId = "invitation" | "acte1" | "acte2" | "acte3" | "revelation";

export type Character = {
  id: CharId;
  name: string;
  age: number;
  role: string;
  costume: string;
  publicIntro: string; // ce que tout le monde sait de toi, à lire à voix haute
  official: string; // ta version officielle, celle que tu racontes
  secret: string; // la vérité que tu caches
  objectives: string[];
  clues: { act: "acte2"; text: string }[];
  missions: Mission[]; // à réussir en parlant, autour de la table : 1 point chacune
};

export type Mission = { id: string; act: "acte1" | "acte2" | "acte3"; text: string };

export type Npc = {
  id: NpcId;
  name: string;
  role: string;
  initials: string;
  voice: string; // voix OpenAI
  tone: string; // façon de parler, pour la voix
  unlock: ActId;
  sheet: string; // fiche pour l'IA
};

export const TITLE = "La dernière bouteille";
export const VENUE = "L'Armand, restaurant étoilé, Toulouse";

export const FACTS = `Samedi soir, pendant le service, Victor Armand, 61 ans, chef et propriétaire du restaurant étoilé L'Armand à Toulouse, a été retrouvé mort dans la cave à vins à 23 h 40 par la plongeuse, Inès. Il a été frappé à la tête. Une bouteille brisée gisait à côté de lui. Quatre personnes proches de Victor étaient au restaurant ce soir-là. Le commissaire Garnier les a toutes convoquées.`;

export const CHARACTERS: Character[] = [
  {
    id: "lucie",
    name: "Lucie Armand",
    age: 34,
    role: "Fille de Victor, cheffe pâtissière de L'Armand",
    costume: "Veste de cuisine blanche ou tablier, cheveux attachés, un torchon sur l'épaule.",
    publicIntro: "Je suis Lucie, la fille de Victor. Je fais les desserts de L'Armand depuis dix ans. Ce restaurant, c'est toute ma vie.",
    official: "Tu as fini les desserts vers 22 h 30, tu es sortie fumer, puis tu es rentrée chez toi vers 22 h 45. Tu n'as rien vu.",
    secret: "À 22 h 40, ton père t'a annoncé qu'il vendait L'Armand au groupe lyonnais de Paul Vidal au lieu de te le transmettre. Vous vous êtes hurlé dessus en cuisine, des gens ont dû entendre. Tu ne voulais pas qu'on te voie pleurer : de 22 h 52 à 23 h 21, tu t'es enfermée dans la chambre froide. Puis tu es partie par la porte de service. Tu sais aussi une chose que peu de gens savent : seuls ton père et Marc ont la clé du petit bureau de la cave.",
    objectives: [
      "Cacher la dispute et la chambre froide le plus longtemps possible : ça fait de toi la suspecte idéale.",
      "Découvrir qui a tué ton père.",
      "Faire avouer à Paul Vidal ce qu'il sait de la vente.",
    ],
    clues: [
      { act: "acte2", text: "En sortant de la chambre froide à 23 h 21, tu as entendu quelqu'un remonter l'escalier de la cave en courant, et il flottait une odeur de cigare. Paul Vidal fume le cigare." },
      { act: "acte2", text: "En partant, tu as vu le ticket de la table 7 posé près de la caisse : réglé à 23 h 05, servi par Marc. Or Marc dit qu'il a servi cette table jusqu'à 23 h 30." },
    ],
    missions: [
      { id: "l1", act: "acte1", text: "Pendant ton passage sur le grill, ne laisse personne découvrir que tu t'es disputée avec ton père." },
      { id: "l2", act: "acte1", text: "Fais dire à Hélène quel était son vrai lien avec ton père." },
      { id: "l3", act: "acte2", text: "Fais admettre à Marc qu'il a quitté la salle avant 23 h 30." },
      { id: "l4", act: "acte2", text: "Pendant l'appel au témoin, fais poser ta question par le groupe." },
      { id: "l5", act: "acte3", text: "Convaincs au moins un autre joueur de voter pour le même suspect que toi." },
    ],
  },
  {
    id: "marc",
    name: "Marc Delorme",
    age: 47,
    role: "Sommelier de L'Armand depuis 19 ans",
    costume: "Chemise blanche, gilet sombre, un tire-bouchon ou un tastevin autour du cou.",
    publicIntro: "Marc Delorme, sommelier. Dix-neuf ans aux côtés de Victor. C'était comme un frère pour moi.",
    official: "Tu as servi la table 7, un couple qui fêtait un anniversaire, jusqu'à 23 h 30 environ, puis tu as rangé la salle. Tu as appris le drame comme tout le monde.",
    secret: "C'est toi le coupable. Depuis trois ans, tu remplaces les grands crus de la cave par du vin médiocre, avec de fausses étiquettes imprimées sur l'imprimante du bureau de la cave, et tu revends les vraies bouteilles à un collectionneur belge. Ce soir, le client de la table 12 a renvoyé un « Margaux 1990 » en disant que c'était de la piquette. Victor l'a goûté et il a compris. À 23 h 05, juste après avoir encaissé la table 7, tu l'as suivi à la cave. Il a dit qu'il appelait la police. Tu l'as frappé avec un magnum. Tu as jeté ton tablier taché derrière les casiers, tu t'es lavé les mains à la plonge vers 23 h 15 (Inès, la plongeuse, t'a vu), puis tu es retourné servir comme si de rien n'était.",
    objectives: [
      "Ne pas être démasqué : tu gagnes si la majorité accuse quelqu'un d'autre.",
      "Faire porter les soupçons sur Paul Vidal (il voulait le restaurant pas cher) ou sur Lucie (elle s'est disputée avec son père).",
      "Ne jamais parler du « Margaux » : personne ne t'a dit de quelle bouteille il s'agissait.",
    ],
    clues: [
      { act: "acte2", text: "Danger : Inès t'a vu te laver les mains à la plonge vers 23 h 15. Si quelqu'un l'appelle, elle risque de parler. Prépare une explication (une bouteille cassée en salle ?)." },
      { act: "acte2", text: "Hélène Roussel n'est pas partie à 23 h comme elle le prétend : tu l'as aperçue dans le petit salon privé, au bout du couloir de la cave. A-t-elle vu quelque chose ? Retourne ça contre elle." },
    ],
    missions: [
      { id: "m1", act: "acte1", text: "Fais dire à voix haute que Lucie s'est disputée avec son père ce soir." },
      { id: "m2", act: "acte1", text: "Ne prononce jamais le mot « Margaux » de toute la soirée." },
      { id: "m3", act: "acte2", text: "Fais accuser quelqu'un d'autre que toi, à voix haute, par au moins un joueur." },
      { id: "m4", act: "acte2", text: "Fais en sorte que le groupe n'appelle pas Inès en premier." },
      { id: "m5", act: "acte3", text: "Fais changer d'avis un joueur juste avant le vote." },
    ],
  },
  {
    id: "helene",
    name: "Hélène Roussel",
    age: 52,
    role: "Critique gastronomique pour la revue « La Table Libre »",
    costume: "Tenue élégante et sombre, foulard, un carnet de notes et un stylo.",
    publicIntro: "Hélène Roussel, critique gastronomique. J'étais là pour travailler, rien de plus. Je connaissais Victor professionnellement.",
    official: "Tu dînais seule à la table 3 pour écrire une critique. Tu es partie vers 23 h. Ta relation avec Victor était strictement professionnelle.",
    secret: "Tu as eu une liaison de six ans avec Victor. Il t'a quittée il y a deux mois. Ce soir, tu es venue lui annoncer que tu publiais lundi une critique assassine contre L'Armand. À 22 h 47, tu lui as envoyé : « Lundi, tout le monde saura. Tu l'auras cherché. » Après le dessert, de 23 h à 23 h 27, tu étais au téléphone avec ton rédacteur en chef dans le petit salon privé, au bout du couloir qui mène à la cave. Tu es partie à 23 h 35.",
    objectives: [
      "Cacher ta liaison avec Victor : elle te donne un mobile.",
      "Découvrir qui volait Victor.",
      "Que ta critique ne soit pas publiée en vain : prouve que tu es innocente.",
    ],
    clues: [
      { act: "acte2", text: "Au dessert, Victor t'a glissé, l'air sombre : « J'ai enfin compris qui me vole depuis des années. Je règle ça ce soir. »" },
      { act: "acte2", text: "Pendant ton appel, par la porte entrouverte du salon, tu as vu Marc remonter de la cave vers 23 h 13, sans son tablier. Mais pour le dire, il faut avouer que tu étais encore là." },
    ],
    missions: [
      { id: "h1", act: "acte1", text: "Fais avouer à Lucie qu'elle n'est pas partie à 22 h 45." },
      { id: "h2", act: "acte1", text: "Ne laisse personne découvrir ta liaison avec Victor pendant l'acte 1." },
      { id: "h3", act: "acte2", text: "Fais dire à Marc à quelle heure il est descendu à la cave." },
      { id: "h4", act: "acte2", text: "Fais poser au témoin une question sur le sommelier." },
      { id: "h5", act: "acte3", text: "Révèle ce que tu as vu à 23 h 13 avant le vote, sans qu'on te le demande." },
    ],
  },
  {
    id: "paul",
    name: "Paul Vidal",
    age: 49,
    role: "Directeur du groupe Vidal Hôtels, à Lyon",
    costume: "Costume ou blazer, chemise ouverte, montre voyante, un cigare (même éteint).",
    publicIntro: "Paul Vidal, groupe Vidal Hôtels. Victor et moi allions signer lundi. Un drame pour tout le monde, croyez-moi.",
    official: "Tu as dîné avec Victor pour finaliser le rachat de L'Armand, puis tu es parti vers 23 h, après le dessert.",
    secret: "Le rachat valorisait la cave à 400 000 €. À 22 h 58, Victor t'a envoyé un mail : « La cave ne vaut pas ce qu'on croyait, plusieurs bouteilles sont fausses. On reporte la signature. » Furieux, tu es allé fumer un cigare sur le parking. À 23 h 20, tu es descendu à la cave pour lui parler. Il était déjà mort. Tu as vu un tablier de sommelier taché jeté derrière les casiers. Tu as paniqué et tu es reparti par la porte de service sans prévenir personne.",
    objectives: [
      "Cacher que tu as trouvé le corps : ça fait de toi un suspect parfait.",
      "Découvrir qui a truqué la cave : quelqu'un a fait capoter ton affaire.",
      "Ne pas être accusé.",
    ],
    clues: [
      { act: "acte2", text: "Le tablier que tu as vu derrière les casiers était un tablier de sommelier, en cuir. Mais si tu le dis, tu avoues que tu es descendu à la cave." },
      { act: "acte2", text: "Le mail de Victor (22 h 58) est dans ton téléphone : « La cave ne vaut pas ce qu'on croyait, plusieurs bouteilles sont fausses. » Quelqu'un truquait la cave. Qui avait accès aux bouteilles ?" },
    ],
    missions: [
      { id: "p1", act: "acte1", text: "Fais dire à Hélène pourquoi elle est restée après le dessert." },
      { id: "p2", act: "acte1", text: "Pendant ton passage sur le grill, ne dis jamais que tu es descendu à la cave." },
      { id: "p3", act: "acte2", text: "Fais dire à quelqu'un qui avait accès aux bouteilles de la cave." },
      { id: "p4", act: "acte2", text: "Convaincs un joueur que Lucie avait un mobile." },
      { id: "p5", act: "acte3", text: "Révèle le tablier de sommelier avant le vote." },
    ],
  },
];

const NPC_RULES = `Tu es un témoin dans une murder party fictive : tout est inventé. Un joueur t'appelle au téléphone pour t'interroger.
- Parle comme au téléphone : français oral, naturel, 1 à 3 phrases courtes, 45 mots maximum.
- Reste dans ton personnage. Ne dis jamais que tu es une IA, ne commente jamais le jeu, pas de didascalies.
- Tu ne donnes une information importante QUE si on te pose une question qui s'en approche. Ne récite pas tout d'un coup. Si on tourne autour, fais-toi un peu prier.
- Si on te demande quelque chose que ta fiche ne dit pas, réponds que tu ne sais pas, ou invente un détail banal qui ne change rien à l'affaire.
- Tu ne connais pas le coupable. Ne désigne jamais personne comme meurtrier.`;

export const NPCS: Npc[] = [
  {
    id: "ines",
    name: "Inès Morel",
    role: "Plongeuse, elle a découvert le corps",
    initials: "IM",
    voice: "coral",
    tone: "Jeune femme de 23 ans, timide, encore sous le choc. Elle parle vite, hésite, baisse la voix sur les choses importantes, comme si elle avait peur d'être entendue.",
    unlock: "acte2",
    sheet: `Tu es Inès Morel, 23 ans, plongeuse à L'Armand depuis six mois. Tu as découvert le corps de Victor à 23 h 40, en descendant chercher des caisses à la cave. Tu es encore choquée.
CE QUE TU SAIS (ne le donne que si on te pose la bonne question) :
- Entre 23 h 10 et 23 h 30, tu étais à la plonge, en cuisine.
- Vers 23 h 15, Marc, le sommelier, est entré en cuisine et s'est lavé les mains longtemps à ton évier. Ses mains étaient rouges, tu as cru que c'était du vin. Il t'a dit qu'il avait cassé une bouteille en salle et de ne pas en parler au chef. Tu le trouves gentil, tu le défends un peu, mais tu dis la vérité si on insiste.
- Vers 23 h 20, il y avait une odeur de cigare dans l'escalier de la cave, et tu as vu « le monsieur de Lyon » remonter tout pâle et sortir par la porte de service.
- Vers 22 h 40, tu as entendu Lucie et son père se disputer très fort en cuisine, à propos de « vendre ».
- Tu as vu Lucie entrer dans la chambre froide un peu avant 23 h, les yeux rouges.`,
  },
  {
    id: "carrel",
    name: "Benoît Carrel",
    role: "Client de la table 12",
    initials: "BC",
    voice: "ash",
    tone: "Notaire retraité de 68 ans, bavard, pompeux, très sûr de lui, ravi qu'on l'écoute. Il prend son temps et savoure ses phrases.",
    unlock: "acte2",
    sheet: `Tu es Benoît Carrel, 68 ans, notaire à la retraite, grand amateur de vin. Tu dînais table 12 avec ton épouse.
CE QUE TU SAIS (ne le donne que si on te pose la bonne question) :
- Vers 22 h 50, le sommelier Marc t'a apporté un Château Margaux 1990, très cher. Tu l'as goûté : « de la piquette, une honte ». Tu l'as renvoyé.
- Vers 23 h, le chef Victor est venu lui-même à ta table, a goûté, est devenu tout blanc et a murmuré « Ce n'est pas possible… ». Il a pris la bouteille et il est descendu vers la cave. Tu ne l'as jamais revu.
- Dès que le chef a goûté, le sommelier a filé vers les cuisines. Peu après, tu l'as vu prendre le couloir de la cave, vers 23 h 05.
- Tu as remarqué une femme élégante qui téléphonait dans le petit salon privé, après 23 h.
Tu es bavard : tu aimes parler des grands crus et de ta carrière, mais tu reviens à ce qu'on te demande.`,
  },
  {
    id: "paul",
    name: "Paul Vidal",
    role: "Directeur du groupe Vidal Hôtels, acheteur du restaurant",
    initials: "PV",
    voice: "onyx",
    tone: "Homme d'affaires lyonnais de 49 ans, assuré et charmeur au début, de plus en plus nerveux quand on le coince. Voix posée qui se tend.",
    unlock: "acte2",
    sheet: `Tu es Paul Vidal, 49 ans, directeur du groupe Vidal Hôtels. Tu rachetais L'Armand, signature prévue lundi.
TA VERSION OFFICIELLE : tu as dîné avec Victor puis tu es parti vers 23 h.
CE QUE TU CACHES :
- À 22 h 58, Victor t'a écrit : « La cave ne vaut pas ce qu'on croyait, plusieurs bouteilles sont fausses. On reporte la signature. » Tu le dis si on te parle du rachat ou de la cave avec insistance.
- Tu es allé fumer un cigare sur le parking, puis à 23 h 20 tu es descendu à la cave pour parler à Victor. Il était déjà mort. Tu as vu un tablier de sommelier en cuir, taché, jeté derrière les casiers. Tu as paniqué et tu es parti par la porte de service.
QUAND TU CRAQUES : tu n'avoues être descendu à la cave que si on te parle de l'odeur de cigare dans l'escalier, ou si on te dit qu'on t'a vu remonter (Inès ou Lucie). Alors tu avoues, et tu parles du tablier de sommelier. Tu jures que Victor était déjà mort.`,
  },
];

export const npcPrompt = (n: Npc) => `${NPC_RULES}\n\nL'AFFAIRE : ${FACTS}\n\n${n.sheet}`;

export const ACTS: { id: ActId; title: string; hint: string }[] = [
  { id: "invitation", title: "Invitations", hint: "Quelques jours avant : chacun découvre son personnage et son costume. Imprimez les pièces et préparez les enveloppes 2 et 3." },
  { id: "acte1", title: "Acte 1 · Le drame (15 min)", hint: "Faites parler le commissaire. Chacun lit son dossier (2 min) et se présente avec sa phrase. Puis lancez le grill : 2 minutes chacun sur la sellette, les autres posent les questions." },
  { id: "acte2", title: "Acte 2 · Les langues se délient (25 min)", hint: "Ouvrez l'enveloppe 2 au centre de la table. Chacun reçoit 2 infos secrètes et 2 nouvelles missions. Débat libre, appel au témoin sur haut-parleur (4 questions), puis second tour de grill." },
  { id: "acte3", title: "Acte 3 · Le rapport du labo (15 min)", hint: "Ouvrez l'enveloppe 3. Dernier appel au témoin. Puis chacun accuse à voix haute, une minute chacun, et tout le monde vote sur son téléphone." },
  { id: "revelation", title: "Révélation (5 min)", hint: "Quand tout le monde a voté. Le commissaire révèle la vérité, puis le classement s'affiche." },
];

// Le grill : chaque joueur passe sur la sellette, les autres le questionnent
export const GRILL_SECONDS = 120;

// Appels au témoin : un par acte, sur le haut-parleur de l'animateur, 4 questions maximum
export const CALL_ACTS = ["acte2", "acte3"] as const;
export const QUESTIONS_PER_CALL = 4;

// Points
export const POINTS = { mission: 1, culprit: 3, motive: 1, killerEscapes: 4 };

// Pièces à conviction, imprimées et glissées dans des enveloppes
export type Evidence = { envelope: 2 | 3; id: string; kind: "ticket" | "badge" | "sms" | "labo" | "note"; title: string; lines: string[] };
export const EVIDENCE: Evidence[] = [
  { envelope: 2, id: "ticket", kind: "ticket", title: "Ticket de caisse · table 7", lines: ["L'ARMAND · TOULOUSE", "Table 7 · 2 couverts", "Menu anniv. x2 ...... 290,00", "Champagne x2 ......... 36,00", "TOTAL ............. 326,00 EUR", "Réglé par carte · 23:05", "Serveur : M. DELORME"] },
  { envelope: 2, id: "badge", kind: "badge", title: "Relevé des badges · chambre froide", lines: ["22:14  ENTRÉE  CUISINE (commis)", "22:31  SORTIE  CUISINE (commis)", "22:52  ENTRÉE  L. ARMAND", "23:21  SORTIE  L. ARMAND", "Aucun autre passage jusqu'à minuit."] },
  { envelope: 2, id: "sms", kind: "sms", title: "Téléphone de la victime · dernier SMS reçu", lines: ["De : H.", "Samedi 22:47", "Lundi, tout le monde saura. Tu l'auras cherché."] },
  { envelope: 3, id: "labo", kind: "labo", title: "Rapport du laboratoire de police scientifique", lines: [
    "La bouteille brisée près du corps est un faux Château Margaux 1990 : étiquette imprimée au laser, vin de table à l'intérieur.",
    "L'encre correspond à l'imprimante du petit bureau de la cave.",
    "Le coup a été porté avec un magnum vide, retrouvé sous l'escalier.",
    "Heure de la mort : entre 23 h 05 et 23 h 20.",
  ] },
  { envelope: 3, id: "note", kind: "note", title: "Note du commissaire · le bureau de la cave", lines: ["Le petit bureau de la cave ferme à clé.", "Il existe deux clés. L'une était dans la poche de Victor.", "La seconde n'a pas été retrouvée sur les lieux.", "Qui d'autre avait une raison d'entrer dans ce bureau, tous les soirs ?"] },
];

export const COMMISSAIRE = {
  voice: "cedar",
  tone: "Vieux commissaire de police français, voix grave, lente, fatiguée, un peu ironique. Il marque des pauses, comme s'il fumait entre deux phrases.",
  acte1: "Mesdames, messieurs… Commissaire Garnier, police judiciaire. Ce soir, à vingt-trois heures quarante, Victor Armand a été retrouvé mort dans sa cave. Frappé à la tête. Vous étiez là, tous. Et chacun de vous avait une raison de lui en vouloir. Regardez votre téléphone, lisez votre dossier, et gardez-le pour vous. Ensuite, chacun passera sur le grill. Deux minutes. Les autres poseront les questions. Et je vous préviens : l'un d'entre vous ment pour couvrir un meurtre.",
  acte2: "C'est encore moi. J'ai fait saisir quelques pièces. Ouvrez l'enveloppe numéro deux et posez tout sur la table. Chacun de vous vient aussi de recevoir des informations… à vous de voir à qui vous les confiez. Et un témoin accepte de vous parler. Un seul appel. Quatre questions. Choisissez-les bien.",
  acte3: "Le labo a parlé. Ouvrez la dernière enveloppe. Vous avez droit à un dernier appel, quatre questions. Puis chacun d'entre vous accusera, à voix haute, les yeux dans les yeux. Ensuite… vous votez.",
};

// SMS courts et sans caractères spéciaux : chaque segment de SMS est facturé
export const SMS = {
  invitation: (c: Character, link: string) =>
    `L'Armand, samedi soir : un meurtre sera commis. Tu joues ${c.name}, ${c.role.toLowerCase()}. Ton costume : ${link}`,
  acte1: (c: Character, link: string) =>
    `ACTE 1 - ${c.name.split(" ")[0]}, ton dossier secret et tes 2 missions. Ne montre rien a personne : ${link}`,
  acte2: (c: Character, link: string) =>
    `ACTE 2 - Ouvrez l'enveloppe 2. ${c.name.split(" ")[0]}, tu as 2 infos secretes et 2 nouvelles missions : ${link}`,
  acte3: (c: Character, link: string) =>
    `ACTE 3 - Ouvrez l'enveloppe 3. Derniere mission, puis vote : ${link}`,
};

export const LAB_REPORT = [
  "La bouteille brisée près du corps est un faux Château Margaux 1990 : étiquette imprimée au laser, vin de table à l'intérieur.",
  "L'encre correspond à l'imprimante du petit bureau de la cave. Seules deux clés ouvrent ce bureau.",
  "Le coup a été porté avec un magnum vide retrouvé sous l'escalier.",
  "Heure de la mort : entre 23 h 05 et 23 h 20.",
];

export const MOTIVES = [
  { id: "vol", label: "Il volait la cave et Victor l'a découvert" },
  { id: "heritage", label: "Victor vendait le restaurant au lieu de le transmettre" },
  { id: "amour", label: "Une vengeance amoureuse" },
  { id: "affaire", label: "Le rachat du restaurant tournait mal" },
];

export const SOLUTION = {
  culprit: "marc" as CharId,
  motive: "vol",
  text: "C'était Marc Delorme. Depuis trois ans, le sommelier remplaçait les grands crus de la cave par de la piquette, avec de fausses étiquettes imprimées dans le bureau dont il avait la clé. Ce soir, le client de la table 12 a renvoyé un Margaux 1990. Victor l'a goûté, et il a compris. À vingt-trois heures cinq, juste après avoir encaissé la table 7, Marc l'a suivi à la cave. Victor voulait appeler la police. Un magnum, un seul coup. Marc a jeté son tablier derrière les casiers, s'est lavé les mains à la plonge, devant Inès, et il est remonté servir. Les autres ont menti, eux aussi. Lucie pleurait dans la chambre froide. Hélène téléphonait dans le salon privé. Et Paul… Paul a trouvé le corps, et il s'est enfui. Mais un seul d'entre vous était un assassin. Affaire classée.",
};

export const charactersFor = (count: number) => (count >= 4 ? CHARACTERS : CHARACTERS.filter((c) => c.id !== "paul"));
export const npcsFor = (count: number) => NPCS.filter((n) => n.id !== "paul" || count < 4);
