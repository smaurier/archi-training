# Exercice 39 — CSP hash-only

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 6 — La Défense
>
> **Prérequis** : Module 08 (cours 3)


## Objectif

Implémenter une Content Security Policy stricte pour ShopArch qui utilise des hashes (pas de nonces ni unsafe-inline) pour autoriser les scripts inline.

## Contexte

ShopArch utilise quelques scripts inline (analytics, config initiale) qui empechent d'utiliser une CSP stricte. L'objectif est d'eliminer `unsafe-inline` tout en conservant ces scripts nécessaires.

## Temps estime

45 min

## Instructions

### Étape 1 — Inventaire des scripts inline
Identifie tous les scripts inline dans les pages de ShopArch :
- Script de configuration (window.__CONFIG__)
- Script analytics (Google Tag Manager snippet)
- Styles inline (`style="..."` sur les composants)
- Event handlers inline (`onclick="..."`) — a eliminer

### Étape 2 — CSP avec hashes
Configure la CSP avec des hashes SHA-256 :
- Calculer le hash de chaque script inline autorise
- Ajouter les hashes dans `script-src`
- Eliminer `unsafe-inline` de `style-src` (deplacer les styles en fichiers)
- `script-src 'self' 'sha256-xxx'` pour chaque script inline autorise

### Étape 3 — Report-Only d'abord
Deploie en mode Report-Only avant d'activer :
- `Content-Security-Policy-Report-Only` pour tester sans bloquer
- Endpoint `/csp-report` pour collecter les violations
- Analyser les violations pendant 1 semaine

### Étape 4 — CSP complete
Ecris la CSP complete pour ShopArch :
- `default-src 'self'`
- `script-src 'self' 'sha256-...'` (hashes des scripts inline)
- `style-src 'self'` (pas de unsafe-inline)
- `img-src 'self' data: https://cdn.shoparch.com`
- `connect-src 'self' https://api.shoparch.com`
- `frame-ancestors 'none'`
- `form-action 'self'`
- `base-uri 'self'`

### Bonus
- Implémenter un nonce-based CSP comme alternative (généré côté serveur par requête)
- Ajouter `require-trusted-types-for 'script'` pour prevenir les injections DOM
- Comparer hash-based vs nonce-based en termes de sécurité et performance

## Contraintes
- Zero `unsafe-inline` dans la CSP finale
- Zero `unsafe-eval`
- Tous les scripts inline doivent avoir un hash valide
- Le mode Report-Only doit etre déployé avant le mode enforce
