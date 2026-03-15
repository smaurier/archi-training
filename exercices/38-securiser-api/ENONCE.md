# Exercice 38 — Sécuriser l'API

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h30 | **Ère** : 6 — La Défense
>
> **Prérequis** : Module 08 (cours 2-4)


## Objectif

Implémenter les protections OWASP Top 10 sur l'API de ShopArch : injection, broken auth, IDOR, mass assignment, rate limiting.

## Contexte

L'API de ShopArch a ete auditee et plusieurs vulnérabilités ont ete trouvees. Tu dois les corriger une par une en appliquant les bonnes pratiques OWASP.

## Temps estime

1h30

## Instructions

### Étape 1 — Injection (A03:2021)
Corrige les vulnérabilités d'injection :
- SQL injection : utiliser des requêtes parametrees (jamais de concatenation)
- NoSQL injection : valider les types avant de passer a MongoDB/Elasticsearch
- Command injection : ne jamais passer d'input user a `exec()`

### Étape 2 — Broken Access Control (A01:2021)
Implemente le controle d'accès :
- IDOR : vérifier que l'utilisateur a le droit d'accéder à la ressource demandee
- Mass assignment : utiliser des DTOs explicites (pas de spread `...body`)
- Vérifier les permissions à chaque endpoint (pas seulement au niveau route)

### Étape 3 — Security Headers
Configure les headers de sécurité :
- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy`
- `X-Request-ID` pour la traçabilité

### Étape 4 — Input validation
Implemente la validation stricte :
- Valider TOUS les inputs (params, query, body, headers)
- Whitelist des champs acceptes (pas blacklist)
- Sanitize les outputs (echapper HTML dans les réponses JSON)
- Limiter la taille des payloads (1 MB max)

### Bonus
- Implémenter un WAF basique (Web Application Firewall) comme middleware
- Ajouter un honeypot endpoint (`/admin/debug`) qui alerte sur les tentatives
- Scanner l'API avec OWASP ZAP et corriger les findings

## Contraintes
- Aucune requête SQL par concatenation de string
- Tous les endpoints doivent vérifier les permissions
- Les erreurs ne doivent jamais exposer de details internes en production
