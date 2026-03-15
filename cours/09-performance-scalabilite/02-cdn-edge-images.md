# Cours 63 — CDN, Edge Computing & Image Pipeline

> **Objectif** : Comprendre l'architecture CDN edge-first (cache-first SSR, sub-600ms TTFB), implémenter une image pipeline (WebP/AVIF, srcset, focal-point cropping), et maîtriser la purge selective via surrogate keys.

---

## Rappel du cours précédent

<details>
<summary>1. Quels sont les 3 niveaux de cache et leur latence approximative ?</summary>

1. **CDN / edge** (~0ms depuis le cache edge le plus proche), 2. **Redis** (~1-5ms, cache partage server-side), 3. **DB PostgreSQL** (~10-50ms, source de vérité). Plus on est proche du client, plus c'est rapide mais plus la capacité est limitee.
</details>

<details>
<summary>2. Comment fonctionne la surrogate-key invalidation ?</summary>

Chaque réponse cachee porte un header `Surrogate-Key` avec des tags (ex: `product:abc category:shoes`). Quand un produit change, on envoie un `PURGE` au CDN avec le tag `product:abc`. Le CDN invalide **toutes** les pages contenant ce tag, sans connaître les URLs exactes. C'est plus précis et plus maintenable que purger par URL.
</details>

---

## Analogie — Le réseau de boulangeries

Une chaine de boulangeries avec une usine centrale :
- **L'usine** (serveur origin) cuit les pains à la demandé — qualité parfaite mais lent (il faut commander, attendre la cuisson, livrer)
- **Les depots regionaux** (CDN edge nodes) stockent des pains precuits — rapide car proche, mais en quantité limitee
- **La vitrine** (cache navigateur) affiche les pains du jour — instantane mais petit

Si un pain est en rupture au depot regional, il commande a l'usine. S'il est encore frais en vitrine, pas besoin de demander au depot.

---

## Théorie

### 1. Architecture CDN edge-first

```
Utilisateur (Paris)         Utilisateur (Tokyo)
       │                            │
       ▼                            ▼
┌─────────────┐            ┌─────────────┐
│  Edge Node  │            │  Edge Node  │
│  (Paris)    │            │  (Tokyo)    │
│  Cache HIT  │            │  Cache MISS │
│  → 15ms     │            │  → fetch    │
└─────────────┘            └──────┬──────┘
                                   │
                                   ▼
                           ┌─────────────┐
                           │   Origin     │
                           │   (EU)       │
                           │   ~200ms     │
                           └─────────────┘
```

### 2. Cache-Control stratégies pour CDN

| Directive | Signification | Usage |
|---|---|---|
| `s-maxage=86400` | TTL pour shared caches (CDN) seulement | Pages publiques |
| `max-age=3600` | TTL pour le navigateur | Pages semi-dynamiques |
| `stale-while-revalidate=60` | Servir le stale pendant revalidation | UX fluide |
| `stale-if-error=300` | Servir le stale si l'origin est down | Résilience |
| `Surrogate-Control` | Directives spécifiques CDN (Fastly, Varnish) | Purge selective |

### 3. Image pipeline architecture

```
Upload                     Processing                      Delivery
──────                     ──────────                      ────────
                    ┌──────────────────┐
User uploads  ────>│  Original stocke  │
  (5MB JPEG)       │  sur S3           │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  Image Processor  │  (imgproxy / Thumbor / Sharp)
                    │                   │
                    │  ?w=800&h=600     │──> WebP 800x600 (45KB)
                    │  &fit=cover       │──> AVIF 800x600 (32KB)
                    │  &format=auto     │──> JPEG fallback (85KB)
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  CDN Cache        │  TTL: 1 an (immutable hash)
                    │  Edge delivery    │  → <50ms worldwide
                    └──────────────────┘
```

### 4. Responsive images avec srcset

```html
<picture>
  <!-- AVIF (meilleure compression, support moderne) -->
  <source
    type="image/avif"
    srcset="
      /img/product-abc.avif?w=400 400w,
      /img/product-abc.avif?w=800 800w,
      /img/product-abc.avif?w=1200 1200w
    "
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  />
  <!-- WebP (bon support) -->
  <source
    type="image/webp"
    srcset="
      /img/product-abc.webp?w=400 400w,
      /img/product-abc.webp?w=800 800w,
      /img/product-abc.webp?w=1200 1200w
    "
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  />
  <!-- Fallback JPEG -->
  <img
    src="/img/product-abc.jpg?w=800"
    alt="T-shirt bio bleu"
    loading="lazy"
    decoding="async"
    width="800"
    height="600"
  />
</picture>
```

