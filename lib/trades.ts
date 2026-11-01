import { ART_VENUES } from "./art";
// Métiers ciblés + préréglages pour la génération des sites.
// Chaque métier a plusieurs variantes de direction artistique :
// deux entreprises du même métier n'obtiennent pas le même site.

export type SiteVariant = {
  name: string;
  palette: { bg: string; ink: string; accent: string; soft: string };
  fonts: string; // Google Fonts conseillées
  layout: string;
};

export type Trade = {
  id: string;
  label: string; // pluriel, pour l'UI
  singular: string;
  query: string; // requête Google Places
  effect: { name: string; description: string };
  sections: string[];
  hookDetail: string; // argument d'appel spécifique au métier
  variants: SiteVariant[];
  art?: boolean; // lieu à démarcher pour tes tableaux
};

export const TRADES: Trade[] = [
  {
    id: "boulangerie",
    label: "Boulangeries",
    singular: "boulangerie",
    query: "boulangerie",
    effect: {
      name: "La fournée",
      description:
        "Au chargement, une volute de vapeur en SVG monte derrière le titre puis se dissipe ; les horaires du jour s'allument comme un four qui chauffe.",
    },
    sections: ["Accueil avec horaires du jour", "Nos pains et viennoiseries", "Commandes spéciales (gâteaux, événements)", "Avis clients", "Accès et contact"],
    hookDetail: "les gens cherchent « boulangerie ouverte » sur Google le dimanche matin",
    variants: [
      { name: "Farine et bois", palette: { bg: "#F6F0E4", ink: "#2B1D12", accent: "#B5651D", soft: "#E8DCC4" }, fonts: "Fraunces + Inter", layout: "Grand titre éditorial, photos plein cadre, grille asymétrique" },
      { name: "Fournil moderne", palette: { bg: "#1E1B18", ink: "#F3E9D8", accent: "#E8A33D", soft: "#2E2925" }, fonts: "Archivo + Archivo Narrow", layout: "Fond sombre, typographie condensée, sections en bandeaux" },
      { name: "Boutique de quartier", palette: { bg: "#FFFDF8", ink: "#203040", accent: "#D94F30", soft: "#F1E6D6" }, fonts: "DM Serif Display + DM Sans", layout: "Ardoise du jour en encart, liste des produits façon menu" },
    ],
  },
  {
    id: "coiffeur",
    label: "Coiffeurs",
    singular: "salon de coiffure",
    query: "salon de coiffure",
    effect: { name: "Le coup de ciseaux", description: "Le titre est découpé en deux moitiés qui se décalent puis se recollent, comme coupé net, au chargement et au survol du bouton de réservation." },
    sections: ["Accueil", "Prestations et tarifs", "L'équipe", "Réalisations (galerie)", "Avis", "Réserver / appeler"],
    hookDetail: "vos clientes comparent les salons sur leur téléphone avant de réserver",
    variants: [
      { name: "Atelier", palette: { bg: "#F4F1EE", ink: "#161616", accent: "#9C6B5A", soft: "#E6DFD8" }, fonts: "Cormorant Garamond + Manrope", layout: "Très aéré, grandes photos portrait, tarifs en colonnes fines" },
      { name: "Studio pop", palette: { bg: "#FFF2F6", ink: "#1A1033", accent: "#FF2E7E", soft: "#FFD6E5" }, fonts: "Syne + Inter", layout: "Blocs colorés, galerie en mosaïque" },
      { name: "Barbier", palette: { bg: "#14171A", ink: "#EDE6DA", accent: "#C8A16A", soft: "#22272C" }, fonts: "Oswald + Source Sans 3", layout: "Sombre, typographie haute, tarifs façon enseigne" },
    ],
  },
  {
    id: "plombier",
    label: "Plombiers",
    singular: "plombier",
    query: "plombier",
    effect: { name: "La goutte", description: "Une goutte tombe dans le titre et forme une onde circulaire qui révèle le numéro d'urgence." },
    sections: ["Accueil avec numéro d'urgence", "Interventions (fuite, chauffe-eau, débouchage…)", "Zone d'intervention", "Avis", "Devis / contact"],
    hookDetail: "en cas de fuite, les gens appellent le premier artisan qui a un site rassurant",
    variants: [
      { name: "Urgence", palette: { bg: "#F2F6FA", ink: "#0E2236", accent: "#0077FF", soft: "#DCE8F4" }, fonts: "Space Grotesk + Inter", layout: "Numéro d'appel géant en haut, interventions en liste claire" },
      { name: "Artisan de confiance", palette: { bg: "#FBFAF7", ink: "#1F2A2E", accent: "#2E8B7A", soft: "#E3EDE9" }, fonts: "Bitter + Lato", layout: "Portrait de l'artisan, ton humain, zone sur carte" },
      { name: "Technique", palette: { bg: "#101820", ink: "#E8F1F8", accent: "#3DD6F5", soft: "#1B2733" }, fonts: "IBM Plex Sans Condensed + IBM Plex Sans", layout: "Sombre, schémas techniques en filigrane" },
    ],
  },
  {
    id: "electricien",
    label: "Électriciens",
    singular: "électricien",
    query: "électricien",
    effect: { name: "Le courant", description: "Un trait lumineux parcourt le contour du titre comme un fil sous tension, puis le bouton d'appel s'allume." },
    sections: ["Accueil", "Services (dépannage, rénovation, mise aux normes, bornes de recharge)", "Zone d'intervention", "Avis", "Devis"],
    hookDetail: "les demandes de bornes de recharge et de mise aux normes passent par Google",
    variants: [
      { name: "Haute tension", palette: { bg: "#111111", ink: "#F5F5F0", accent: "#FFD400", soft: "#222222" }, fonts: "Barlow Condensed + Barlow", layout: "Contraste fort, services en grille" },
      { name: "Clair et net", palette: { bg: "#F7F8FA", ink: "#14213D", accent: "#FCA311", soft: "#E5E8EE" }, fonts: "Outfit + Inter", layout: "Sobre, icônes linéaires, devis en avant" },
    ],
  },
  {
    id: "garage",
    label: "Garages",
    singular: "garage automobile",
    query: "garage automobile",
    effect: { name: "Le compte-tours", description: "Une aiguille de compte-tours monte en régime puis se stabilise à côté du titre ; les prestations défilent comme un tableau de bord." },
    sections: ["Accueil", "Entretien et réparations", "Pneus / carrosserie", "Prise de rendez-vous", "Avis", "Accès"],
    hookDetail: "les automobilistes comparent les garages et les avis avant de confier leur voiture",
    variants: [
      { name: "Atelier mécanique", palette: { bg: "#EDEDEA", ink: "#151515", accent: "#E63A1E", soft: "#D9D9D4" }, fonts: "Big Shoulders Display + Work Sans", layout: "Typographie industrielle, bandes diagonales" },
      { name: "Concession locale", palette: { bg: "#FFFFFF", ink: "#0F1E3D", accent: "#1C6EF2", soft: "#E9EFFA" }, fonts: "Sora + Inter", layout: "Propre, tarifs indicatifs, prise de RDV en avant" },
    ],
  },
  {
    id: "fleuriste",
    label: "Fleuristes",
    singular: "fleuriste",
    query: "fleuriste",
    effect: { name: "L'éclosion", description: "Des pétales en SVG s'ouvrent autour du titre puis se figent ; au défilement, une tige pousse le long de la page." },
    sections: ["Accueil", "Bouquets et compositions", "Mariages et événements", "Deuil", "Livraison", "Avis", "Contact"],
    hookDetail: "les commandes de mariage et de deuil se décident en ligne, souvent le soir",
    variants: [
      { name: "Herbier", palette: { bg: "#F5F2EA", ink: "#25301F", accent: "#C2577A", soft: "#E4E6D6" }, fonts: "Playfair Display + Karla", layout: "Botanique, illustrations au trait, galerie verticale" },
      { name: "Couleur franche", palette: { bg: "#FFF8EE", ink: "#2A1B3D", accent: "#FF6B35", soft: "#FFE3CC" }, fonts: "Recoleta (ou Fraunces) + Nunito Sans", layout: "Aplats de couleur, gros visuels" },
    ],
  },
  {
    id: "restaurant",
    label: "Restaurants",
    singular: "restaurant",
    query: "restaurant",
    effect: { name: "Le service", description: "La carte se déplie comme un menu plié en trois au clic ; le plat du jour apparaît à l'écriture, comme sur une ardoise." },
    sections: ["Accueil", "La carte", "Plat / menu du jour", "Réserver", "Avis", "Accès et horaires"],
    hookDetail: "les gens choisissent un restaurant en regardant la carte et les photos sur leur téléphone",
    variants: [
      { name: "Bistrot", palette: { bg: "#F3EDE2", ink: "#1D1A16", accent: "#8E2F2F", soft: "#E3D8C5" }, fonts: "Libre Caslon Display + Libre Franklin", layout: "Carte façon ardoise, typographie classique" },
      { name: "Cantine moderne", palette: { bg: "#FAFAF5", ink: "#202020", accent: "#2F9E44", soft: "#ECEDE3" }, fonts: "Clash Grotesk (ou Space Grotesk) + Inter", layout: "Photos carrées, menu en blocs" },
      { name: "Table du soir", palette: { bg: "#151413", ink: "#EFE8DC", accent: "#D4A24C", soft: "#24211E" }, fonts: "Bodoni Moda + Jost", layout: "Sombre et feutré, plein écran photo" },
    ],
  },
  {
    id: "boucherie",
    label: "Boucheries",
    singular: "boucherie",
    query: "boucherie",
    effect: { name: "Le billot", description: "Le titre tombe d'un coup sec, comme posé sur le billot, avec un léger rebond ; les produits s'alignent comme une vitrine." },
    sections: ["Accueil", "Nos viandes et origines", "Traiteur", "Commandes (fêtes, barbecue)", "Avis", "Horaires"],
    hookDetail: "les commandes de fêtes et de barbecue se font de plus en plus en ligne",
    variants: [
      { name: "Tradition", palette: { bg: "#F7F1EA", ink: "#2A1414", accent: "#A4161A", soft: "#EAD9CF" }, fonts: "Abril Fatface + Rubik", layout: "Enseigne forte, origines des viandes mises en avant" },
      { name: "Épicerie fine", palette: { bg: "#FBF9F4", ink: "#1E2420", accent: "#6B4226", soft: "#ECE6DA" }, fonts: "Gloock + Figtree", layout: "Élégant, traiteur en vedette" },
    ],
  },
  {
    id: "beaute",
    label: "Instituts de beauté",
    singular: "institut de beauté",
    query: "institut de beauté",
    effect: { name: "Le voile", description: "Un voile translucide glisse et révèle le titre en douceur ; les prestations s'ouvrent en accordéon." },
    sections: ["Accueil", "Soins et tarifs", "Épilation / ongles / visage", "Cartes cadeaux", "Avis", "Réserver"],
    hookDetail: "vos clientes réservent le soir sur leur téléphone, quand le salon est fermé",
    variants: [
      { name: "Spa", palette: { bg: "#F4EFEA", ink: "#2C2420", accent: "#B98B73", soft: "#E8DED5" }, fonts: "Italiana + Mulish", layout: "Très doux, beaucoup d'espace" },
      { name: "Nail studio", palette: { bg: "#FFF5F7", ink: "#240B1E", accent: "#D6336C", soft: "#FCE1E8" }, fonts: "Unbounded + Inter", layout: "Galerie de réalisations en vedette" },
    ],
  },
  {
    id: "macon",
    label: "Maçons",
    singular: "maçon",
    query: "maçonnerie",
    effect: { name: "Le mur", description: "Les blocs du titre s'empilent rang par rang au chargement, comme un mur monté en accéléré." },
    sections: ["Accueil", "Travaux (gros œuvre, rénovation, extension)", "Réalisations avant/après", "Zone d'intervention", "Avis", "Devis"],
    hookDetail: "les particuliers demandent plusieurs devis et choisissent celui qui montre ses chantiers",
    variants: [
      { name: "Brique", palette: { bg: "#F3EEE8", ink: "#231A15", accent: "#B4472B", soft: "#E3D6CA" }, fonts: "Anton + Work Sans", layout: "Avant/après en curseur, chiffres clés" },
      { name: "Chantier", palette: { bg: "#F5F5F2", ink: "#1C1C1C", accent: "#F2A900", soft: "#E4E4DE" }, fonts: "Archivo Black + Archivo", layout: "Industriel, photos de chantiers en grand" },
    ],
  },
  {
    id: "menuisier",
    label: "Menuisiers",
    singular: "menuisier",
    query: "menuisier",
    effect: { name: "Le copeau", description: "Un copeau de bois se déroule sous le titre et dessine un soulignement ; les veinures apparaissent en fond au défilement." },
    sections: ["Accueil", "Créations sur mesure", "Fenêtres et portes", "Réalisations", "Avis", "Devis"],
    hookDetail: "le sur-mesure se vend avec des photos de réalisations",
    variants: [
      { name: "Bois brut", palette: { bg: "#F4EEE4", ink: "#2A2118", accent: "#8A5A2B", soft: "#E5D8C4" }, fonts: "Young Serif + Outfit", layout: "Galerie de réalisations en grand format" },
      { name: "Design intérieur", palette: { bg: "#FAFAF8", ink: "#1B1B1B", accent: "#4A6B52", soft: "#ECEEE8" }, fonts: "Cabinet Grotesk (ou Manrope) + Manrope", layout: "Minimal, façon catalogue de mobilier" },
    ],
  },
  {
    id: "peintre",
    label: "Peintres en bâtiment",
    singular: "peintre en bâtiment",
    query: "peintre en bâtiment",
    effect: { name: "Le coup de rouleau", description: "Un passage de rouleau en SVG recouvre l'écran et dévoile le site, la couleur d'accent reste en bandeau." },
    sections: ["Accueil", "Peinture intérieure / extérieure", "Ravalement de façade", "Réalisations", "Avis", "Devis"],
    hookDetail: "les gens veulent voir des chantiers avant de confier leur maison",
    variants: [
      { name: "Nuancier", palette: { bg: "#FFFFFF", ink: "#1A1A1A", accent: "#2563EB", soft: "#EEF2FB" }, fonts: "Familjen Grotesk + Inter", layout: "Pastilles de couleur, avant/après" },
      { name: "Façade", palette: { bg: "#F2EFEA", ink: "#262626", accent: "#C0582E", soft: "#E3DED6" }, fonts: "Fraunces + Public Sans", layout: "Photos de façades en grand, ton rassurant" },
    ],
  },
  {
    id: "paysagiste",
    label: "Paysagistes",
    singular: "paysagiste",
    query: "paysagiste",
    effect: { name: "La pousse", description: "Des brins d'herbe poussent depuis le bas du hero, au rythme du défilement." },
    sections: ["Accueil", "Création de jardins", "Entretien", "Réalisations", "Avis", "Devis"],
    hookDetail: "les contrats d'entretien se décrochent souvent via une recherche locale",
    variants: [
      { name: "Jardin", palette: { bg: "#F1F3EA", ink: "#1E2A1C", accent: "#4C8C2B", soft: "#DFE5D1" }, fonts: "Lora + Nunito Sans", layout: "Grandes photos, saisons" },
      { name: "Architecte paysage", palette: { bg: "#FAFAF7", ink: "#141A14", accent: "#7A8B3A", soft: "#E8EADF" }, fonts: "Instrument Serif + Instrument Sans", layout: "Épuré, plans de jardins en illustration" },
    ],
  },
  {
    id: "photographe",
    label: "Photographes",
    singular: "photographe",
    query: "photographe",
    effect: { name: "Le déclencheur", description: "Un obturateur à lamelles s'ouvre au chargement et révèle la première photo du portfolio." },
    sections: ["Accueil", "Portfolio", "Prestations (mariage, portrait, entreprise)", "Tarifs", "Avis", "Contact"],
    hookDetail: "un photographe sans portfolio en ligne perd les mariages au profit de ceux qui en ont un",
    variants: [
      { name: "Galerie", palette: { bg: "#0F0F0F", ink: "#F2F2F2", accent: "#E9E4D8", soft: "#1C1C1C" }, fonts: "Cormorant + Inter", layout: "Plein écran, photos d'abord" },
      { name: "Lumière", palette: { bg: "#FBFAF8", ink: "#1C1C1C", accent: "#B08D57", soft: "#EFECE6" }, fonts: "Bodoni Moda + Karla", layout: "Grille éditoriale, beaucoup de blanc" },
    ],
  },
  {
    id: "avocat",
    label: "Avocats",
    singular: "cabinet d'avocat",
    query: "avocat",
    effect: { name: "Le sceau", description: "Le monogramme du cabinet s'imprime comme un sceau de cire puis le titre apparaît ligne par ligne." },
    sections: ["Accueil", "Domaines d'intervention", "L'avocat / le cabinet", "Honoraires (principes)", "Prendre rendez-vous", "Accès"],
    hookDetail: "les justiciables cherchent « avocat + spécialité + ville » sur Google avant d'appeler",
    variants: [
      { name: "Cabinet", palette: { bg: "#F5F3EF", ink: "#13213C", accent: "#8C6D3F", soft: "#E6E1D7" }, fonts: "Libre Caslon Text + Inter", layout: "Sobre, domaines en colonnes, très lisible" },
      { name: "Contemporain", palette: { bg: "#FFFFFF", ink: "#111827", accent: "#7C3AED", soft: "#F1EDFB" }, fonts: "Newsreader + Geist (ou Inter)", layout: "Moderne, grandes citations, prise de RDV visible" },
    ],
  },
  {
    id: "notaire",
    label: "Notaires",
    singular: "office notarial",
    query: "notaire",
    effect: { name: "La signature", description: "Une signature manuscrite se trace en SVG sous le nom de l'office." },
    sections: ["Accueil", "Domaines (immobilier, famille, entreprise)", "L'office", "Documents à préparer", "Contact et accès"],
    hookDetail: "les clients cherchent les pièces à fournir et les horaires avant d'appeler",
    variants: [
      { name: "Office", palette: { bg: "#F4F2EE", ink: "#1C2533", accent: "#2F5D62", soft: "#E3E2DC" }, fonts: "EB Garamond + Source Sans 3", layout: "Institutionnel, rassurant" },
    ],
  },
];

// Lieux pour tes tableaux, au même format que les métiers (même scan, même pipeline)
export const ART_TRADES: Trade[] = ART_VENUES.map((v) => ({
  id: v.id, label: v.label, singular: v.singular, query: v.query, hookDetail: v.wall,
  effect: { name: "", description: "" }, sections: [], variants: [], art: true,
}));

export function getTrade(id: string): Trade | undefined {
  return TRADES.find((t) => t.id === id) || ART_TRADES.find((t) => t.id === id);
}

// Choix déterministe d'une variante à partir de l'identifiant Google de l'entreprise.
export function pickVariant(trade: Trade, seed: string): SiteVariant {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return trade.variants[h % trade.variants.length];
}
