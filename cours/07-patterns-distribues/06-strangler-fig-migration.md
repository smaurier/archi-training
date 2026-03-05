# Cours 54 — Strangler Fig & Migration progressive

> **Objectif** : Maîtriser le Strangler Fig pattern pour migrer un système legacy incrementalement, gérer les redirects, et planifier une migration zero-downtime.

---

## Rappel du cours précédent

<details>
<summary>1. Quels sont les 3 états d'un Circuit Breaker ?</summary>

- **Closed** : le service fonctionne, les requêtes passent normalement
- **Open** : le seuil d'echecs est atteint, les requêtes echouent immédiatement (fail fast) sans appeler le service
- **Half-Open** : apres un timer, quelques requêtes de test sont autorisees. Si elles reussissent → retour a Closed. Si elles echouent → retour a Open.
</details>

<details>
<summary>2. Quelle est la différence entre RPO et RTO ?</summary>

- **RPO** (Recovery Point Objective) : la perte de données maximale acceptable (ex: 1h = on accepte de perdre max 1h de données)
- **RTO** (Recovery Time Objective) : le temps maximal pour restaurer le service (ex: 4h = le système doit repartir en 4h)
Le RPO dimensionne la fréquence des backups, le RTO dimensionne l'infrastructure de failover.
</details>

---

## Analogie — Renover un immeuble habite

Tu ne peux pas demander a tous les locataires de demenager pendant les travaux. Au lieu de demolir et reconstruire (Big Bang), tu renoves **appartement par appartement** :

1. Tu construis un nouvel appartement identique a côté
2. Tu rediriges les locataires de l'ancien vers le nouveau
3. Tu demolie l'ancien appartement
4. Tu passes au suivant

C'est le **Strangler Fig** : le nouveau système enveloppe progressivement l'ancien, comme un figuier etrangleur enveloppe l'arbre hote.

---

## Théorie

### 1. Strangler Fig pattern

```
Phase 1 : Proxy devant le legacy
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Clients  │────>│   Proxy /    │────>│   Legacy     │
│           │     │   Gateway    │     │   System     │
└──────────┘     └──────────────┘     └──────────────┘

Phase 2 : Migrer feature par feature
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Clients  │────>│   Proxy      │──┬─>│   Legacy     │
│           │     │              │  │  │ (- produits) │
└──────────┘     └──────────────┘  │  └──────────────┘
                                    │
                                    │  ┌──────────────┐
                                    └─>│   New System  │
                                       │ (+ produits) │
                                       └──────────────┘

Phase 3 : Legacy vide → decomissionne
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Clients  │────>│   Proxy      │────>│   New System │
│           │     │              │     │   (complet)  │
└──────────┘     └──────────────┘     └──────────────┘
```

### 2. Les 6 étapes de migration

| Étape | Action | Risque |
|---|---|---|
| 1. **Inventaire** | Lister toutes les features du legacy | Sous-estimer la complexité |
| 2. **Proxy** | Placer un reverse proxy devant le legacy | Latence ajoutee |
| 3. **Re-implémentation** | Reimplementer UNE feature dans le nouveau système | Manquer un edge case |
| 4. **Bascule** | Rediriger le trafic de cette feature vers le nouveau | Regression |
| 5. **Validation** | Vérifier que tout fonctionne (A/B, shadow traffic) | Differences subtiles |
| 6. **Nettoyage** | Supprimer la feature du legacy | Dependances cachees |

**Repeter les étapes 3-6 pour chaque feature.**

### 3. Pre-flight diff report

Avant la migration, générer un rapport de différences :

```
Pre-flight Report — Migration CMS v1 → v2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pages total : 1,247
Pages migrables automatiquement : 1,180 (94.6%)
Pages necessitant review manuelle : 67 (5.4%)

URLs a rediriger :
  /old-products/123  →  /products/t-shirt-bio
  /category/shoes    →  /categories/chaussures
  ... (842 redirects)

Broken links apres migration : 23
  - /old-api/v1/products (supprime) → referencer /api/v2/products
  - /static/logo-old.png → /assets/logo.svg
```

### 4. Redirect stratégies

| Type | Quand | HTTP Code |
|---|---|---|
| **301 Permanent** | L'URL a definitivement change | SEO : transfere le "link juice" |
| **302 Temporary** | Migration en cours, pas sure | SEO : ne transfere pas |
| **308 Permanent Redirect** | Comme 301 mais preserve la méthode HTTP | API endpoints |

**Redirect chain collapsing** : quand un redirect pointe vers un autre redirect, mettre a jour pour pointer directement vers la destination finale (max 1 hop).

### 5. Shadow traffic / Dark launching

Envoyer le trafic **aux deux systèmes** en parallele et comparer les réponses :

```
Client → Proxy → Legacy (response servie au client)
              └→ New System (response comparee en background)

Si les reponses different → log l'ecart pour investigation
Si identiques → confiance pour basculer
```

