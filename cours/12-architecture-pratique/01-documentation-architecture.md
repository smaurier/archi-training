# Cours 77 — Documentation d'architecture (ADR, C4)

> **Objectif** : Maîtriser les Architecture Decision Records (ADR), le modèle C4 (Context, Container, Component, Code), et adopter la documentation-as-product pour créer des living contracts plutot que de la doc morte.

---

## Rappel du cours précédent

<details>
<summary>1. Quels sont les 5 profiles de load testing k6 ?</summary>

1. **Smoke** (1-5 VUs, 2min) : baseline, pipeline CI
2. **Load** (50-200 VUs, 10-30min) : trafic normal
3. **Stress** (300+ VUs, 10-30min) : trouver le point de rupture
4. **Spike** (0→500 VUs, 2-5min) : absorption de pic soudain
5. **Soak** (100 VUs, 2-8h) : détecter memory/connection leaks
</details>

<details>
<summary>2. Qu'est-ce que le testing in production et comment le faire en sécurité ?</summary>

Déployer du nouveau code en **canary** (5% du trafic), observer les metriques (error rate, latence, business KPIs), comparer avec le baseline. Si les metriques sont dans les seuils → promote a 100%. Si regression → rollback automatique a 0%. Les feature flags permettent un kill switch instantane.
</details>

---

## Analogie — Le carnet de l'architecte d'interieur

Un architecte d'interieur ne se contente pas de livrer un plan — il tient un carnet de decisions :
- "On a choisi le bois plutot que le metal pour le plan de travail parce que le client voulait un rendu chaleureux" (ADR)
- "Vue d'ensemble de la maison depuis la rue" (C4 Context)
- "Plan du rez-de-chaussee : cuisine, salon, entree" (C4 Container)
- "Detail de la cuisine : ilot, evier, rangements" (C4 Component)

Sans ce carnet, le prochain architecte ne comprend pas POURQUOI les decisions ont ete prises.

---

## Théorie

### 1. Architecture Decision Records (ADR)

```markdown
# ADR-001 : Utiliser PostgreSQL comme base de donnees principale

## Status
Accepted (2024-03-01)

## Context
Nous devons choisir une base de donnees pour le CMS multi-tenant.
Les candidats sont PostgreSQL, MySQL, MongoDB.

## Decision
Nous utilisons PostgreSQL parce que :
- Schema-per-tenant natif (SET search_path)
- JSONB pour les champs i18n (MultiLangField)
- Full-text search integre (tsvector + GIN)
- Extension ecosystem (PostGIS, pg_trgm)

## Consequences
- L'equipe doit connaitre PostgreSQL (formation)
- Pas de document store natif (JSONB comme compromis)
- Lock-in PostgreSQL (migration vers MySQL couteuse)

## Alternatives rejetees
- MySQL : pas de schema-per-tenant natif, JSONB moins mature
- MongoDB : pas de transactions multi-documents fiables, schema implicite
```

### 2. Quand écrire un ADR

```
ECRIRE un ADR quand :
  ✓ Choix de technologie (DB, framework, cloud provider)
  ✓ Choix d'architecture (monolithe vs microservices, CQRS)
  ✓ Choix de pattern (auth strategy, caching strategy)
  ✓ Decision irreversible ou couteuse a changer

NE PAS ecrire un ADR pour :
  ✗ Choix de convention (camelCase vs snake_case)
  ✗ Decision locale a un fichier
  ✗ Choix reversible en 5 min
```

### 3. Modèle C4 — 4 niveaux de zoom

```
Niveau 1 : System Context
┌──────────┐     ┌────────────────┐     ┌──────────┐
│  Admin   │────>│     CMS        │<────│ Visiteur │
│  (BO)    │     │   Platform     │     │  (FO)    │
└──────────┘     └───────┬────────┘     └──────────┘
                         │
                  ┌──────▼──────┐
                  │  Keycloak   │
                  │  (Auth)     │
                  └─────────────┘

Niveau 2 : Container
┌─────────────────────────────────────────┐
│              CMS Platform               │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐│
│  │ Next.js  │  │React+Vite│  │ API   ││
│  │  (FO)    │  │  (BO)    │  │Symfony││
│  └──────────┘  └──────────┘  └───┬───┘│
│                                   │    │
│              ┌──────────┐  ┌─────▼──┐ │
│              │  Redis    │  │  PG    │ │
│              └──────────┘  └────────┘ │
└─────────────────────────────────────────┘

Niveau 3 : Component
┌─────────────────── API Symfony ──────────────────┐
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Content  │  │  Media   │  │  Auth    │      │
│  │ Module   │  │  Module  │  │  Module  │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│  ┌──────────┐  ┌──────────┐                     │
│  │ Webhook  │  │  Search  │                     │
│  │ Module   │  │  Module  │                     │
│  └──────────┘  └──────────┘                     │
└──────────────────────────────────────────────────┘

Niveau 4 : Code (diagrammes de classes — rarement necessaire)
```

