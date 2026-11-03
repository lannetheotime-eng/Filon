// Annonces d'exemple au format Melo, pour voir la recherche fonctionner sans clé.
// Inventées : elles ne correspondent à aucun bien réel.
export const DEMO_MELO = [
  {
    uuid: "demo-1", title: "T2 vendu loué - Saint-Cyprien", price: 168000, surface: 44,
    description: "Appartement T2 vendu loué, locataire en place depuis 2022. Loyer 690 € HC. Surface loi Carrez : 43,2 m². Bail en cours jusqu'en août 2028. Proche métro.",
    city: { name: "Toulouse", zipcode: "31300" }, adverts: [{ publisher: { name: "Exemple" } }], createdAt: "2026-11-02",
  },
  {
    uuid: "demo-2", title: "Studio étudiant - Rangueil", price: 92000, surface: 21,
    description: "Studio meublé actuellement loué 520 € CC à un étudiant. 20,5 m² Carrez. Idéal investisseur, rentabilité immédiate.",
    city: { name: "Toulouse", zipcode: "31400" }, adverts: [{ publisher: { name: "Exemple" } }], createdAt: "2026-11-01",
  },
  {
    uuid: "demo-3", title: "Immeuble de rapport 3 lots", price: 395000, surface: 168,
    description: "Immeuble entièrement loué : 3 appartements, revenus locatifs annuels 31 200 € HC. Surface Carrez totale 161 m². Toiture refaite.",
    city: { name: "Toulouse", zipcode: "31200" }, adverts: [{ publisher: { name: "Exemple" } }], createdAt: "2026-10-31",
  },
  {
    uuid: "demo-4", title: "T3 avec balcon - Minimes", price: 239000, surface: 66,
    description: "Bel appartement T3 vendu occupé, bail de 3 ans signé en 2025, loyer 890 € HC. Loi Carrez 64,8 m². Parking inclus.",
    city: { name: "Toulouse", zipcode: "31200" }, adverts: [{ publisher: { name: "Exemple" } }], createdAt: "2026-10-30",
  },
  {
    uuid: "demo-5", title: "Maison T4 avec jardin", price: 312000, surface: 95,
    description: "Maison familiale libre de toute occupation, 95 m² habitables, jardin de 400 m².",
    city: { name: "Colomiers", zipcode: "31770" }, adverts: [{ publisher: { name: "Exemple" } }], createdAt: "2026-10-29",
  },
  {
    uuid: "demo-6", title: "T2 investisseur - Compans", price: 149000, surface: 39,
    description: "T2 pour investisseur, loyer estimé 650 € par mois. 38 m² Carrez. Copropriété bien tenue.",
    city: { name: "Toulouse", zipcode: "31000" }, adverts: [{ publisher: { name: "Exemple" } }], createdAt: "2026-10-28",
  },
];
