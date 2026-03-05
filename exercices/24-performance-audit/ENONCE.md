# Exercice 24 — Performance audit Lighthouse

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h30 | **Ère** : 3 — Le Front
>
> **Prérequis** : Module 05 (cours 7)


## Objectif

Realiser un audit de performance complet d'un site e-commerce et proposer un plan d'optimisation base sur Core Web Vitals.

## Contexte

La page catalogue de ShopArch obtient un score Lighthouse de 52. L'objectif est d'atteindre 90+.

## Temps estime

45 min

## Instructions

### Étape 1 — Identifier les metriques

| Metrique | Valeur actuelle | Cible | Impact |
|---|---|---|---|
| LCP | 4.8s | < 2.5s | Images non optimisees, pas de preload |
| CLS | 0.35 | < 0.1 | Images sans dimensions, font flash |
| INP | 380ms | < 200ms | JS bundle trop gros, hydration lourde |
| TTFB | 1.2s | < 600ms | Pas de cache serveur |
| FCP | 3.1s | < 1.8s | CSS render-blocking |

### Étape 2 — Plan d'optimisation

Pour chaque metrique, propose 2-3 actions concretes ordonnees par impact.

### Étape 3 — Implémenter les quick wins

- `<link rel="preconnect">` pour les origines critiques
- `loading="lazy"` sur les images below the fold
- `width` et `height` sur toutes les images (CLS)
- Performance budget dans le CI (Lighthouse score >= 90)

### Bonus

- Implémenter un custom hook `useWebVitals()` pour le RUM
- Configurer Lighthouse CI dans le pipeline

## Contraintes

- Performance budgets : HTML <= 80KB gzip, JS <= 200KB gzip
- Core Web Vitals cibles : LCP < 2.5s, CLS < 0.1, INP < 200ms
- Chaque optimisation doit etre mesurable
