# Filon

Outil de prospection : trouve les entreprises sans site web dans une ville, donne un script d'appel, des e-mails et des messages prêts, suit les prospects en Kanban et prépare le prompt du site de chaque client pour Claude.

## Ce que fait la V1

- **Scan ville + métier** (16 métiers, toute la France) via Google Places. Écarte les entreprises qui ont déjà un site, fermées ou hors de la commune. Repère celles qui n'ont qu'une page Facebook, Instagram ou un annuaire.
- **Score de priorité** sur 100 : nombre d'avis (entreprise active), note, téléphone disponible, absence totale de site.
- **Carte + liste filtrable** (note min., avis min.), export CSV.
- **Fiche entreprise** : appel en un clic, fiche Google, recherche Instagram et LinkedIn, lien vers l'annuaire officiel des entreprises pour trouver le nom du gérant.
- **Script d'appel** en 4 temps + réponses aux 5 objections courantes, adaptés au métier.
- **3 e-mails** (premier contact, relance J+3, dernière relance J+10) et **3 messages** (Instagram, LinkedIn, SMS après appel).
- **Plan d'approche par entreprise** : canal, créneau croisé avec ses horaires, dirigeant (registre officiel), angle, arguments factuels, objections probables, cadence de relance.
- **Sites à refaire** : audit automatique des sites existants et rapport partageable. Pour WordPress : version (même quand la balise « generator » est masquée), date réelle de la dernière modification d'une page ou d'un article (API publique de WordPress, plus fiable que le © du pied de page), version de PHP obsolète, thème et constructeur de pages. Filtre « WordPress à refaire », du site le plus à l'abandon au moins urgent.
- **Radar des nouvelles entreprises** : créations, arrivées et rachats de commerces publiés au BODACC, par secteur et par zone, avec le dirigeant, l'activité et la date d'ouverture. Gratuit, sans clé, aucune requête Google.
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

## Comptes et synchronisation (facultatif)

Sans base de données, Filon tourne en **mode simple** : un mot de passe unique (`APP_PASSWORD`) et les données dans le navigateur.

Pour activer les **comptes** et retrouver son pipeline sur tous ses appareils :

1. Dans Vercel, ouvre le projet, onglet **Storage**, puis **Create Database** → **Upstash for Redis** (offre gratuite) et connecte-la au projet.
2. Redéploie. Les variables `KV_REST_API_URL` et `KV_REST_API_TOKEN` sont ajoutées automatiquement et le mode comptes s'active.
3. Ouvre Filon : le **premier compte créé devient administrateur**. Les suivants ont besoin d'une invitation (Réglages → Inviter quelqu'un), sauf si `OPEN_SIGNUP=1`.

Variables facultatives :

| Variable | Rôle | Défaut |
|---|---|---|
| `AUTH_SECRET` | Clé de signature des sessions | dérivée des autres secrets |
| `MONTHLY_CALLS` | Requêtes Google par utilisateur et par mois (hors administrateur) | 300 |
| `DAILY_CALLS` | Plafond de requêtes Google pour tout l'outil, par jour | 300 |
| `OPEN_SIGNUP` | `1` pour ouvrir les inscriptions sans invitation | fermé |

## Rapport d'audit partageable

Pour chaque site à refaire, la fiche propose un lien vers un **rapport d'audit** public (`/rapport`), aux couleurs neutres et signé avec le nom de l'utilisateur. Le rapport tient entièrement dans le lien : rien n'est stocké sur le serveur.

## Avant de vendre

Déjà en place : comptes, invitations, synchronisation, crédits par utilisateur, plafond global, rapport d'audit, appli installable, sauvegarde et restauration.

Reste à faire :

- **Paiement** : Stripe Checkout et webhooks, en reliant chaque forfait à `monthlyLimit`.
- **Hébergement** : l'offre gratuite Hobby de Vercel est réservée à un usage non commercial ; passer sur l'offre Pro.
- **Conditions Google** : seuls les identifiants `place_id` peuvent être conservés durablement. Pour un usage commercial, rafraîchir le contenu des entreprises suivies depuis Google plutôt que de le stocker, et garder la mention « Données : Google ».
- **Pages légales** : CGV, mentions légales, politique de confidentialité (les noms de dirigeants sont des données personnelles).
- **Envoi d'e-mails** depuis l'outil (Resend ou équivalent) et page de présentation.

