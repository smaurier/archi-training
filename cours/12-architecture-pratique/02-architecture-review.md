# Cours 78 — Architecture Review & Code Review

> **Objectif** : Differencier architecture review et code review, maîtriser ATAM (Architecture Tradeoff Analysis Method), implémenter des fitness functions automatisees, et intégrer les LADR dans les pull requests.

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce qu'un ADR et quand en écrire un ?</summary>

Un Architecture Decision Record documente une decision architecturale avec contexte, decision, consequences, et alternatives rejetees. Écrire un ADR quand : choix de technologie, choix de pattern, decision irreversible ou couteuse a changer. Ne PAS en écrire pour les conventions locales ou les choix reversibles en 5 min.
</details>

<details>
<summary>2. Quels sont les 4 niveaux du modèle C4 ?</summary>

1. **Context** : le système vu de l'exterieur (acteurs, systèmes externes)
2. **Container** : les grands blocs (front, back, DB, cache)
3. **Component** : les modules internes d'un container
4. **Code** : les classes/interfaces (rarement nécessaire)
</details>

---

## Analogie — L'inspection d'un immeuble

- **Code review** : vérifier qu'une brique est bien posee, que le ciment est correct, que la couleur est la bonne
- **Architecture review** : vérifier que les murs porteurs sont au bon endroit, que la plomberie est bien dimensionnee, que le batiment resiste aux tremblements de terre

Une brique parfaitement posee au mauvais endroit est pire qu'une brique mal posee au bon endroit.

---

## Théorie

### 1. Code review vs Architecture review

| | Code review | Architecture review |
|---|---|---|
| **Scope** | Un fichier, une PR | Un système, un module entier |
| **Quand** | Chaque PR | Avant un projet, à chaque milestone |
| **Qui** | Tout dev de l'équipe | Tech lead, architecte |
| **Duree** | 15-30 min | 1-4h |
| **Quoi** | Style, bugs, performance locale | Trade-offs, couplage, scalabilité |

### 2. ATAM — Architecture Tradeoff Analysis Method

```
Etape 1 : Presenter l'architecture (C4 diagrams)
Etape 2 : Identifier les quality attributes prioritaires
           (performance, security, maintainability, scalability)
Etape 3 : Analyser les scenarios critiques
           "Que se passe-t-il si le trafic triple ?"
           "Que se passe-t-il si Keycloak est down ?"
Etape 4 : Identifier les trade-offs
           "Le cache Redis ameliore la perf mais complique l'invalidation"
Etape 5 : Documenter les risques et les decisions (ADR)
```

### 3. Architecture review checklist

```
□ SEPARATION OF CONCERNS
  - Les modules sont-ils bien decouples ?
  - Y a-t-il des dependances circulaires ?
  - Le domaine depend-il de l'infrastructure ?

□ SCALABILITY
  - Le systeme est-il stateless ?
  - Les bottlenecks sont-ils identifies ?
  - Le cache est-il bien dimensionne ?

□ RESILIENCE
  - Circuit breakers sur les appels externes ?
  - Graceful degradation si un service est down ?
  - Timeouts definis a chaque couche ?

□ SECURITY
  - Threat model STRIDE fait ?
  - Zero trust entre services ?
  - PII pseudonymisee dans les logs ?

□ OBSERVABILITY
  - Logging structure + correlation IDs ?
  - SLOs definis et mesures ?
  - Alertes multi-window configurees ?

□ TESTABILITY
  - Strategie de test definie (pyramide) ?
  - Contract tests entre services ?
  - Load test en CI ?
```

### 4. Fitness functions

```
= Tests automatises qui verifient des invariants architecturaux

Exemples :
  "Aucune dependance cyclique entre modules"
  "Le bundle JS ne depasse jamais 200KB gzip"
  "Aucun import direct de l'infra dans le domaine"
  "Toutes les entites ont un champ version (optimistic lock)"
  "Aucun endpoint sans rate limiting"
```

