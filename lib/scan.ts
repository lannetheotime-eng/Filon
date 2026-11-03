import "server-only";
import type { Lead, ScanResult, WebPresence, Details, OpenPeriod } from "./types";
import { getTrade } from "./trades";
import { auditMany } from "./audit";

const PLACES_URL = "https://places.googleapis.com/v1/places:searchText";

// Domaines qui ne comptent pas comme un vrai site : réseaux, annuaires, plateformes de réservation.
const NOT_A_SITE = [
  "facebook.com", "fb.com", "instagram.com", "linktr.ee", "linktree", "tiktok.com",
  "pagesjaunes.fr", "business.site", "g.page", "sites.google.com", "wixsite.com",
  "planity.com", "treatwell", "doctolib.fr", "ubereats.com", "deliveroo", "justeat",
  "thefork.fr", "lafourchette", "tripadvisor", "linkedin.com", "yelp.", "houzz", "habitatpresto",
  "travaux.com", "starofservice", "kiute", "booksy.com",
];

type Commune = {
  nom: string;
  codeDepartement: string;
  population?: number;
  centre: { coordinates: [number, number] };
  contour?: { type: "Polygon" | "MultiPolygon"; coordinates: any };
};

export async function geocodeCity(q: string): Promise<Commune> {
  const isCp = /^\d{5}$/.test(q.trim());
  const url = isCp
    ? `https://geo.api.gouv.fr/communes?codePostal=${q.trim()}&fields=nom,codeDepartement,population,centre,contour&format=json`
    : `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q.trim())}&fields=nom,codeDepartement,population,centre,contour&boost=population&limit=5&format=json`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    throw new Error("Impossible de joindre geo.api.gouv.fr pour localiser la commune. Réessaie dans un instant.");
  }
  if (!res.ok) throw new Error("Le service de géolocalisation des communes ne répond pas.");
  const list = (await res.json()) as Commune[];
  if (!list.length) throw new Error(`Aucune commune trouvée pour « ${q} ». Vérifie l'orthographe ou tape le code postal.`);
  // La plus peuplée en premier
  list.sort((a, b) => (b.population || 0) - (a.population || 0));
  return list[0];
}

