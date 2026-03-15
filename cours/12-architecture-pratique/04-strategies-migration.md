# Cours 80 — Stratégies de migration

> **Objectif** : Maîtriser les stratégies de migration de systèmes (Strangler Fig applique, pre-flight diff report, AI HTML-to-block conversion, redirect seeding), et planifier des migrations zero-downtime.

---

## Rappel du cours précédent

<details>
<summary>1. Quels sont les 4 types de dette technique selon le quadrant de Fowler ?</summary>

Deux axes : deliberee/accidentelle × prudente/imprudente. **Deliberee+prudente** : raccourci conscient, planifie pour remboursement. **Deliberee+imprudente** : "on n'a pas le temps". **Accidentelle+prudente** : on découvre une meilleure solution après coup. **Accidentelle+imprudente** : manque de connaissances.
</details>

<details>
<summary>2. Qu'est-ce que la matrice impact/effort pour prioriser la dette ?</summary>

4 quadrants : **Quick Wins** (impact élevé, effort faible → faire tout de suite), **Strategic** (impact élevé, effort élevé → planifier), **Fill** (impact faible, effort faible → ignorer), **Money Pit** (impact faible, effort élevé → éviter absolument).
</details>

---

## Analogie — Demenager sans fermer le magasin

Tu demenages ton magasin de l'autre côté de la rue. Tu ne peux pas fermer 3 mois — les clients doivent pouvoir acheter pendant le demenagement :
1. Tu construis le nouveau magasin a côté (nouvel environnement)
2. Tu demenages rayon par rayon (migration incrementale)
3. Tu mets des panneaux de redirection (URL redirects)
4. Tu gardes les deux magasins ouverts pendant la transition
5. Quand tout est deplace, tu fermes l'ancien

---

## Théorie

### 1. Les 3 stratégies de migration

| Stratégie | Description | Risque | Quand |
|---|---|---|---|
| **Big Bang** | Tout migrer d'un coup | Très élevé | Presque jamais |
| **Strangler Fig** | Feature par feature derriere un proxy | Faible | La plupart du temps |
| **Parallel Run** | Les deux systèmes tournent en parallele | Moyen | Données critiques |

### 2. Pre-flight diff report

```
AVANT de migrer, generer un rapport :

Pre-flight Report — Migration CMS v1 → v2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Contenu total :
  Pages : 1,247
  Articles : 342
  Media : 5,891 fichiers

Migration automatique :
  Pages migrables : 1,180 (94.6%)
  Articles migrables : 328 (95.9%)
  Media migrables : 5,891 (100%)

Review manuelle :
  Pages avec custom HTML : 67 (5.4%)
  Articles avec embeds non standards : 14 (4.1%)

URLs a rediriger : 842
Broken links detectes : 23
Estimation temps : 2-3 jours (auto) + 2 jours (review manuelle)
```

### 3. AI HTML-to-block conversion

```
Input (legacy HTML) :
  <div class="article">
    <h2>Mon titre</h2>
    <p>Un paragraphe avec <strong>du gras</strong>.</p>
    <img src="/old/image.jpg" alt="Photo">
  </div>

AI Conversion (~95% quality) :
  [
    { type: "heading", level: 2, text: "Mon titre" },
    { type: "paragraph", content: "Un paragraphe avec **du gras**." },
    { type: "image", src: "/media/image.jpg", alt: "Photo" }
  ]

Les 5% restants → review manuelle (custom HTML complexe)
```

### 4. Redirect stratégies

```
301 (Permanent) :
  /old-products/123 → /products/t-shirt-bio
  → SEO : transfere le "link juice"
  → Navigateur cache le redirect indefiniment

302 (Temporary) :
  /products/123 → /new-system/products/123
  → SEO : ne transfere pas le link juice
  → Utiliser pendant la migration (pas sure de la destination finale)

308 (Permanent, preserve method) :
  POST /old-api/orders → POST /api/v2/orders
  → Comme 301 mais preserve la methode HTTP (important pour les API)

Redirect chain collapsing :
  /a → /b → /c → /d   (3 hops — MAUVAIS pour le SEO)
  /a → /d              (1 hop — BON)
```

### 5. Data migration patterns