### 5. LADR — Lightweight ADR en pull request

```markdown
## LADR : Utiliser Redis pour le cache de session

**Context** : Les sessions sont stockees en DB, latence 10ms par requete.
**Decision** : Migrer les sessions vers Redis (TTL 24h).
**Trade-off** : +complexite ops (Redis a maintenir), -latence (1ms).

Reviewer : est-ce que ce trade-off est acceptable ?
```

---

## Pratique

### Fitness function — pas de dépendance cyclique

```typescript
// tests/architecture/no-circular-deps.test.ts
import { describe, it, expect } from 'vitest';
import madge from 'madge';

describe('Architecture fitness', () => {
  it('aucune dependance circulaire', async () => {
    const result = await madge('./src', {
      fileExtensions: ['ts'],
      tsConfigPath: './tsconfig.json',
    });

    const circular = result.circular();

    if (circular.length > 0) {
      console.error('Circular dependencies found:');
      circular.forEach((cycle) => console.error(`  ${cycle.join(' → ')}`));
    }

    expect(circular).toHaveLength(0);
  });
});
```

### Fitness function — isolation domaine/infra

```typescript
// tests/architecture/domain-isolation.test.ts
import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { glob } from 'glob';

describe('Domain isolation', () => {
  it('le domaine ne depend pas de linfrastructure', async () => {
    const domainFiles = await glob('./src/domain/**/*.ts');
    const forbiddenImports = [
      'typeorm', 'prisma', '@nestjs', 'express',
      'redis', 'bull', 'aws-sdk',
    ];

    const violations: string[] = [];

    for (const file of domainFiles) {
      const content = await readFile(file, 'utf-8');
      for (const forbidden of forbiddenImports) {
        if (content.includes(`from '${forbidden}`) ||
            content.includes(`from "${forbidden}`)) {
          violations.push(`${file} imports ${forbidden}`);
        }
      }
    }

    expect(violations).toHaveLength(0);
  });
});
```

### Fitness function — bundle size budget

```typescript
// tests/architecture/bundle-budget.test.ts
import { describe, it, expect } from 'vitest';
import { stat } from 'fs/promises';
import { glob } from 'glob';

describe('Bundle size budget', () => {
  it('JS bundle < 200KB gzip', async () => {
    const jsFiles = await glob('./dist/assets/*.js');
    let totalSize = 0;

    for (const file of jsFiles) {
      const { size } = await stat(file);
      totalSize += size;
    }

    const totalKB = totalSize / 1024;
    console.log(`Total JS bundle: ${totalKB.toFixed(1)}KB`);

    // 200KB gzip ≈ ~600KB uncompressed
    expect(totalKB).toBeLessThan(600);
  });

  it('HTML initial < 80KB', async () => {
    const htmlFiles = await glob('./dist/index.html');
    for (const file of htmlFiles) {
      const { size } = await stat(file);
      expect(size / 1024).toBeLessThan(80);
    }
  });
});
```

---

## Résumé

1. **Architecture review** : examiner le système entier (trade-offs, couplage, scalabilité) — pas juste la PR
2. **ATAM** : présenter l'archi, identifier les quality attributes, analyser les scénarios critiques, documenter les trade-offs
3. **Fitness functions** : tests automatises pour les invariants (pas de circular deps, bundle < 200KB, domaine isole de l'infra)
4. **LADR en PR** : decision architecturale légère directement dans la pull request — context, decision, trade-off
5. **Checklist** : SoC, scalability, résilience, security, observability, testability — a parcourir à chaque milestone

---

> **Prochain cours** : [Cours 79 — Dette technique & Refactoring stratégique](./03-dette-technique.md)

---

> **Lien fil rouge — ShopArch**
>
> - Réalise une architecture review de ShopArch avec la checklist fournie
> - Identifie les points d'amélioration et les risques architecturaux
> - Exercice(s) associé(s) : `exercices/53-adr-c4-fil-rouge/`
> - Checkpoint : Module 12, critère 2