// Zone circulaire autour d'une adresse (Base Adresse Nationale, gratuite et sans clé)
export async function geocodeAround(address: string, city: string, radius: number): Promise<Commune & { label: string }> {
  const q = `${address} ${city}`.trim();
  let res: Response;
  try {
    res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`, { cache: "no-store" });
  } catch {
    throw new Error("Impossible de joindre la Base Adresse Nationale. Réessaie dans un instant.");
  }
  if (!res.ok) throw new Error("La Base Adresse Nationale ne répond pas.");
  const f = (await res.json()).features?.[0];
  if (!f) throw new Error(`Adresse introuvable : « ${address} ». Essaie une rue, une place ou un nom de quartier.`);
  const [lng, lat] = f.geometry.coordinates as [number, number];
  const r = Math.max(200, Math.min(5000, radius));
  const ring: [number, number][] = [];
  for (let i = 0; i <= 36; i++) {
    const a = (i / 36) * 2 * Math.PI;
    ring.push([lng + (r / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a), lat + (r / 110540) * Math.sin(a)]);
  }
  return {
    nom: f.properties.city || city,
    codeDepartement: String(f.properties.context || "").split(",")[0].trim(),
    centre: { coordinates: [lng, lat] },
    contour: { type: "Polygon", coordinates: [ring] },
    label: f.properties.label,
  };
}

function rings(contour: Commune["contour"]): [number, number][][] {
  if (!contour) return [];
  if (contour.type === "Polygon") return [contour.coordinates[0]];
  return contour.coordinates.map((p: any) => p[0]);
}

function bbox(c: Commune) {
  const pts = rings(c.contour).flat();
  if (!pts.length) {
    const [lng, lat] = c.centre.coordinates;
    return { minLat: lat - 0.03, maxLat: lat + 0.03, minLng: lng - 0.04, maxLng: lng + 0.04 };
  }
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const [lng, lat] of pts) {
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
  }
  return { minLat, maxLat, minLng, maxLng };
}

function inside(lng: number, lat: number, ring: [number, number][]) {
  let ok = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) ok = !ok;
  }
  return ok;
}

function inCommune(c: Commune, lng: number, lat: number) {
  const r = rings(c.contour);
  if (!r.length) return true;
  return r.some((ring) => inside(lng, lat, ring));
}

export function classify(uri?: string): { presence: WebPresence | "site"; social?: string } {
  if (!uri) return { presence: "aucun" };
  const u = uri.toLowerCase();
  if (NOT_A_SITE.some((d) => u.includes(d))) return { presence: "reseaux", social: uri };
  return { presence: "site" };
}

// Score de priorité sur 100 : qui appeler en premier.
export function scoreLead(l: { rating?: number; reviews?: number; phone?: string; presence: WebPresence }) {
  const reviews = l.reviews || 0;
  const activity = Math.min(40, Math.round((Math.log10(reviews + 1) / Math.log10(301)) * 40)); // 300 avis = plein
  const rating = l.rating ? Math.round(Math.max(0, (l.rating - 3) / 2) * 25) : 0;
  const phone = l.phone ? 20 : 0;
  const gap = l.presence === "aucun" ? 15 : l.presence === "vieux" ? 12 : 8;
  return Math.min(100, activity + rating + phone + gap);
}


// Horaires Google → plages simples par jour (minutes depuis minuit)
export function toPeriods(roh: any): OpenPeriod[] | undefined {
  const ps = roh?.periods;
  if (!Array.isArray(ps) || !ps.length) return undefined;
  const out: OpenPeriod[] = [];
  for (const p of ps) {
    if (!p.open) continue;
    const open = (p.open.hour || 0) * 60 + (p.open.minute || 0);
    // Pas de fermeture = ouvert 24 h/24 ; fermeture le lendemain = jusqu'à minuit
    let close = p.close ? (p.close.hour || 0) * 60 + (p.close.minute || 0) : 24 * 60;
    if (p.close && p.close.day !== p.open.day) close = 24 * 60;
    out.push({ day: p.open.day, open, close: close || 24 * 60 });
  }
  return out.length ? out : undefined;
}

// Distance en mètres entre deux points
function meters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (bLat - aLat) * toR, dLng = (bLng - aLng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

type Rival = { name: string; lat: number; lng: number; rating?: number; reviews?: number };

// Contexte concurrentiel : concurrent le plus proche avec un site correct, part des entreprises équipées
function addContext(leads: Lead[], rivals: Rival[], total: number, equipped: number) {
  const siteShare = total ? Math.round((equipped / total) * 100) : undefined;
  for (const l of leads) {
    let best: (Rival & { d: number }) | undefined;
    for (const r of rivals) {
      const d = meters(l.lat, l.lng, r.lat, r.lng);
      if (d <= 3000 && (!best || d < best.d)) best = { ...r, d };
    }
    l.context = {
      total,
      siteShare,
      rival: best ? { name: best.name, distance: best.d, rating: best.rating, reviews: best.reviews } : undefined,
    };
  }
}

type Tile = { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } };

function tiles(c: Commune, deep: boolean): Tile[] {
  const b = bbox(c);
  const pop = c.population || 10000;
  const n = deep ? Math.max(1, Math.min(3, Math.ceil(Math.sqrt(pop / 60000)))) : 1; // 9 zones max = 27 requêtes
  const out: Tile[] = [];
  const dLat = (b.maxLat - b.minLat) / n, dLng = (b.maxLng - b.minLng) / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      out.push({
        low: { latitude: b.minLat + i * dLat, longitude: b.minLng + j * dLng },
        high: { latitude: b.minLat + (i + 1) * dLat, longitude: b.minLng + (j + 1) * dLng },
      });
  return out;
}

const FIELDS = [
  "places.id", "places.displayName", "places.formattedAddress", "places.nationalPhoneNumber",
  "places.internationalPhoneNumber", "places.websiteUri", "places.rating", "places.userRatingCount",
  "places.location", "places.googleMapsUri", "places.businessStatus", "places.primaryTypeDisplayName",
  "places.regularOpeningHours", "places.photos",
  "nextPageToken",
].join(",");

async function searchTile(key: string, query: string, tile: Tile, maxPages: number) {
  const places: any[] = [];
  let pageToken: string | undefined;
  let calls = 0;
  for (let p = 0; p < maxPages; p++) {
    const body: any = { textQuery: query, languageCode: "fr", regionCode: "FR", pageSize: 20, locationRestriction: { rectangle: tile } };
    if (pageToken) body.pageToken = pageToken;
    const res = await fetch(PLACES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    calls++;
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Places a refusé la requête (${res.status}). ${err.slice(0, 300)}`);
    }
    const json = await res.json();
    places.push(...(json.places || []));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return { places, calls };
}