---

## Pratique

### Proxy de migration (NestJS)

```typescript
@Controller('*')
export class MigrationProxyController {
  constructor(
    private readonly httpService: HttpService,
    private readonly migrationConfig: MigrationConfigService,
  ) {}

  @All()
  async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    const path = req.path;

    // Verifier si cette route est migree
    const target = this.migrationConfig.getTarget(path);

    if (target === 'new') {
      // Route migree → nouveau systeme
      const response = await this.httpService.axiosRef({
        method: req.method,
        url: `${process.env.NEW_SYSTEM_URL}${path}`,
        headers: this.forwardHeaders(req),
        data: req.body,
      });
      res.status(response.status).json(response.data);
    } else {
      // Route non migree → legacy
      const response = await this.httpService.axiosRef({
        method: req.method,
        url: `${process.env.LEGACY_URL}${path}`,
        headers: this.forwardHeaders(req),
        data: req.body,
      });
      res.status(response.status).json(response.data);
    }
  }
}

// Configuration de migration (quelles routes sont migrees)
@Injectable()
export class MigrationConfigService {
  // Map : route pattern → target system
  private readonly routes = new Map<string, 'new' | 'legacy'>([
    ['/api/products', 'new'],       // Migre
    ['/api/categories', 'new'],     // Migre
    ['/api/orders', 'legacy'],      // Pas encore migre
    ['/api/users', 'legacy'],       // Pas encore migre
  ]);

  getTarget(path: string): 'new' | 'legacy' {
    for (const [pattern, target] of this.routes) {
      if (path.startsWith(pattern)) return target;
    }
    return 'legacy'; // Defaut : legacy
  }
}
```

### Redirect seeding script

```typescript
// scripts/seed-redirects.ts
interface RedirectRule {
  source: string;    // Ancienne URL
  target: string;    // Nouvelle URL
  status: 301 | 302 | 308;
}

async function seedRedirects(rules: RedirectRule[]): Promise<void> {
  // Collapse les chaines de redirects
  const collapsed = collapseRedirectChains(rules);

  for (const rule of collapsed) {
    await db.query(
      `INSERT INTO redirects (source, target, status_code)
       VALUES ($1, $2, $3)
       ON CONFLICT (source) DO UPDATE SET target = $2, status_code = $3`,
      [rule.source, rule.target, rule.status],
    );
  }

  console.log(`Seeded ${collapsed.length} redirects`);
}

function collapseRedirectChains(rules: RedirectRule[]): RedirectRule[] {
  const targetMap = new Map(rules.map((r) => [r.source, r]));

  return rules.map((rule) => {
    let finalTarget = rule.target;
    let hops = 0;
    const maxHops = 10;

    while (targetMap.has(finalTarget) && hops < maxHops) {
      finalTarget = targetMap.get(finalTarget)!.target;
      hops++;
    }

    return { ...rule, target: finalTarget };
  });
}
```

### Migration progress tracker

```typescript
interface MigrationProgress {
  feature: string;
  status: 'pending' | 'implemented' | 'testing' | 'migrated' | 'cleaned';
  legacyEndpoints: string[];
  newEndpoints: string[];
  migratedAt?: Date;
}

const progress: MigrationProgress[] = [
  {
    feature: 'Product Catalog',
    status: 'migrated',
    legacyEndpoints: ['/old-api/products', '/old-api/categories'],
    newEndpoints: ['/api/v2/products', '/api/v2/categories'],
    migratedAt: new Date('2024-06-15'),
  },
  {
    feature: 'Order Management',
    status: 'testing',
    legacyEndpoints: ['/old-api/orders'],
    newEndpoints: ['/api/v2/orders'],
  },
  {
    feature: 'User Management',
    status: 'pending',
    legacyEndpoints: ['/old-api/users', '/old-api/auth'],
    newEndpoints: [],
  },
];
```

---

## Resume

1. **Strangler Fig** : migrer feature par feature derriere un proxy — jamais de Big Bang rewrite
2. **Pre-flight diff report** : inventorier pages, URLs, broken links AVANT de migrer
3. **Redirect seeding** + **chain collapsing** : max 1 hop, toujours 301 pour le SEO
4. **Shadow traffic** : envoyer aux deux systèmes et comparer — confiance avant bascule
5. **Le Big Bang échoué presque toujours** — la migration incrementale est plus lente mais infiniment plus sure

---

> **Prochain cours** : [Cours 55 — Consistency Patterns avances](./07-consistency-patterns.md)

---

> **Lien fil rouge — ShopArch**
>
> - Planifie la migration progressive d'un module ShopArch (Strangler Fig pattern)
> - Identifie les feature flags nécessaires pour la migration incrémentale
> - Exercice(s) associé(s) : `exercices/59-anti-corruption-layer/`
> - Checkpoint : Module 13, critère 3
