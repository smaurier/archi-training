# Cours 79 — Dette technique & Refactoring stratégique

> **Objectif** : Classifier les types de dette technique (quadrant de Fowler), mesurer la dette, prioriser avec la matrice impact/effort, et différencier le refactoring stratégique du tactique.

---

## Rappel du cours précédent

<details>
<summary>1. Quelle est la différence entre une architecture review et une code review ?</summary>

La **code review** examine une PR (style, bugs, performance locale — 15-30min). L'**architecture review** examine le système entier ou un module (trade-offs, couplage, scalabilité — 1-4h). Une brique parfaitement posee au mauvais endroit est pire qu'une brique mal posee au bon endroit.
</details>

<details>
<summary>2. Qu'est-ce qu'une fitness function ?</summary>

Un test automatise qui vérifié un **invariant architectural** : "aucune dépendance circulaire", "bundle JS < 200KB", "le domaine ne dépend pas de l'infra". Les fitness functions protegent les decisions d'architecture contre l'erosion — si quelqu'un viole l'invariant, le CI échoué.
</details>

---

## Analogie — La dette financiere

La dette technique est exactement comme une dette financiere :
- **Emprunter** (prendre un raccourci) accéléré le court terme
- **Les intérêts** (cout de maintenance) s'accumulent avec le temps
- **Rembourser** (refactorer) est douloureux mais nécessaire
- **La faillite** (rewrite total) arrive quand les intérêts depassent la capacité de remboursement

Comme en finance : un emprunt delibere et planifie est sain. S'endetter par ignorance ou negligence est dangereux.

---

## Théorie

### 1. Quadrant de Fowler

```
                    Deliberee              Accidentelle
              ┌─────────────────────┬─────────────────────┐
              │                     │                     │
  Prudente    │  "On sait qu'on     │  "On decouvre       │
              │   prend un raccourci│   maintenant une    │
              │   — on le rembourse │   meilleure facon"  │
              │   au prochain       │                     │
              │   sprint"           │                     │
              ├─────────────────────┼─────────────────────┤
              │                     │                     │
  Imprudente  │  "On n'a pas le     │  "C'est quoi une    │
              │   temps de bien     │   architecture      │
              │   faire"            │   hexagonale ?"     │
              │                     │                     │
              └─────────────────────┴─────────────────────┘

La dette deliberee+prudente est ACCEPTABLE (trade-off conscient).
La dette accidentelle+imprudente est DANGEREUSE (ignorance).
```

### 2. Mesurer la dette

| Metrique | Outil | Seuil d'alerte |
|---|---|---|
| **Cyclomatic complexity** | ESLint, SonarQube | > 10 par fonction |
| **Code duplication** | SonarQube, jscpd | > 5% |
| **Coupling** (afferent/efferent) | madge, dependency-cruiser | Ratio instabilite > 0.8 |
| **Test coverage** branches critiques | vitest, c8 | < 70% |
| **TODO/FIXME count** | grep | Croissance sur 3 sprints |
| **Time to change** | Git metrics | > 2h pour un changement simple |

### 3. Matrice impact/effort

```
          Impact eleve
              │
    Quick     │    Strategic
    Wins      │    (planifier)
    (faire    │
    tout de   │
    suite)    │
──────────────┼──────────────── Effort
              │
    Fill      │    Money
    (ignorer) │    Pit
              │    (eviter !)
              │
          Impact faible

Priority : Quick Wins > Strategic > Fill > Money Pit
```

### 4. Refactoring stratégique vs tactique

| | Tactique | Stratégique |
|---|---|---|
| **Scope** | 1 fichier, 1 fonction | 1 module, 1 bounded context |
| **Duree** | Pendant une PR (30 min) | Planifie (1-3 sprints) |
| **Trigger** | Boy Scout Rule ("laisse le code plus propre") | Decision d'équipe (ADR) |
| **Risque** | Faible | Moyen-élevé |
| **Exemple** | Renommer une variable, extraire une fonction | Migrer de layered a hexagonal |

### 5. Boy Scout Rule

```
"Laisse le code plus propre que tu ne l'as trouve."

Quand tu touches un fichier pour une feature :
  ✓ Renomme une variable peu claire
  ✓ Supprime du code mort
  ✓ Ajoute un type manquant
  ✗ Ne refactore PAS un module entier dans la meme PR

Refactoring tactique = dans la PR
Refactoring strategique = dans une PR dediee
```