export async function scan(cityQuery: string, tradeId: string, deep: boolean, includeOld = false, includeAll = false, around?: { address: string; radius: number }): Promise<ScanResult> {
  const trade = getTrade(tradeId);
  if (!trade) throw new Error("Métier inconnu.");
  const key = process.env.GOOGLE_PLACES_API_KEY;
  let commune: Commune;
  let zone: string | undefined;
  try {
    if (around?.address) {
      const g = await geocodeAround(around.address, cityQuery, around.radius);
      commune = g;
      zone = `${around.radius >= 1000 ? `${around.radius / 1000} km` : `${around.radius} m`} autour de ${g.label}`;
    } else commune = await geocodeCity(cityQuery);
  } catch (e) {
    if (key) throw e;
    // Mode démo hors ligne : position par défaut (Toulouse)
    commune = { nom: cityQuery.trim(), codeDepartement: "31", centre: { coordinates: [1.444, 43.6045] } };
  }
  const [lng, lat] = commune.centre.coordinates;
  const city = { name: commune.nom, dept: commune.codeDepartement, lat, lng, zone };

  if (!key) return demoScan(city, tradeId, includeOld || includeAll, includeAll);

  const seen = new Map<string, any>();
  let calls = 0;
  const ts = tiles(commune, deep && !zone);
  // Requêtes par lots de 4 pour rester raisonnable
  for (let i = 0; i < ts.length; i += 4) {
    const batch = await Promise.all(ts.slice(i, i + 4).map((t) => searchTile(key, `${trade.query} ${commune.nom}`, t, 3)));
    for (const r of batch) {
      calls += r.calls;
      for (const p of r.places) if (!seen.has(p.id)) seen.set(p.id, p);
    }
  }

  let withSite = 0;
  const leads: Lead[] = [];
  const toAudit: any[] = [];
  const rivals: Rival[] = [];
  const asRival = (p: any): Rival => ({ name: p.displayName?.text || "", lat: p.location.latitude, lng: p.location.longitude, rating: p.rating, reviews: p.userRatingCount });
  const now = new Date().toISOString();
  const make = (p: any, presence: WebPresence, extra: Partial<Lead> = {}): Lead => {
    const base = { phone: p.nationalPhoneNumber, rating: p.rating, reviews: p.userRatingCount, presence };
    return {
      id: p.id,
      name: p.displayName?.text || "Sans nom",
      tradeId,
      city: commune.nom,
      address: p.formattedAddress || "",
      phoneIntl: p.internationalPhoneNumber,
      lat: p.location.latitude,
      lng: p.location.longitude,
      mapsUrl: p.googleMapsUri,
      category: p.primaryTypeDisplayName?.text,
      hours: p.regularOpeningHours?.weekdayDescriptions,
      openPeriods: toPeriods(p.regularOpeningHours),
      photoCount: Array.isArray(p.photos) ? p.photos.length : 0,
      score: scoreLead(base),
      foundAt: now,
      ...base,
      ...extra,
    };
  };
  for (const p of seen.values()) {
    if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
    const plng = p.location?.longitude, plat = p.location?.latitude;
    if (plng == null || !inCommune(commune, plng, plat)) continue;
    const c = classify(p.websiteUri);
    if (c.presence === "site") {
      if (includeOld || includeAll) toAudit.push(p);
      else { withSite++; rivals.push(asRival(p)); }
      continue;
    }
    leads.push(make(p, c.presence as WebPresence, { socialUrl: c.social }));
  }

  // Sites existants : on garde ceux qui sont à refaire
  let audited = 0;
  if (toAudit.length) {
    const audits = await auditMany(toAudit.slice(0, 80).map((p) => p.websiteUri));
    for (const p of toAudit) {
      const a = audits.get(p.websiteUri);
      if (!a) {
        withSite++;
        rivals.push(asRival(p));
        if (includeAll) leads.push(make(p, "equipe", { website: p.websiteUri }));
        continue;
      }
      audited++;
      if (a.score >= 30 && (includeOld || includeAll)) {
        const lead = make(p, "vieux", { website: p.websiteUri, audit: a });
        lead.score = Math.min(100, Math.round(lead.score * 0.7 + a.score * 0.3));
        leads.push(lead);
      } else {
        withSite++;
        rivals.push(asRival(p));
        if (includeAll) {
          const lead = make(p, "equipe", { website: p.websiteUri, audit: a });
          lead.score = Math.round(lead.score * 0.8);
          leads.push(lead);
        }
      }
    }
  }
  addContext(leads, rivals, leads.length + withSite, withSite);
  leads.sort((a, b) => b.score - a.score);
  return { city, tradeId, leads, scanned: leads.length + withSite, withSite, audited, calls, demo: false };
}

