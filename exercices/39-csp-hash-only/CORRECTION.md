# Correction — Exercice 39 : CSP hash-only

## Calcul des hashes

```typescript
// csp-hash.ts
import { createHash } from 'node:crypto';

function computeCSPHash(scriptContent: string): string {
  const hash = createHash('sha256').update(scriptContent).digest('base64');
  return `'sha256-${hash}'`;
}

// Scripts inline a autoriser
const CONFIG_SCRIPT = `window.__CONFIG__ = { apiUrl: "https://api.shoparch.com", cdn: "https://cdn.shoparch.com" };`;
const configHash = computeCSPHash(CONFIG_SCRIPT);
// → 'sha256-abc123...'

console.log(`script-src 'self' ${configHash};`);
```

## Migration des scripts inline

```html
<!-- ❌ AVANT — inline event handler (bloque par CSP) -->
<button onclick="addToCart(123)">Ajouter</button>

<!-- ✅ APRES — event listener en fichier externe -->
<button data-product-id="123" class="js-add-to-cart">Ajouter</button>
<script src="/js/cart.js"></script>

<!-- cart.js -->
<!-- document.querySelectorAll('.js-add-to-cart').forEach(btn => {
  btn.addEventListener('click', () => addToCart(btn.dataset.productId));
}); -->
```

```html
<!-- ❌ AVANT — style inline -->
<div style="color: red; font-weight: bold;">Rupture de stock</div>

<!-- ✅ APRES — classe CSS -->
<div class="stock-alert stock-alert--out">Rupture de stock</div>
```

## CSP complete

```typescript
// csp.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class CSPMiddleware implements NestMiddleware {
  private readonly configHash = computeCSPHash(
    'window.__CONFIG__ = { apiUrl: "https://api.shoparch.com", cdn: "https://cdn.shoparch.com" };',
  );

  private readonly policy = [
    "default-src 'self'",
    `script-src 'self' ${this.configHash}`,
    "style-src 'self'",
    "img-src 'self' data: https://cdn.shoparch.com",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://api.shoparch.com",
    "media-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "upgrade-insecure-requests",
  ].join('; ');

  use(req: Request, res: Response, next: NextFunction) {
    // Report-Only d'abord (phase de test)
    if (process.env.CSP_ENFORCE === 'true') {
      res.setHeader('Content-Security-Policy', this.policy);
    } else {
      res.setHeader(
        'Content-Security-Policy-Report-Only',
        `${this.policy}; report-uri /csp-report`,
      );
    }
    next();
  }
}
```

## Endpoint de reporting

```typescript
// csp-report.controller.ts
@Controller('csp-report')
export class CSPReportController {
  @Post()
  @HttpCode(204)
  async receiveReport(@Body() report: CSPViolationReport) {
    // Logger la violation (pas en DB pour eviter le flood)
    console.warn('[CSP Violation]', {
      blockedUri: report['csp-report']?.['blocked-uri'],
      violatedDirective: report['csp-report']?.['violated-directive'],
      documentUri: report['csp-report']?.['document-uri'],
      sourceFile: report['csp-report']?.['source-file'],
      lineNumber: report['csp-report']?.['line-number'],
    });

    // Envoyer vers un service de monitoring (Sentry, etc.)
    // Limiter le volume : 1 report par type par minute max
  }
}

interface CSPViolationReport {
  'csp-report': {
    'blocked-uri': string;
    'violated-directive': string;
    'document-uri': string;
    'source-file'?: string;
    'line-number'?: number;
    'original-policy': string;
  };
}
```

## Nonce-based alternative (bonus)

```typescript
// nonce-csp.middleware.ts — genere un nonce unique par requete
@Injectable()
export class NonceCSPMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const nonce = randomBytes(16).toString('base64');
    res.locals.cspNonce = nonce;

    const policy = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src 'self'",
      // ...
    ].join('; ');

    res.setHeader('Content-Security-Policy', policy);
    next();
  }
}

// Dans le template HTML
// <script nonce="<%= cspNonce %>">
//   window.__CONFIG__ = { ... };
// </script>
```

## Comparaison Hash vs Nonce

| Critère | Hash-based | Nonce-based |
|---|---|---|
| SSR requis | Non (statique) | Oui (généré par requête) |
| CDN-friendly | Oui (HTML cacheable) | Non (nonce unique = pas cacheable) |
| Maintenance | Recalculer si le script change | Transparent |
| Sécurité | Identique | Identique |
| Ideal pour | SPA avec scripts inline fixes | SSR avec scripts dynamiques |

## Ce que tu aurais pu oublier

### 1. unsafe-inline "juste pour les styles"
```
FAUX — style-src 'self' 'unsafe-inline' (autorise l'injection CSS)
CORRECT — migrer tous les styles inline en classes CSS
         L'injection CSS peut leaker des donnees (exfiltration via background-image)
```

### 2. Déployer en enforce directement
```
FAUX — activer la CSP stricte en production sans tester
CORRECT — Report-Only pendant 1+ semaine, corriger toutes les violations, puis enforce
```

### 3. Oublier base-uri
```
FAUX — pas de directive base-uri (l'attaquant peut injecter <base href="https://evil.com">)
CORRECT — base-uri 'self' empeche le changement de base URL
```

### 4. Hash qui change
```
FAUX — le hash ne match plus apres un espace/retour a la ligne modifie
CORRECT — le hash est calcule sur le contenu EXACT (whitespace inclus)
         Automatiser le calcul dans le build pipeline
```
