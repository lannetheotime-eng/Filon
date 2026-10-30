# Filon

Outil de prospection : trouve les entreprises sans site web dans une ville, donne un script d'appel, des e-mails et des messages prêts, suit les prospects en Kanban et prépare le prompt du site de chaque client pour Claude.

## Ce que fait la V1

- **Scan ville + métier** (16 métiers, toute la France) via Google Places. Écarte les entreprises qui ont déjà un site, fermées ou hors de la commune. Repère celles qui n'ont qu'une page Facebook, Instagram ou un annuaire.
- **Score de priorité** sur 100 : nombre d'avis (entreprise active), note, téléphone disponible, absence totale de site.
- **Carte + liste filtrable** (note min., avis min.), export CSV.
- **Fiche entreprise** : appel en un clic, fiche Google, recherche Instagram et LinkedIn, lien vers l'annuaire officiel des entreprises pour trouver le nom du gérant.
- **Script d'appel** en 4 temps + réponses aux 5 objections courantes, adaptés au métier.
- **3 e-mails** (premier contact, relance J+3, dernière relance J+10) et **3 messages** (Instagram, LinkedIn, SMS après appel).
- **Prompt de site** : vraies infos, horaires et avis Google à la demande, direction artistique et effet signature propres au métier, variante choisie selon l'entreprise (deux boulangeries n'ont pas le même site), SEO local avec JSON-LD.
- **Pipeline Kanban** (glisser-déposer) avec notes, date de relance et alerte des relances du jour, export CSV.
- **Réglages** : prénom, studio, offre et prix utilisés dans tous les textes.

Les données (entreprises, pipeline, réglages) sont stockées dans le navigateur. Exporte en CSV régulièrement.

## Installation en local

```bash
npm install
cp .env.example .env.local   # puis renseigne la clé
npm run dev                  # http://localhost:3000
```

Sans clé Google, l'outil tourne en **mode démo** avec des données fictives.

## Obtenir la clé Google Places

1. Crée un projet sur https://console.cloud.google.com et active la facturation (une carte est demandée).
2. Active **Places API (New)** dans « API et services ».
3. Crée une clé API, puis restreins-la à « Places API (New) ».
4. Fixe un **plafond de quota** journalier dans la console, pour ne jamais être surpris par la facture.

Coût : chaque scan rapide fait 1 à 3 requêtes Text Search ; un scan complet d'une grande ville en fait jusqu'à 48 (grille de 4 × 4, 3 pages par case). Les champs téléphone, site et avis sont dans le niveau de tarification le plus élevé de Text Search. Google offre un quota gratuit mensuel par type de requête : vérifie la grille à jour sur https://developers.google.com/maps/billing-and-pricing/pricing avant de lancer de gros volumes.

## Mise en ligne sur Vercel

1. Pousse le dossier sur un dépôt GitHub privé.
2. Sur https://vercel.com, « Add New Project », importe le dépôt.
3. Dans « Environment Variables », ajoute `GOOGLE_PLACES_API_KEY` et **`APP_PASSWORD`**.
4. Déploie. Le navigateur demande un identifiant (n'importe lequel) et le mot de passe.

`APP_PASSWORD` est important : sans lui, n'importe qui trouvant l'adresse pourrait consommer ta clé.

## Passer en SaaS (étape suivante)

L'architecture est prête, il reste à ajouter :

- **Comptes** : Supabase Auth (ou Clerk) à la place du mot de passe unique.
- **Base de données** : tables `leads`, `pipeline`, `profiles`, `scans` dans Supabase à la place du stockage navigateur (`lib/store.ts`).
- **Crédits** : décompter les recherches par utilisateur dans `app/api/scan/route.ts`, et mettre les résultats en cache par ville et métier pour ne pas repayer Google à chaque client.
- **Paiement** : Stripe Checkout + webhooks pour les forfaits.
- **Légal** : CGV, politique de confidentialité, et vérification des conditions de Google sur la conservation des données Places (seul l'identifiant `place_id` peut être stocké durablement).

## Rappel légal

La prospection B2B par téléphone et e-mail est autorisée en France si l'offre est liée à l'activité de l'entreprise et qu'on permet au destinataire de ne plus être contacté. Le nom d'un gérant reste une donnée personnelle au sens du RGPD : ne le stocke que pour la prospection et supprime-le sur demande. Les messages fournis incluent une formule de désinscription dans la relance.

## Structure

```
app/page.tsx              interface (scan, pipeline, réglages)
app/api/scan/route.ts     scan d'une ville
app/api/details/route.ts  horaires et avis d'une entreprise
lib/scan.ts               géolocalisation, grille, Google Places, score
lib/trades.ts             métiers, directions artistiques, effets signature
lib/generators.ts         script, objections, e-mails, messages, prompt du site
components/               carte, fiche entreprise, Kanban
middleware.ts             protection par mot de passe
```
