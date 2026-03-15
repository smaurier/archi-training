# Exercice 40 — Audit de sécurité

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h | **Ère** : 6 — La Défense
>
> **Prérequis** : Module 08 (cours 1-5)


## Objectif

Realiser un audit de sécurité complet de ShopArch en utilisant des outils automatises et manuels, puis rediger un rapport avec les findings et remediations.

## Contexte

ShopArch va entrer en production. Avant le lancement, un audit de sécurité est requis. Tu dois vérifier les dépendances, la configuration, le code, et l'infrastructure.

## Temps estime

1h

## Instructions

### Étape 1 — Audit des dépendances
Scanne les dépendances avec :
- `npm audit` pour les vulnérabilités connues
- `npx audit-ci --critical` pour bloquer le CI sur les critiques
- Trie les CVE par sévérité (Critical, High, Medium, Low)
- Pour chaque CVE critique : impact + remediation (update ou patch)

### Étape 2 — Audit de configuration
Verifie les configurations de sécurité :
- Pas de secrets dans le code source (scan avec `trufflehog` ou `gitleaks`)
- Variables d'environnement correctement documentees
- Cookies sécurisés (HttpOnly, Secure, SameSite)
- CORS correctement configure (pas de wildcard *)
- TLS 1.2+ uniquement

### Étape 3 — Audit du code
Review manuelle du code pour :
- SQL injection (recherche de concatenation SQL)
- XSS (recherche de `innerHTML`, `dangerouslySetInnerHTML`, `v-html`)
- Secrets hardcodes (regex sur les patterns de clés API)
- Logs qui contiennent des données sensibles (PII, tokens)

### Étape 4 — Rapport d'audit
Redige un rapport structure :
- Executive summary (2-3 phrases)
- Findings classes par sévérité
- Pour chaque finding : description, preuve, impact, remediation, effort
- Tableau de synthese avec timeline de correction

### Bonus
- Scanner avec OWASP ZAP (DAST)
- Ajouter les checks de sécurité au pipeline CI/CD
- Implémenter un SBOM (Software Bill of Materials)

## Contraintes
- Chaque finding doit avoir une preuve (pas juste "possible SQL injection")
- Les remediations doivent inclure l'effort estime (facile/moyen/difficile)
- Le rapport doit etre comprehensible par un non-technique (exec summary)
