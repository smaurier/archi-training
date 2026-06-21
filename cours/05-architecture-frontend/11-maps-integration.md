# Cours — Intégration de cartes interactives

> **Prérequis** : composants React/Vue (tu dois savoir gérer un cycle de vie de composant et des refs DOM avant d'initialiser une carte).

## Objectifs

- Comprendre les différences entre les bibliothèques de cartographie web
- Intégrer Leaflet dans React et Vue sans fuite mémoire
- Afficher des marqueurs, clusters, popups et couches personnalisées
- Gérer les tuiles (tile layers) et les providers (OpenStreetMap, Mapbox)
- Implémenter des interactions (click, hover, draw)
- Optimiser les performances sur de grandes collections de points

---

## Panorama des bibliothèques

| Lib | Poids | Tuiles | Points forts | Contexte |
|-----|-------|--------|-------------|---------|
| **Leaflet** | ~40kb | Libres + Mapbox | Simple, mature, extensible | Usage général, OSS |
| **MapLibre GL** | ~250kb | Vector tiles | WebGL, rotation 3D, performant | Haute perf, Mapbox-compatible |
| **Mapbox GL JS** | ~250kb | Propriétaires | Qualité visuelle, API riche | Budget disponible |
| **OpenLayers** | ~400kb | Toutes | GIS avancé, projections | Contexte industriel/ferroviaire |
| **react-leaflet** | wrapper | via Leaflet | API React déclarative | React + Leaflet |

> **Pour Alstom** : OpenLayers est fréquent dans les contextes ferroviaires et industriels (support de projections cartographiques spécifiques, données GIS). Leaflet reste la base à maîtriser.

---

## Leaflet dans React — intégration correcte

### Le piège du double-rendu React

Leaflet initialise sur un élément DOM réel. React peut rendre le composant deux fois (StrictMode) ou démonter/remonter le composant. Sans nettoyage, tu obtiens `Map container is already initialized`.

```typescript
// src/components/Map.tsx
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  center: [number, number];
  zoom: number;
}

export function Map({ center, zoom }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
      center,
      zoom,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapRef.current);

    // Cleanup — critique pour éviter "already initialized"
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // tableau vide : init une seule fois

  // Mettre à jour center/zoom si les props changent
  useEffect(() => {
    mapRef.current?.setView(center, zoom);
  }, [center, zoom]);

  return <div ref={containerRef} style={{ height: '400px', width: '100%' }} />;
}
```

### Marqueurs et popups

```typescript
// Ajouter des marqueurs depuis des données
interface Station {
  id: string;
  name: string;
  coordinates: [number, number];
  status: 'active' | 'maintenance' | 'closed';
}

function addStationMarkers(map: L.Map, stations: Station[]): L.Marker[] {
  return stations.map((station) => {
    const icon = L.divIcon({
      className: '',
      html: `<div class="station-marker station-marker--${station.status}"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    return L.marker(station.coordinates, { icon })
      .bindPopup(`
        <strong>${station.name}</strong><br>
        Statut : ${station.status}
      `)
      .addTo(map);
  });
}
```

### Nettoyage des marqueurs (éviter les fuites mémoire)

```typescript
// Dans le composant — les marqueurs doivent être trackés et supprimés
const markersRef = useRef<L.Marker[]>([]);

useEffect(() => {
  if (!mapRef.current) return;

  // Supprimer les anciens marqueurs avant d'en ajouter de nouveaux
  markersRef.current.forEach((m) => m.remove());
  markersRef.current = addStationMarkers(mapRef.current, stations);
}, [stations]);
```

---

## Clustering de points

Sans clustering, 10 000 marqueurs sur une carte = freeze du navigateur.

```typescript
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';

function addClusteredMarkers(map: L.Map, points: Station[]): L.MarkerClusterGroup {
  const cluster = L.markerClusterGroup({
    maxClusterRadius: 60,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
  });

  points.forEach((station) => {
    L.marker(station.coordinates)
      .bindPopup(station.name)
      .addTo(cluster);
  });

  map.addLayer(cluster);
  return cluster;
}
```

---

## GeoJSON — afficher des zones ou tracés

Contexte ferroviaire : lignes de train, zones de couverture, périmètres.

```typescript
// Afficher une ligne de train
const railwayLine: GeoJSON.Feature = {
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: [
      [4.832, 45.748],  // Lyon Part-Dieu
      [4.863, 45.760],  // Lyon-Villeurbanne
      [4.901, 45.771],  // Meyzieu
    ],
  },
  properties: { name: 'Ligne T3', type: 'tram' },
};

L.geoJSON(railwayLine, {
  style: {
    color: '#e63946',
    weight: 4,
    opacity: 0.8,
  },
  onEachFeature: (feature, layer) => {
    layer.bindPopup(feature.properties?.name ?? '');
  },
}).addTo(map);
```

---

## Leaflet dans Vue 3

```typescript
// src/composables/useLeafletMap.ts
import { onMounted, onUnmounted, ref, type Ref } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export function useLeafletMap(
  containerRef: Ref<HTMLElement | null>,
  options: L.MapOptions,
) {
  const map = ref<L.Map | null>(null);

  onMounted(() => {
    if (!containerRef.value) return;
    map.value = L.map(containerRef.value, options);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map.value);
  });

  onUnmounted(() => {
    map.value?.remove();
    map.value = null;
  });

  return { map };
}
```

```vue
<!-- src/components/MapView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useLeafletMap } from '../composables/useLeafletMap';

const container = ref<HTMLElement | null>(null);
const { map } = useLeafletMap(container, { center: [45.75, 4.85], zoom: 12 });
</script>

<template>
  <div ref="container" style="height: 400px; width: 100%;" />
</template>
```

---

## react-leaflet — approche déclarative

```typescript
// Plus simple, mais moins de contrôle sur le cycle de vie
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

function StationsMap({ stations }: { stations: Station[] }) {
  return (
    <MapContainer center={[45.75, 4.85]} zoom={12} style={{ height: 400 }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap"
      />
      {stations.map((station) => (
        <Marker key={station.id} position={station.coordinates}>
          <Popup>{station.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

---

## Performance — grands volumes de données

```typescript
// Virtualisation : n'afficher que les points dans le viewport
function getVisiblePoints(map: L.Map, points: Station[]): Station[] {
  const bounds = map.getBounds();
  return points.filter(({ coordinates: [lat, lng] }) =>
    bounds.contains([lat, lng])
  );
}

// Mettre à jour les marqueurs à chaque déplacement de la carte
map.on('moveend', () => {
  const visible = getVisiblePoints(map, allStations);
  refreshMarkers(map, visible);
});

// Canvas renderer pour > 1000 points (vs SVG par défaut)
const renderer = L.canvas({ padding: 0.5 });
L.circleMarker([lat, lng], { renderer }).addTo(map);
```

---

## Checklist

- [ ] Leaflet initialisé proprement avec cleanup (pas de `already initialized`)
- [ ] Les marqueurs sont supprimés avant d'être recréés (pas de fuite mémoire)
- [ ] Clustering activé dès que > 100 points
- [ ] GeoJSON pour les tracés/zones (pas des polylignes manuelles)
- [ ] Canvas renderer utilisé sur grands volumes
- [ ] Je connais la différence Leaflet / MapLibre / OpenLayers selon le contexte
- [ ] Pour Alstom : je sais que OpenLayers est probable (GIS industriel)
