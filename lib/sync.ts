import type { Lead, PipelineEntry, Profile } from "./types";

export type Recent = { city: string; tradeId: string; at: string };

export type SyncData = {
  pipeline: Record<string, PipelineEntry>;
  leads: Record<string, Lead>; // uniquement les entreprises suivies
  profile?: Profile;
  profileAt?: string;
  recent?: Recent[];
};

// Fusion locale + serveur : pour chaque entreprise suivie, la version modifiée le plus récemment gagne
export function mergeData(local: SyncData, remote: SyncData | null): SyncData {
  if (!remote) return local;
  const pipeline: Record<string, PipelineEntry> = { ...remote.pipeline };
  for (const [id, e] of Object.entries(local.pipeline)) {
    const r = pipeline[id];
    if (!r || (e.updatedAt || "") > (r.updatedAt || "")) pipeline[id] = e;
  }
  const leads = { ...remote.leads, ...local.leads };
  const useLocalProfile = !remote.profile || ((local.profileAt || "") > (remote.profileAt || "") && !!local.profile?.firstName);
  const seen = new Set<string>();
  const recent = [...(local.recent || []), ...(remote.recent || [])]
    .sort((a, b) => b.at.localeCompare(a.at))
    .filter((r) => (seen.has(r.city + r.tradeId) ? false : (seen.add(r.city + r.tradeId), true)))
    .slice(0, 6);
  return {
    pipeline,
    leads,
    profile: useLocalProfile ? local.profile : remote.profile,
    profileAt: useLocalProfile ? local.profileAt : remote.profileAt,
    recent,
  };
}

// Ce qu'on envoie au serveur : le pipeline et seulement les entreprises qui y figurent
export function toSync(pipeline: Record<string, PipelineEntry>, leads: Record<string, Lead>, profile: Profile, profileAt: string, recent: Recent[]): SyncData {
  const kept: Record<string, Lead> = {};
  for (const id of Object.keys(pipeline)) if (leads[id]) kept[id] = leads[id];
  return { pipeline, leads: kept, profile, profileAt, recent };
}
