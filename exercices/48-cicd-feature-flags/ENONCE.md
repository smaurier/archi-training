# Exercice 48 — CI/CD et feature flags

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 6 — La Défense
>
> **Prérequis** : Module 10 (cours 4)


## Objectif

Implémenter un pipeline CI/CD complet pour ShopArch avec feature flags, trunk-based development, et deployments progressifs.

## Contexte

ShopArch deploie manuellement 1 fois par semaine. Les branches longues causent des conflits de merge. L'équipe veut passer a du déploiement continu (plusieurs fois par jour) en toute sécurité.

## Temps estime

1h

## Instructions

### Étape 1 — Feature flags
Implemente un système de feature flags :
- 3 types : boolean (on/off), percentage (rollout progressif), user-based (beta testers)
- Stockage : base de données + cache Redis (TTL 30s)
- API pour modifier les flags en temps reel (sans redeploiement)
- SDK front-end et back-end

### Étape 2 — Pipeline CI
Configure le pipeline CI (GitHub Actions) :
- Lint + type check
- Tests unitaires + intégration
- Build + scan sécurité (npm audit, gitleaks)
- Preview deploy sur PR (Vercel/Netlify preview)
- Gate : tous les checks doivent passer avant merge

### Étape 3 — Pipeline CD
Configure le déploiement continu :
- Merge sur main → déploiement automatique en staging
- Validation en staging (smoke tests automatiques)
- Promotion staging → production (manuelle ou auto apres smoke tests)
- Rollback automatique si le error rate augmente apres deploy

### Étape 4 — Trunk-based development
Definis le workflow de développement :
- Branches courtes (< 1 jour), merge via PR
- Feature flags pour cacher les features en cours
- Les features sont mergees dans main MEME si pas terminees (derriere un flag)
- Release = activer le feature flag, pas déployer du code

### Bonus
- Implémenter un canary deployment (1% → 10% → 50% → 100%)
- Ajouter des feature flag analytics (qui utilise quoi)
- Implémenter le kill switch (désactiver une feature en < 30s)

## Contraintes
- Le pipeline CI doit prendre < 5 min
- Le rollback doit etre possible en < 1 min
- Les feature flags doivent supporter le multi-tenant (flag actif pour tenant A mais pas B)
