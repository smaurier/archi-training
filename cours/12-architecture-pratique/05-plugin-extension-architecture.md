# Cours 81 — Plugin & Extension Architecture

> **Objectif** : Concevoir un système de plugins extensible (manifest YAML, route mount blocks, block variant system), implémenter un challenge-based health check, et maîtriser l'adapter boundary pattern pour les editeurs tiers.

---

## Rappel du cours précédent

<details>
<summary>1. Pourquoi le Big Bang rewrite échoué presque toujours ?</summary>

Les specs sont incompletes (les edge cases sont decouverts trop tard), le risque est concentre en un seul moment (si ça échoué, tout échoué), et les équipes sous-estiment systematiquement la complexité. Le Strangler Fig migre feature par feature — chaque feature est testee et validee avant de passer à la suivante.
</details>

<details>
<summary>2. Qu'est-ce que le redirect chain collapsing ?</summary>

Quand un redirect pointe vers un autre redirect (/a→/b→/c→/d = 3 hops), on met a jour pour pointer directement vers la destination finale (/a→/d = 1 hop). Important pour le SEO (Google penalise les chaines longues) et la performance (chaque hop ajoute une requête).
</details>

---

## Analogie — L'App Store d'un smartphone

Un smartphone sans apps est un telephone basique. L'architecture de plugins est comme l'App Store :
- **Manifest** : la fiche de l'app (nom, permissions requises, endpoints utilises)
- **Sandbox** : l'app tourne dans son propre espace (pas d'accès aux autres apps)
- **API** : l'app utilise les APIs du système (GPS, camera, notifications)
- **Health check** : si l'app plante 3 fois, le système la désactivé
- **Marketplace** : les utilisateurs choisissent quelles apps installer

---

## Théorie

### 1. Plugin manifest schema

```yaml
# plugin-manifest.yaml
name: product-recommendations
version: 1.2.0
description: "AI-powered product recommendations"
author: "PluginCorp"

# Permissions declarees (principe du moindre privilege)
permissions:
  rbacScopes:
    - product:read
    - analytics:read
  endpoints:
    - GET /api/products
    - GET /api/analytics/views
  events:
    emits:
      - recommendation.generated
    listens:
      - product.viewed
      - cart.updated
  egress:
    hosts:
      - api.openai.com
      - cdn.plugincorp.com

# UI Extensions
routes:
  - path: /admin/recommendations
    component: RecommendationsPage
    menu:
      label: "Recommendations"
      icon: "sparkles"
      group: "marketing"

widgets:
  - id: top-recommendations
    target: dashboard
    component: TopRecommendationsWidget

blocks:
  - type: recommendation-carousel
    label: "Product Recommendations"
    component: RecommendationBlock
```

### 2. Route mount blocks

```
CMS Page (editable par l'admin) :
┌──────────────────────────────────────┐
│  Header (core)                        │
│──────────────────────────────────────│
│  Hero Block (core)                    │
│──────────────────────────────────────│
│  [Plugin Mount: recommendation-carousel]│  ← Plugin injecte ici
│──────────────────────────────────────│
│  Content Blocks (core)                │
│──────────────────────────────────────│
│  Footer (core)                        │
└──────────────────────────────────────┘

Le plugin s'insere dans la page via un block type
enregistre dans le manifest → le CMS le rend comme un block natif.
```

### 3. Block variant system

```typescript
// Le CMS a des block types (text, image, hero...)
// Chaque template peut avoir des variantes de rendu

// Resolution : blockType + template + structure → component
function variantResolver(
  blockType: string,
  template: string,
  structure: string,
): ComponentType {
  // 1. Chercher une variante specifique au template
  const specific = registry.get(`${blockType}:${template}:${structure}`);
  if (specific) return specific;

  // 2. Fallback sur la variante par defaut du template
  const templateDefault = registry.get(`${blockType}:${template}`);
  if (templateDefault) return templateDefault;

  // 3. Fallback sur le composant par defaut
  return registry.get(blockType) ?? DefaultBlock;
}
```

### 4. Challenge-based health check

```
Installation du plugin :
  1. Plugin s'enregistre avec un secret (HMAC key)
  2. Serveur stocke le secret (chiffre en DB)

A chaque init :
  1. Serveur envoie un challenge (nonce aleatoire)
  2. Plugin signe : HMAC-SHA256(secret, challenge)
  3. Serveur verifie la signature
  4. Si OK → plugin trusted → fonctionnalites activees
  5. Si 3 echecs consecutifs → plugin auto-desactive → admin notifie
```

### 5. Adapter boundary pattern