### 6. Quand NE PAS rembourser

```
NE PAS refactorer si :
  - Le module sera supprime bientot (legacy en fin de vie)
  - Le cout du refactoring > le cout de la dette sur 6 mois
  - Le code fonctionne et n'est jamais modifie
  - L'equipe n'a pas les connaissances pour bien refactorer

"Working code that nobody touches has zero maintenance cost."
```

---

## Pratique

### Debt tracking avec tags dans le code

```typescript
// Convention : les commentaires DEBT sont trackables
// DEBT(high): Ce service fait trop de choses — decomposer en 3 services
// DEBT(medium): La validation devrait etre dans le domaine, pas le controller
// DEBT(low): Renommer cette variable — le nom ne reflète pas l'usage

// Script pour extraire les dettes
// scripts/debt-report.ts
import { readFile } from 'fs/promises';
import { glob } from 'glob';

async function generateDebtReport(): Promise<void> {
  const files = await glob('./src/**/*.ts');
  const debts: Array<{ file: string; line: number; priority: string; message: string }> = [];

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const match = line.match(/DEBT\((high|medium|low)\):\s*(.+)/);
      if (match) {
        debts.push({
          file,
          line: index + 1,
          priority: match[1],
          message: match[2].trim(),
        });
      }
    });
  }

  console.log(`\nTechnical Debt Report`);
  console.log(`Total: ${debts.length} items`);
  console.log(`  High:   ${debts.filter((d) => d.priority === 'high').length}`);
  console.log(`  Medium: ${debts.filter((d) => d.priority === 'medium').length}`);
  console.log(`  Low:    ${debts.filter((d) => d.priority === 'low').length}`);

  for (const debt of debts.filter((d) => d.priority === 'high')) {
    console.log(`  [HIGH] ${debt.file}:${debt.line} — ${debt.message}`);
  }
}
```

### Metriques de couplage

```typescript
// tests/architecture/coupling.test.ts
import { describe, it, expect } from 'vitest';
import madge from 'madge';

describe('Module coupling', () => {
  it('aucun module na plus de 10 dependances entrantes', async () => {
    const result = await madge('./src', {
      fileExtensions: ['ts'],
      tsConfigPath: './tsconfig.json',
    });

    const deps = result.obj();
    const incomingCount = new Map<string, number>();

    // Compter les dependances entrantes
    for (const [, targets] of Object.entries(deps)) {
      for (const target of targets) {
        incomingCount.set(target, (incomingCount.get(target) ?? 0) + 1);
      }
    }

    const overCoupled = [...incomingCount.entries()]
      .filter(([, count]) => count > 10)
      .sort(([, a], [, b]) => b - a);

    if (overCoupled.length > 0) {
      console.warn('Over-coupled modules:');
      overCoupled.forEach(([mod, count]) =>
        console.warn(`  ${mod}: ${count} incoming deps`),
      );
    }

    expect(overCoupled.length).toBeLessThan(5);
  });
});
```

---

## Résumé

1. **Quadrant de Fowler** : dette deliberee+prudente est acceptable, dette accidentelle+imprudente est dangereuse
2. **Mesurer** : cyclomatic complexity, duplication, coupling, coverage, time to change — si ça ne se mesure pas, ça ne se géré pas
3. **Matrice impact/effort** : Quick Wins d'abord, Strategic ensuite, ignorer les Fill, éviter les Money Pits
4. **Tactique vs Stratégique** : Boy Scout Rule dans chaque PR (tactique) + sprints dédiés pour les gros refactorings (stratégique)
5. **Ne PAS rembourser** si le module sera supprime, si le cout du refactoring dépasse le cout de la dette, ou si le code n'est jamais touche

---

> **Prochain cours** : [Cours 80 — Stratégies de migration](./04-stratégies-migration.md)

---

> **Lien fil rouge — ShopArch**
>
> - Identifie la dette technique actuelle de ShopArch et classe-la (prudente vs imprudente)
> - Définis des fitness functions pour prévenir la régression architecturale
> - Exercice(s) associé(s) : `exercices/54-fitness-functions/`
> - Checkpoint : Module 12, critère 3