### 4. Documentation-as-product

| Doc morte | Doc vivante (living contract) |
|---|---|
| Word/Confluence jamais mis a jour | Markdown dans le repo, PR obligatoire |
| Personne ne sait ou elle est | Decouvrable (README, CLAUDE.md) |
| Pas de validation | CI vérifié la cohérence |
| 1 audience | 3 audiences (AI agents, devs, non-tech) |
| Redige une fois, oublie | Mis a jour avec le code |

### 5. Three-audience documentation

```
.context/     → AI agents (source of truth, English, structured)
docs/dev/     → Developers (guides, API reference, tutorials)
docs/product/ → Non-technical (getting started, user guide, FAQ)

Flux : .context/ → sync → docs/
Regle : jamais de duplication entre .context/ et docs/
```

---

## Pratique

### Template ADR

```markdown
# ADR-{number} : {title}

## Status
{Proposed | Accepted | Deprecated | Superseded by ADR-XXX}

## Date
{YYYY-MM-DD}

## Context
{Quel probleme resout-on ? Quel est le contexte ?}

## Decision
{Quelle decision a ete prise et pourquoi ?}

## Consequences
{Quels sont les impacts positifs et negatifs ?}

## Alternatives rejetees
{Quelles autres options ont ete envisagees et pourquoi rejetees ?}
```

### Diagramme C4 en code (Structurizr DSL)

```
workspace {
    model {
        admin = person "Admin" "Gere le contenu et la config"
        visitor = person "Visiteur" "Consulte le site public"

        cms = softwareSystem "CMS Platform" {
            fo = container "Front-Office" "Next.js" "SSR/ISR"
            bo = container "Back-Office" "React + Vite" "SPA"
            api = container "API" "Symfony 7.4 + API Platform" {
                content = component "Content Module" "CRUD articles, pages"
                media = component "Media Module" "Upload, resize, DAM"
                auth = component "Auth Module" "OIDC, RBAC"
            }
            db = container "PostgreSQL" "Base de donnees" "Schema-per-tenant"
            redis = container "Redis" "Cache + sessions"
            s3 = container "S3" "Stockage media"
        }

        keycloak = softwareSystem "Keycloak" "Identity Provider" "External"

        admin -> bo "Gere le contenu"
        visitor -> fo "Consulte le site"
        fo -> api "API calls (REST)"
        bo -> api "API calls (REST)"
        api -> db "Reads/Writes"
        api -> redis "Cache"
        api -> s3 "Media storage"
        api -> keycloak "OIDC validation"
    }

    views {
        systemContext cms {
            include *
            autolayout lr
        }
        container cms {
            include *
            autolayout lr
        }
    }
}
```

### Fitness function pour la doc

```typescript
// tests/doc-freshness.test.ts
import { describe, it, expect } from 'vitest';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

describe('Documentation freshness', () => {
  it('tous les ADRs ont un status valide', async () => {
    const adrDir = './docs/adrs';
    const files = await readdir(adrDir);
    const adrs = files.filter((f) => f.endsWith('.md'));

    for (const file of adrs) {
      const content = await readFile(join(adrDir, file), 'utf-8');
      expect(content).toMatch(/## Status\n(Proposed|Accepted|Deprecated|Superseded)/);
    }
  });

  it('aucun fichier .context/ modifie depuis > 90 jours sans review', async () => {
    const contextDir = './.context';
    const files = await glob(`${contextDir}/**/*.md`);
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

    const staleFiles = [];
    for (const file of files) {
      const { mtime } = await stat(file);
      if (mtime.getTime() < ninetyDaysAgo) {
        staleFiles.push(file);
      }
    }

    if (staleFiles.length > 0) {
      console.warn('Stale docs:', staleFiles);
    }
    // Warning, pas failure — la doc peut etre stable
  });
});
```

---

## Resume

1. **ADR** : documenter les decisions architecturales (contexte, decision, consequences, alternatives) — quand la decision est couteuse a reverser
2. **C4** : 4 niveaux de zoom (Context → Container → Component → Code) — communiquer a différentes audiences
3. **Documentation-as-product** : Markdown dans le repo, CI-validated, 3 audiences (AI agents, devs, non-tech)
4. **Living contracts** : la doc evolue avec le code (meme PR), jamais de doc Word isolee sur un drive
5. **Fitness functions** : tests automatises pour vérifier la cohérence de la doc (status ADR valide, freshness)

---

> **Prochain cours** : [Cours 78 — Architecture Review & Code Review](./02-architecture-review.md)

---

> **Lien fil rouge — ShopArch**
>
> - Rédige le diagramme C4 de ShopArch (niveaux 1 à 3)
> - Crée au moins 3 ADRs : choix de NestJS, choix de PostgreSQL, choix de l'auth OIDC
> - Exercice(s) associé(s) : `exercices/53-adr-c4-fil-rouge/`
> - Checkpoint : Module 12, critère 1-2