## Rappel légal

La prospection B2B par téléphone et e-mail est autorisée en France si l'offre est liée à l'activité de l'entreprise et qu'on permet au destinataire de ne plus être contacté. Le nom d'un gérant reste une donnée personnelle au sens du RGPD : ne le stocke que pour la prospection et supprime-le sur demande. Les messages fournis incluent une formule de désinscription dans la relance.

## Structure

```
app/page.tsx              interface (scan, pipeline, réglages)
app/api/scan/route.ts     scan d'une ville
app/api/details/route.ts  horaires et avis d'une entreprise
app/api/radar/route.ts    radar des nouvelles entreprises (BODACC)
lib/radar.ts              lecture et tri des annonces BODACC
lib/site-signals.ts       signaux d'ancienneté d'un site (version WordPress, PHP, thème…)
lib/scan.ts               géolocalisation, grille, Google Places, score
lib/trades.ts             métiers, directions artistiques, effets signature
lib/generators.ts         script, objections, e-mails, messages, prompt du site
components/               carte, fiche entreprise, Kanban
middleware.ts             protection par mot de passe
```

## Radar des nouvelles entreprises (onglet « Radar »)

Lit les annonces du BODACC (API ouverte de la DILA sur Opendatasoft, gratuite et sans clé) : créations et immatriculations, et ventes de fonds de commerce (un commerce racheté change souvent d'identité). Zone : un ou plusieurs départements (`31, 82`) ou codes postaux (`31000`). Secteurs : droit, professions libérales, commerces, artisans, services, ou tout.

- Les termes du secteur sont cherchés dans l'activité déclarée et le nom de l'entreprise, puis chaque annonce est reclassée par son activité : une vente rédigée par un avocat ne remonte pas dans « Droit ».
- Écartées d'office : SCI, holdings et sociétés sans activité, location meublée, livreurs et VTC, grandes franchises.
- Note de potentiel sur 100 (métier, société ou entreprise individuelle, capital, enseigne, rachat, ouverture à venir), badge « Nouveau » depuis la visite d'un jour précédent, export CSV.
- « + » ajoute l'entreprise au pipeline avec une note (date de parution, activité, ouverture, prix de rachat) ; la fiche reprend le dirigeant de l'annonce et propose le « Pack lancement ».

Limite : le BODACC couvre les sociétés et commerçants inscrits au registre du commerce. Les avocats et professions libérales installés en nom propre n'y figurent pas (il faudrait l'API Sirene de l'INSEE, avec une clé gratuite).

## Cité : test de visibilité dans les IA (`/ia`)

Page publique (sans mot de passe) : un commerçant tape son nom, son activité et sa ville ; Cité pose trois questions de client aux IA, avec recherche web, et montre s'il est cité, qui l'est à sa place, quels sites les IA ont lus, et quoi corriger. Rapport partageable par lien (`/ia/rapport?d=…`). Depuis une fiche Filon : menu « Plus » › « Tester sa visibilité dans les IA ».

Sans clé, Cité tourne en démonstration (résultats fictifs, marqués « Démo »).

| Variable | Rôle |
| --- | --- |
| `GEMINI_API_KEY` | Clé Gemini (Google AI Studio). Active les tests réels avec Gemini + recherche Google. |
| `GEMINI_MODEL` | Facultatif, défaut `gemini-flash-latest`. |
| `OPENAI_API_KEY` | Facultatif : ajoute ChatGPT (payant, environ 1 à 3 centimes par question). |
| `OPENAI_MODEL` | Facultatif, défaut `gpt-4.1-mini`. |
| `IA_DAILY_CAP` | Tests maximum par jour, défaut 50 (= 150 recherches). |
| `NEXT_PUBLIC_CITE_CONTACT` | E-mail du bouton « Être accompagné » (sinon lien vers `NEXT_PUBLIC_CITE_SITE`). |
| `NEXT_PUBLIC_CITE_SITE` | Défaut `https://thot-studio.fr`. |
| `NEXT_PUBLIC_CITE_BRAND`, `NEXT_PUBLIC_CITE_OFFER` | Nom du studio et phrase d'offre affichés en bas du rapport. |