// Recherche d'une entreprise précise par son nom (1 requête), quel que soit l'état de son site
export async function findByName(name: string, cityQuery: string, tradeId: string): Promise<ScanResult> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  let commune: Commune;
  try { commune = await geocodeCity(cityQuery); } catch (e) {
    if (key) throw e;
    commune = { nom: cityQuery.trim(), codeDepartement: "31", centre: { coordinates: [1.444, 43.6045] } };
  }
  const [lng, lat] = commune.centre.coordinates;
  const city = { name: commune.nom, dept: commune.codeDepartement, lat, lng, zone: `Recherche : « ${name} »` };
  if (!key) {
    const d = demoScan(city, tradeId, true, true);
    const one = { ...d.leads[1], id: `demo-${tradeId}-nom`, name };
    return { ...d, leads: [one], scanned: 1, withSite: 0 };
  }
  const res = await fetch(PLACES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
    body: JSON.stringify({ textQuery: `${name} ${commune.nom}`, languageCode: "fr", regionCode: "FR", pageSize: 5, locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 30000 } } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google Places a refusé la requête (${res.status}). ${(await res.text()).slice(0, 300)}`);
  const places: any[] = ((await res.json()).places || []).filter((p: any) => !p.businessStatus || p.businessStatus === "OPERATIONAL");
  const now = new Date().toISOString();
  const sites = places.map((p) => p.websiteUri).filter((u) => u && classify(u).presence === "site");
  const audits = sites.length ? await auditMany(sites, 20_000) : new Map();
  const leads: Lead[] = places.map((p) => {
    const c = classify(p.websiteUri);
    const a = c.presence === "site" ? audits.get(p.websiteUri) : undefined;
    const presence: WebPresence = c.presence === "site" ? (a && a.score >= 30 ? "vieux" : "equipe") : (c.presence as WebPresence);
    const base = { phone: p.nationalPhoneNumber, rating: p.rating, reviews: p.userRatingCount, presence };
    return {
      id: p.id, name: p.displayName?.text || "Sans nom", tradeId, city: commune.nom, address: p.formattedAddress || "",
      phoneIntl: p.internationalPhoneNumber, lat: p.location.latitude, lng: p.location.longitude, mapsUrl: p.googleMapsUri,
      category: p.primaryTypeDisplayName?.text, hours: p.regularOpeningHours?.weekdayDescriptions, openPeriods: toPeriods(p.regularOpeningHours),
      photoCount: Array.isArray(p.photos) ? p.photos.length : 0, score: scoreLead(base), foundAt: now,
      socialUrl: c.presence === "reseaux" ? c.social : undefined,
      website: c.presence === "site" ? p.websiteUri : undefined, audit: a,
      ...base,
    };
  });
  return { city, tradeId, leads, scanned: leads.length, withSite: 0, audited: audits.size, calls: 1, demo: false };
}

// Téléphone d'une entreprise trouvée dans le registre : une requête Google, à la demande
export async function findPhone(name: string, city: string) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return { phone: "05 61 00 00 00 (démo)", website: undefined, mapsUrl: undefined, label: `${name} (démo)`, demo: true };
  const res = await fetch(PLACES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.displayName,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.formattedAddress" },
    body: JSON.stringify({ textQuery: `${name} ${city}`, languageCode: "fr", regionCode: "FR", pageSize: 1 }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google Places a refusé la requête (${res.status}).`);
  const p = (await res.json()).places?.[0];
  if (!p) return { phone: undefined, label: undefined, demo: false };
  return { phone: p.nationalPhoneNumber as string | undefined, website: p.websiteUri as string | undefined, mapsUrl: p.googleMapsUri as string | undefined, label: `${p.displayName?.text || ""} · ${p.formattedAddress || ""}`, demo: false };
}

