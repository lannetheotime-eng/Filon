"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LMap, LayerGroup } from "leaflet";
import type { Lead } from "../lib/types";

export default function MapView({
  leads,
  center,
  activeId,
  onSelect,
}: {
  leads: Lead[];
  center: [number, number];
  activeId?: string;
  onSelect: (id: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const lastKey = useRef("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      if (cancelled || !el.current || map.current) return;
      L.current = mod;
      map.current = mod.map(el.current, { zoomControl: true, scrollWheelZoom: false }).setView(center, 13);
      mod
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        })
        .addTo(map.current);
      layer.current = mod.layerGroup().addTo(map.current);
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      lastKey.current = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const m = map.current, lg = layer.current, Lf = L.current;
    if (!m || !lg || !Lf) return;
    lg.clearLayers();
    const css = getComputedStyle(document.documentElement);
    const colors = {
      aucun: css.getPropertyValue("--mark").trim() || "#154dff",
      reseaux: css.getPropertyValue("--social").trim() || "#b26a00",
      vieux: css.getPropertyValue("--old").trim() || "#7a3df0",
      equipe: css.getPropertyValue("--ink-3").trim() || "#8a8a8a",
    } as Record<string, string>;
    const pts: [number, number][] = [];
    for (const l of leads) {
      const active = l.id === activeId;
      const c = Lf.circleMarker([l.lat, l.lng], {
        radius: active ? 11 : 7,
        color: colors[l.presence] || colors.aucun,
        weight: active ? 4 : 2,
        fillColor: colors[l.presence] || colors.aucun,
        fillOpacity: active ? 1 : 0.8,
      });
      c.bindTooltip(l.name, { direction: "top", offset: [0, -6] });
      c.on("click", () => onSelect(l.id));
      c.addTo(lg);
      pts.push([l.lat, l.lng]);
    }
    const key = leads.map((l) => l.id).join(",");
    if (key !== lastKey.current) {
      lastKey.current = key;
      if (pts.length) m.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
      else m.setView(center, 13);
    } else if (activeId) {
      const a = leads.find((l) => l.id === activeId);
      if (a) m.panTo([a.lat, a.lng]);
    }
  }

  useEffect(draw, [leads, activeId, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="map" role="region" aria-label="Carte des entreprises trouvées" />;
}
