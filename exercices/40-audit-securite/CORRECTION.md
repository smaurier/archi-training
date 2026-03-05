# Correction — Exercice 40 : Audit de sécurité

## Audit des dépendances

```bash
# Audit npm
npm audit --json | jq '.vulnerabilities | to_entries | sort_by(.value.severity) | reverse'

# Audit CI (bloque sur critical)
npx audit-ci --critical --report-type full

# Generer un SBOM
npx @cyclonedx/cyclonedx-npm --output-file sbom.json
```

### Exemple de rapport CVE

| CVE | Package | Severite | Impact | Remediation | Effort |
|---|---|---|---|---|---|
| CVE-2024-XXXX | lodash@4.17.20 | Critical | RCE via prototype pollution | `npm update lodash` | Facile |
| CVE-2024-YYYY | express@4.18.0 | High | ReDoS sur certains headers | `npm update express` | Facile |
| CVE-2024-ZZZZ | jsonwebtoken@8.5.1 | High | JWT algorithm confusion | `npm update jsonwebtoken` | Moyen |

## Audit de configuration

```bash
# Scan secrets dans le repo
gitleaks detect --source . --report-format json --report-path gitleaks-report.json

# Patterns recherches
# - API keys : /[A-Za-z0-9]{32,}/
# - AWS keys : /AKIA[0-9A-Z]{16}/
# - JWT secrets : /jwt[_-]?secret/i
# - Database URLs : /postgres:\/\/[^@]+@/
```

```typescript
// Checklist configuration
const securityConfig = {
  cookies: {
    httpOnly: true,    // ✅ pas accessible via JS
    secure: true,      // ✅ HTTPS only
    sameSite: 'strict', // ✅ pas envoye cross-origin
  },
  cors: {
    origin: ['https://shop.example.com'], // ✅ pas de wildcard
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  },
  tls: {
    minVersion: 'TLSv1.2', // ✅ pas de TLS 1.0/1.1
    cipherSuites: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256',
  },
};
```

## Audit du code — patterns a chercher

```typescript
// grep-audit.sh — recherche automatisee des patterns dangereux

// SQL Injection
// Recherche : template literals avec des variables dans des requetes SQL
// Pattern : query(`SELECT ... ${variable}`)
// Grep : /\.query\(`[^`]*\$\{/

// XSS
// Recherche : insertion directe de HTML non sanitise
// Pattern : innerHTML, v-html, dangerouslySetInnerHTML
// Grep : /innerHTML|v-html|dangerouslySetInnerHTML/

// Secrets hardcodes
// Recherche : cles, mots de passe, tokens dans le code
// Pattern : password = "...", secret = "...", apiKey = "..."
// Grep : /(password|secret|apiKey|api_key|token)\s*[:=]\s*['"][^'"]+['"]/i

// PII dans les logs
// Recherche : log de donnees sensibles
// Pattern : console.log(user.email), logger.info(creditCard)
// Grep : /console\.(log|info|warn|error)\(.*\b(email|password|card|ssn|token)\b/
```

## Rapport d'audit

```markdown
# Rapport d'audit securite — ShopArch
Date : 2026-03-04

## Executive Summary
L'audit a revele 3 findings critiques, 5 findings high, et 8 findings medium.
Les critiques concernent une SQL injection dans la recherche, des secrets
exposes dans le repo git, et une absence de rate limiting sur l'endpoint login.
Remediation estimee : 2 semaines de travail.

## Findings

### CRITICAL — SQL Injection dans la recherche (SEC-001)
- **Description** : Le parametre `q` est concatene directement dans la requete SQL
- **Preuve** : `src/search/search.service.ts:42` — `query(\`SELECT * FROM products WHERE name LIKE '%${q}%'\`)`
- **Impact** : Lecture/modification/suppression de toutes les donnees en base
- **Remediation** : Utiliser une requete parametree (`$1`)
- **Effort** : Facile (30 min)
- **Priorite** : P0 — corriger AVANT la mise en production

### CRITICAL — Secrets dans le repo git (SEC-002)
- **Description** : La cle API Stripe et le JWT secret sont commits dans `.env.example`
- **Preuve** : `git log --all -p -- .env*` revele les secrets en clair
- **Impact** : Acces au compte Stripe + forge de JWT
- **Remediation** : Rotation immediate des cles + git filter-branch pour purger l'historique
- **Effort** : Moyen (rotation + purge historique)
- **Priorite** : P0

### CRITICAL — Pas de rate limiting sur /auth/login (SEC-003)
- **Description** : L'endpoint login accepte un nombre illimite de tentatives
- **Impact** : Brute force des mots de passe
- **Remediation** : Rate limiter (5 tentatives/5min par IP + compte)
- **Effort** : Facile (1h)
- **Priorite** : P0

### HIGH — IDOR sur GET /orders/:id (SEC-004)
- **Description** : Pas de verification du proprietaire de la commande
- **Preuve** : `curl -H "Authorization: Bearer userA_token" /orders/userB_order_id` → 200
- **Impact** : Lecture des commandes d'autres utilisateurs
- **Remediation** : Ajouter `where: { userId: currentUser.id }` dans la query
- **Effort** : Facile (15 min par endpoint)

### HIGH — CORS wildcard en staging (SEC-005)
- **Description** : `origin: '*'` en configuration staging
- **Preuve** : `curl -H "Origin: https://evil.com" -I /api/products` → `Access-Control-Allow-Origin: *`
- **Impact** : Attaque CSRF depuis n'importe quel domaine
- **Remediation** : Whitelist explicite des origines autorisees
- **Effort** : Facile (15 min)

## Tableau de synthese

| Severity | Count | Deadline |
|---|---|---|
| Critical | 3 | Avant mise en production |
| High | 5 | Semaine 1 |
| Medium | 8 | Semaine 2-3 |
| Low | 4 | Backlog |
```

## Pipeline CI/CD sécurité

```yaml
# .github/workflows/security.yml
name: Security Checks
on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # pour gitleaks

      - name: npm audit
        run: npx audit-ci --critical

      - name: Gitleaks
        uses: gitleaks/gitleaks-action@v2

      - name: CodeQL
        uses: github/codeql-action/analyze@v3
        with:
          languages: javascript-typescript
```

## Ce que tu aurais pu oublier

### 1. Audit superficiel
```
FAUX — "npm audit montre 0 critiques, c'est bon"
CORRECT — npm audit ne couvre que les CVE connues
         Il faut aussi scanner le code, la config, les secrets, et l'infra
```

### 2. Finding sans preuve
```
FAUX — "il pourrait y avoir une SQL injection quelque part"
CORRECT — preuve concrete : fichier, ligne, payload de test
         Sans preuve, le finding sera ignore
```

### 3. Oublier l'historique git
```
FAUX — supprimer le secret du fichier (il reste dans l'historique git)
CORRECT — purger l'historique + rotation immediate des credentials
```

### 4. Rapport technique uniquement
```
FAUX — rapport detaille que seuls les devs comprennent
CORRECT — executive summary pour le management + details techniques pour les devs
         Le management decide du budget, il doit comprendre le risque
```