```
Probleme : on utilise un editeur tiers (ex: Unlayer) qui peut etre
remplace demain. Si le code est couple a Unlayer partout → migration
couteuse.

Solution : Adapter Boundary

┌──────────────────────────────────────┐
│  Application                          │
│                                      │
│  ┌──────────────┐  ┌──────────────┐ │
│  │  EditorPort  │  │ UnlayerAdapter│ │
│  │  (interface) │←─│ (implements) │ │
│  └──────────────┘  └──────────────┘ │
│                                      │
│  Demain :                            │
│  ┌──────────────┐  ┌──────────────┐ │
│  │  EditorPort  │  │ GrapesAdapter │ │
│  │  (interface) │←─│ (implements) │ │
│  └──────────────┘  └──────────────┘ │
└──────────────────────────────────────┘

L'application ne connait que EditorPort.
Le remplacement d'Unlayer par GrapeJS = changer 1 adapter.
```

### 6. Search abstraction layer

```typescript
// Meme principe pour le moteur de recherche
interface SearchProvider {
  search(query: SearchQuery): Promise<SearchResult>;
  index(document: IndexableDocument): Promise<void>;
  delete(documentId: string): Promise<void>;
}

// Implementations interchangeables
class ElasticsearchProvider implements SearchProvider { ... }
class MeilisearchProvider implements SearchProvider { ... }
class PostgresFTSProvider implements SearchProvider { ... }
```

---

## Pratique

### Plugin registry

```typescript
@Injectable()
export class PluginRegistry {
  private plugins = new Map<string, PluginManifest>();

  async register(manifest: PluginManifest): Promise<void> {
    // Valider le manifest contre le schema
    this.validateManifest(manifest);

    // Verifier les permissions (pas d'escalade)
    this.validatePermissions(manifest);

    this.plugins.set(manifest.name, manifest);
  }

  getBlockComponent(blockType: string): ComponentType | null {
    for (const [, manifest] of this.plugins) {
      const block = manifest.blocks?.find((b) => b.type === blockType);
      if (block) return block.component;
    }
    return null;
  }

  getWidgets(target: string): WidgetConfig[] {
    const widgets: WidgetConfig[] = [];
    for (const [, manifest] of this.plugins) {
      const matching = manifest.widgets?.filter((w) => w.target === target) ?? [];
      widgets.push(...matching);
    }
    return widgets;
  }

  private validatePermissions(manifest: PluginManifest): void {
    const allowedScopes = ['product:read', 'analytics:read', 'content:read'];
    for (const scope of manifest.permissions.rbacScopes) {
      if (!allowedScopes.includes(scope)) {
        throw new Error(`Plugin ${manifest.name}: unauthorized scope ${scope}`);
      }
    }
  }
}
```

### Plugin HMAC health check

```typescript
@Injectable()
export class PluginHealthCheck {
  constructor(private readonly db: DataSource) {}

  async verifyPlugin(pluginName: string): Promise<boolean> {
    const plugin = await this.db.findOne(Plugin, {
      where: { name: pluginName },
    });
    if (!plugin || !plugin.enabled) return false;

    // Generer un challenge
    const challenge = crypto.randomBytes(32).toString('hex');

    // Envoyer le challenge au plugin
    try {
      const response = await fetch(`${plugin.healthUrl}/challenge`, {
        method: 'POST',
        body: JSON.stringify({ challenge }),
        headers: { 'Content-Type': 'application/json' },
      });

      const { signature } = await response.json();

      // Verifier la signature
      const expected = crypto
        .createHmac('sha256', plugin.secret)
        .update(challenge)
        .digest('hex');

      if (crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expected, 'hex'),
      )) {
        await this.resetFailureCount(pluginName);
        return true;
      }
    } catch {
      // Echec
    }

    // Incrementer le compteur d'echecs
    const failures = await this.incrementFailures(pluginName);
    if (failures >= 3) {
      await this.disablePlugin(pluginName);
    }

    return false;
  }
}
```

---

## Résumé

1. **Plugin manifest** (YAML) : déclaré les permissions, endpoints, events, egress hosts, routes, widgets, blocks — principe du moindre privilege
2. **Route mount blocks** : le plugin s'inséré dans les pages CMS via des block types enregistres dans le manifest
3. **Block variant system** : `variantResolver(blockType, template, structure) → component` — résolution avec fallback
4. **Challenge HMAC** : le serveur envoie un nonce, le plugin signe avec son secret — 3 echecs = auto-disable
5. **Adapter boundary** : interfacer les editeurs/services tiers (Unlayer, Elasticsearch) derriere un port — remplacement = 1 adapter

---

> **Prochain cours** : [Cours 82 — Conway's Law, Team Topologies & Communication](./06-conway-team-topologies.md)

---

> **Lien fil rouge — ShopArch**
>
> - Implémente un système de plugins pour ShopArch : "produits recommandés" comme plugin
> - Définis le manifest du plugin (permissions, hooks, assets)
> - Exercice(s) associé(s) : `exercices/54-fitness-functions/`
> - Checkpoint : Module 12, critère 3