| Pattern | Description | Complexite |
|---|---|---|
| **ETL** | Extract-Transform-Load batch | Faible |
| **CDC** (Change Data Capture) | Stream les changements en temps réel | Moyenne |
| **Dual-write** | Écrire dans les deux systèmes | Elevee (cohérence) |
| **Backfill + CDC** | Copier l'existant puis streamer les deltas | Moyenne |

---

## Pratique

### Pre-flight analysis script

```typescript
// scripts/pre-flight-analysis.ts
interface PreflightReport {
  totalPages: number;
  autoMigratable: number;
  manualReview: number;
  redirects: RedirectRule[];
  brokenLinks: string[];
}

async function analyzePreFlight(legacyDb: DataSource): Promise<PreflightReport> {
  // 1. Compter les pages
  const pages = await legacyDb.query('SELECT id, url, html FROM pages');
  const autoMigratable: typeof pages = [];
  const manualReview: typeof pages = [];

  for (const page of pages) {
    if (canAutoMigrate(page.html)) {
      autoMigratable.push(page);
    } else {
      manualReview.push(page);
    }
  }

  // 2. Generer les redirects
  const redirects = pages.map((page) => ({
    source: page.url,
    target: generateNewUrl(page),
    status: 301 as const,
  }));

  // 3. Detecter les broken links
  const brokenLinks = await detectBrokenLinks(pages);

  return {
    totalPages: pages.length,
    autoMigratable: autoMigratable.length,
    manualReview: manualReview.length,
    redirects: collapseRedirectChains(redirects),
    brokenLinks,
  };
}

function canAutoMigrate(html: string): boolean {
  // Verifier si le HTML utilise des structures standard
  const hasCustomScripts = /<script/i.test(html);
  const hasIframes = /<iframe/i.test(html);
  const hasComplexCSS = /style="[^"]{200,}"/i.test(html);

  return !hasCustomScripts && !hasIframes && !hasComplexCSS;
}
```

### Migration runner avec rollback

```typescript
@Injectable()
export class MigrationRunner {
  constructor(
    private readonly source: DataSource,
    private readonly target: DataSource,
    private readonly logger: StructuredLogger,
  ) {}

  async migrateFeature(
    featureName: string,
    migrator: FeatureMigrator,
  ): Promise<MigrationResult> {
    this.logger.info('migration.started', { feature: featureName });

    const result: MigrationResult = {
      feature: featureName,
      migrated: 0,
      failed: 0,
      errors: [],
    };

    const items = await migrator.extractFromSource(this.source);

    for (const item of items) {
      try {
        const transformed = await migrator.transform(item);
        await migrator.loadToTarget(this.target, transformed);
        result.migrated++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          itemId: item.id,
          error: error.message,
        });
        this.logger.warn('migration.item_failed', {
          feature: featureName,
          itemId: item.id,
          error: error.message,
        });
      }
    }

    this.logger.info('migration.completed', {
      feature: featureName,
      migrated: result.migrated,
      failed: result.failed,
    });

    return result;
  }
}

interface FeatureMigrator {
  extractFromSource(db: DataSource): Promise<unknown[]>;
  transform(item: unknown): Promise<unknown>;
  loadToTarget(db: DataSource, item: unknown): Promise<void>;
}
```

---

## Résumé

1. **Strangler Fig** : migrer feature par feature derriere un proxy — jamais de Big Bang (échoué presque toujours)
2. **Pre-flight diff report** : inventorier contenu, URLs, broken links AVANT de migrer — pas de surprises
3. **AI HTML-to-block** : conversion automatique ~95%, review manuelle pour les 5% restants — accéléré massivement la migration
4. **Redirect seeding + chain collapsing** : toujours 301 pour le SEO, max 1 hop, post-persist listener pour collapser
5. **Zero-downtime** : les deux systèmes cohabitent, le proxy bascule progressivement, validation à chaque feature

---

> **Prochain cours** : [Cours 81 — Plugin & Extension Architecture](./05-plugin-extension-architecture.md)

---

> **Lien fil rouge — ShopArch**
>
> - Planifie la migration du search PostgreSQL FTS → Elasticsearch avec le Strangler Fig pattern
> - Définis les feature flags pour basculer progressivement le trafic
> - Exercice(s) associé(s) : `exercices/59-anti-corruption-layer/`
> - Checkpoint : Module 12, critère 3