// Détails à la demande : avis clients à citer pendant l'approche.
export async function placeDetails(id: string): Promise<Details> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || id.startsWith("demo-")) {
    return {
      hours: ["lundi: Fermé", "mardi–samedi: 07:00–19:30", "dimanche: 07:00–13:00"],
      reviews: [
        { author: "Client A.", rating: 5, text: "Accueil adorable et produits excellents, je recommande.", when: "il y a 2 mois" },
        { author: "Client B.", rating: 4, text: "Très bon rapport qualité-prix, un peu d'attente le samedi.", when: "il y a 5 mois" },
      ],
    };
  }
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=fr`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "regularOpeningHours.weekdayDescriptions,reviews,editorialSummary" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google Places a refusé la requête de détails (${res.status}).`);
  const j = await res.json();
  return {
    hours: j.regularOpeningHours?.weekdayDescriptions,
    summary: j.editorialSummary?.text,
    reviews: (j.reviews || []).slice(0, 5).map((r: any) => ({
      author: r.authorAttribution?.displayName || "Client",
      rating: r.rating,
      text: r.text?.text || r.originalText?.text || "",
      when: r.relativePublishTimeDescription || "",
    })),
  };
}

// ——— Mode démo : données fictives, pour essayer l'outil sans clé API ———
function demoScan(city: ScanResult["city"], tradeId: string, includeOld = false, includeAll = false): ScanResult {
  const trade = getTrade(tradeId)!;
  const names = trade.art ? ["Atelier Carmes", "du Marché", "Loft Saint-Cyprien", "Le Comptoir", "Studio Riquet", "des Carmes", "Bohème", "du Capitole", "Les Halles", "Vintage Arnaud", "du Canal", "Bonnet"] : ["du Marché", "Saint-Cyprien", "des Carmes", "Martin", "du Capitole", "Lafargue", "de la Gare", "Ferrand", "des Minimes", "Rouzaud", "du Canal", "Bonnet"];
  const streets = ["rue des Lois", "allée Jean Jaurès", "rue de Metz", "place Dupuy", "avenue de Muret", "rue Riquet", "boulevard de Strasbourg", "rue Pargaminières"];
  let seed = tradeId.length * 97 + city.name.length * 13;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const leads: Lead[] = names.map((n, i) => {
    const r = rnd();
    const presence: WebPresence = includeOld && i % 4 === 1 ? "vieux" : includeAll && i % 4 === 3 ? "equipe" : r > 0.7 ? "reseaux" : "aucun";
    const reviews = Math.round(rnd() * 220);
    const rating = Math.round((3.6 + rnd() * 1.4) * 10) / 10;
    const phone = rnd() > 0.1 ? `05 61 ${String(10 + i * 7).padStart(2, "0")} ${String(Math.round(rnd() * 89) + 10)} ${String(Math.round(rnd() * 89) + 10)}` : undefined;
    const base = { rating, reviews, phone, presence };
    const label = trade.singular.charAt(0).toUpperCase() + trade.singular.slice(1);
    return {
      id: `demo-${tradeId}-${i}`,
      name: `${label} ${n}`,
      tradeId,
      city: city.name,
      address: `${Math.round(rnd() * 60) + 1} ${streets[i % streets.length]}, ${city.name}`,
      lat: city.lat + (rnd() - 0.5) * 0.05,
      lng: city.lng + (rnd() - 0.5) * 0.07,
      mapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(trade.singular + " " + city.name)}`,
      socialUrl: presence === "reseaux" ? (trade.art ? "https://www.instagram.com/" : "https://www.facebook.com/") : undefined,
      website: presence === "vieux" || presence === "equipe" ? "http://exemple-demo.fr" : undefined,
      photoCount: i % 3 === 0 ? 2 : 10,
      created: `${[1998, 2009, 2016, 2025, 2012, 2020][i % 6]}-0${(i % 9) + 1}-15`,
      legalName: `${label.toUpperCase()} ${n.toUpperCase()} (démo)`,
      registry: "ok",
      audit: presence === "vieux"
        ? { score: 65, issues: ["Pas adapté aux téléphones", "Pas de connexion sécurisée (HTTPS)", "Pas mis à jour depuis 2017"], https: false, mobile: false, url: "http://exemple-demo.fr", email: "contact@exemple-demo.fr", lastYear: 2017, cms: i % 8 === 1 ? "WordPress" : "Wix", cmsVersion: i % 8 === 1 ? "5.2" : undefined }
        : presence === "equipe"
        ? { score: 10, issues: [], https: true, mobile: true, url: "https://exemple-demo.fr", cms: "WordPress", cmsVersion: "6.7" }
        : undefined,
      hours: ["lundi: Fermé", "mardi: 07:00–19:30", "mercredi: 07:00–19:30", "jeudi: 07:00–19:30", "vendredi: 07:00–19:30", "samedi: 07:00–19:30", "dimanche: 07:00–13:00"],
      openPeriods: [2, 3, 4, 5, 6].map((day) => ({ day, open: 420, close: 1170 })).concat([{ day: 0, open: 420, close: 780 }]),
      score: scoreLead(base),
      foundAt: new Date().toISOString(),
      ...base,
    };
  });
  const rivals: Rival[] = [0, 1, 2].map((k) => ({
    name: `${trade.singular.charAt(0).toUpperCase() + trade.singular.slice(1)} concurrente ${k + 1} (démo)`,
    lat: city.lat + (rnd() - 0.5) * 0.04,
    lng: city.lng + (rnd() - 0.5) * 0.05,
    rating: 4.4,
    reviews: 180,
  }));
  addContext(leads, rivals, leads.length + 9, 9);
  leads.sort((a, b) => b.score - a.score);
  return { city, tradeId, leads, scanned: leads.length + 9, withSite: 9, audited: includeOld ? 12 : 0, calls: 0, demo: true };
}