### 5. Focal-point cropping

```
Probleme : un portrait cadre sur le visage → crop automatique coupe la tete

Solution : stocker les coordonnees du point focal dans les metadonnees

{
  "focalPoint": { "x": 0.5, "y": 0.3 }  // Centre-haut (visage)
}

CSS :
  object-fit: cover;
  object-position: 50% 30%;  // Focal point
```

### 6. SHA-256 deduplication

```
Upload de la meme image par 2 tenants :
  1. Calculer SHA-256 du fichier
  2. Verifier si ce hash existe deja dans le storage
  3. Si oui → creer un lien (pas un doublon)
  4. Si non → stocker + enregistrer le hash

Resultat : 1 seul fichier physique, N references
Economie typique : 30-40% de stockage
```

---

## Pratique

### Image service avec transformation on-the-fly

```typescript
@Injectable()
export class ImageService {
  constructor(
    private readonly s3: S3Client,
    private readonly cache: CacheService,
  ) {}

  getOptimizedUrl(
    originalKey: string,
    options: ImageOptions,
  ): string {
    const params = new URLSearchParams();
    if (options.width) params.set('w', String(options.width));
    if (options.height) params.set('h', String(options.height));
    params.set('fit', options.fit ?? 'cover');
    params.set('format', 'auto'); // WebP/AVIF selon Accept header

    // URL vers le proxy d'images (imgproxy)
    const path = encodeURIComponent(originalKey);
    return `${process.env.IMAGE_PROXY_URL}/${path}?${params}`;
  }

  generateSrcSet(originalKey: string, widths: number[] = [400, 800, 1200]): string {
    return widths
      .map((w) => {
        const url = this.getOptimizedUrl(originalKey, { width: w });
        return `${url} ${w}w`;
      })
      .join(', ');
  }
}

interface ImageOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill';
  focalPoint?: { x: number; y: number };
}
```

### CDN purge service

```typescript
@Injectable()
export class CdnPurgeService {
  constructor(private readonly httpClient: HttpService) {}

  async purgeByTag(tag: string): Promise<void> {
    // Exemple avec Fastly — chaque CDN a sa propre API
    await this.httpClient.axiosRef.post(
      `https://api.fastly.com/service/${process.env.FASTLY_SERVICE_ID}/purge/${tag}`,
      null,
      {
        headers: {
          'Fastly-Key': process.env.FASTLY_API_KEY,
          'Fastly-Soft-Purge': '1', // Soft purge : sert le stale pendant revalidation
        },
      },
    );
  }

  async purgeOnPublish(entity: string, entityId: string): Promise<void> {
    // Purger toutes les variantes de cette entite
    await this.purgeByTag(`${entity}:${entityId}`);
  }
}

// Usage dans un event listener
@EventHandler('content.published')
async handleContentPublished(event: ContentPublishedEvent): Promise<void> {
  await this.cdnPurge.purgeOnPublish('page', event.pageId);
  await this.cdnPurge.purgeOnPublish('site', event.siteId);
}
```

### Preconnect hints

```typescript
// Injecter les hints dans le <head> pour accelerer le chargement
function getPreconnectLinks(): string[] {
  return [
    `<link rel="preconnect" href="${process.env.CDN_URL}" crossorigin>`,
    `<link rel="preconnect" href="${process.env.IMAGE_PROXY_URL}" crossorigin>`,
    `<link rel="dns-prefetch" href="${process.env.API_URL}">`,
  ];
}
```

---

## Résumé

1. **CDN edge-first** : cache les réponses au plus proche de l'utilisateur — sub-600ms TTFB EU, objectif <50ms edge hit
2. **Surrogate keys + soft purge** : invalider par tag, servir le stale pendant revalidation — précision sans connaître les URLs
3. **Image pipeline** : upload original → transformation on-the-fly (WebP/AVIF, srcset responsive, focal-point) → CDN cache immutable
4. **SHA-256 deduplication** : un seul fichier physique pour N références — 30-40% d'economie storage
5. **`<link rel="preconnect">`** : negocier la connexion TCP+TLS en avance — 100-200ms gagnes sur le premier asset

---

> **Prochain cours** : [Cours 64 — Load Balancing](./03-load-balancing.md)

---

> **Lien fil rouge — ShopArch**
>
> - Configure le pipeline d'images ShopArch : upload → resize → CDN (WebP/AVIF)
> - Implémente le composant `ProductImage` avec srcset responsive et blurhash LQIP
> - Exercice(s) associé(s) : `exercices/43-cdn-image-pipeline/`
> - Checkpoint : Module 09, critère 2
