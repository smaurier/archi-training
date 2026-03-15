# Cours 60 — Sandboxing & Extension Security

> **Objectif** : Savoir isoler des extensions et plugins tiers via iframes sandboxed, Shadow DOM et postMessage, implémenter un système de confiance par manifest (HMAC challenge-response), définir des guardrails CSS pour le custom styling, et utiliser les feature flags pour controler les capacités.

---

## Rappel du cours précédent

<details>
<summary>1. Pourquoi le sliding window counter est-il préféré au fixed window pour le rate limiting ?</summary>

Le fixed window découpé le temps en tranches fixes (ex: 00:00-01:00). Un attaquant peut envoyer 100 requêtes a 00:59 et 100 autres a 01:00, soit 200 en 2 secondes alors que la limite est 100/min. Le sliding window counter interpole entre la fenêtre courante et la précédente (`total = count_prev * weight + count_current`) — il n'y a jamais plus de N requêtes dans n'importe quelle fenêtre glissante de 60 secondes.
</details>

<details>
<summary>2. Pourquoi ne jamais utiliser `Access-Control-Allow-Origin: *` avec `credentials: true` ?</summary>

Le wildcard `*` signifie "toute origine". Si le navigateur envoie des cookies (`credentials: true`), accepter toute origine permet a n'importe quel site malveillant d'envoyer des requêtes authentifiees au nom de l'utilisateur. Le navigateur refuse cette combinaison — il faut une origine explicite (`https://app.example.com`). C'est une protection contre le CSRF cross-origin.
</details>

---

## Analogie — L'immeuble de bureaux partages

Un CMS qui accepte des plugins tiers, c'est comme un immeuble de bureaux partages (coworking) :

- **L'immeuble** = l'application CMS principale — les murs porteurs ne doivent jamais etre touches
- **Les bureaux individuels** = les iframes sandboxed — chaque plugin a son propre espace isole
- **Les cloisons** = le Shadow DOM — chaque plugin a son propre style qui ne deborde pas
- **L'interphone** = `postMessage` — le seul moyen de communication entre un bureau et l'accueil, avec vérification d'identité
- **Le badge d'accès** = le manifest HMAC — prouve que le plugin est autorise et n'a pas ete modifie
- **Le reglement interieur** = les guardrails CSS — pas de peinture sur les murs porteurs (`!important` sur les tokens), pas de sous-location (`@import`), taille du bureau limitee (15KB)
- **Le tableau electrique** = les feature flags — l'admin peut couper l'electricite d'un bureau (désactiver un plugin) a tout moment

---

## Théorie

### 1. Niveaux d'isolation pour les extensions

```
Niveau d'isolation (du moins au plus isole) :

┌──────────────────────────────────────────────────────┐
│  1. Meme DOM, meme JS context                        │
│     → Plugin React importe directement                │
│     → ZERO isolation (dangereux pour les tiers)       │
├──────────────────────────────────────────────────────┤
│  2. Shadow DOM                                        │
│     → Style isole, meme JS context                    │
│     → Isolation CSS, pas JS                           │
├──────────────────────────────────────────────────────┤
│  3. iframe sandbox                                    │
│     → DOM isole, JS isole, origin separee             │
│     → Communication uniquement via postMessage        │
│     → RECOMMANDE pour les plugins tiers               │
├──────────────────────────────────────────────────────┤
│  4. Web Worker / Service Worker                       │
│     → Pas d'acces au DOM du tout                      │
│     → Pour le compute pur (pas les plugins UI)        │
└──────────────────────────────────────────────────────┘
```

| Isolation | Style | JS | DOM | Communication | Cas d'usage |
|---|---|---|---|---|---|
| Import direct | Non | Non | Non | Props | Plugin 1st-party fiable |
| **Shadow DOM** | **Oui** | Non | Partiel | Events | Widget style-isole |
| **iframe sandbox** | **Oui** | **Oui** | **Oui** | postMessage | **Plugin 3rd-party** |
| Web Worker | N/A | **Oui** | **Oui** | postMessage | Compute headless |

### 2. iframe sandbox — les attributs

```html
<!-- Plugin tiers completement isole -->
<iframe
  src="https://plugin.vendor.com/widget"
  sandbox="allow-scripts allow-same-origin"
  allow="clipboard-write"
  referrerpolicy="no-referrer"
  loading="lazy"
  style="border: none; width: 100%; height: 400px;"
></iframe>
```

| Attribut sandbox | Effet si ABSENT | Quand l'autoriser |
|---|---|---|
| `allow-scripts` | JS désactivé | Presque toujours (sinon le plugin est mort) |
| `allow-same-origin` | Origin opaque | Si le plugin doit accéder a ses propres cookies |
| `allow-forms` | Formulaires bloques | Si le plugin a des formulaires |
| `allow-popups` | Popups bloques | Rarement (OAuth popup) |
| `allow-top-navigation` | Navigation parent bloquee | **JAMAIS** (le plugin ne doit pas rediriger la page) |
| `allow-modals` | alert/confirm bloques | **JAMAIS** (UX disruptive) |

**Regle** : commencer avec `sandbox=""` (tout bloque) puis ajouter uniquement ce qui est nécessaire.

### 3. postMessage — communication sécurisée

```
Application CMS                    iframe Plugin
┌──────────────┐                  ┌──────────────┐
│              │  postMessage     │              │
│  "Voici les  │────────────────>│  Recoit les  │
│  donnees du  │  origin check   │  donnees     │
│  tenant"     │  ←──────────────│              │
│              │  "Voici le      │  "Renvoie    │
│              │   resultat"     │   le widget  │
│              │                  │   rendu"     │
└──────────────┘                  └──────────────┘

SECURITE :
  1. TOUJOURS verifier event.origin
  2. TOUJOURS specifier targetOrigin (pas '*')
  3. JAMAIS eval() sur les donnees recues
  4. Valider le schema des messages
```

### 4. Plugin manifest — HMAC challenge-response

```
Enregistrement du plugin :

  1. Developpeur soumet le manifest :
     { name, version, permissions, entrypoint, checksum }

  2. La plateforme signe le manifest avec HMAC-SHA256 :
     signature = HMAC(secret_platform, JSON.stringify(manifest))

  3. Le manifest signe est stocke :
     { ...manifest, signature }

Chargement du plugin (runtime) :

  1. Charger le manifest depuis la BDD
  2. Recalculer HMAC(secret_platform, manifest_sans_signature)
  3. Comparer avec la signature stockee
  4. Si mismatch → plugin desactive automatiquement
     (le manifest a ete modifie = compromis)

  ┌────────────┐     ┌────────────┐     ┌────────────┐
  │  Manifest   │────>│  HMAC      │────>│  Compare   │
  │  (BDD)      │     │  SHA-256   │     │  signature │
  └────────────┘     └────────────┘     └────────────┘
                                               │
                                          ┌────┴────┐
                                          │ Match?  │
                                          ├─────────┤
                                          │ Oui → ✓ │  Charger le plugin
                                          │ Non → ✗ │  Desactiver + alerter
                                          └─────────┘
```

### 5. CSP-scoped plugin assets

Chaque plugin déclaré ses hosts dans le manifest. La CSP est générée dynamiquement :

```
Plugin manifest :
  {
    "name": "analytics-widget",
    "hosts": ["https://cdn.analytics.com", "https://api.analytics.com"]
  }

CSP generee pour la page contenant le plugin :
  Content-Security-Policy:
    frame-src https://cdn.analytics.com;
    connect-src https://api.analytics.com;

→ Le plugin ne peut charger des ressources que depuis SES hosts
→ Un plugin compromis ne peut pas exfiltrer vers un autre domaine
```

### 6. Custom CSS guardrails

```
Regles pour le CSS custom des tenants :

┌──────────────────────────────────────────────────────────────┐
│  LIMITE DE TAILLE : 15 KB max                                 │
│  (empeche l'injection de payloads CSS volumineux)             │
├──────────────────────────────────────────────────────────────┤
│  PATTERNS INTERDITS :                                         │
│                                                               │
│  !important sur les design tokens                             │
│  → --color-primary: red !important;  ← INTERDIT              │
│  → .my-class { color: red !important; }  ← AUTORISE          │
│                                                               │
│  Selecteur universel                                          │
│  → *{ }  ← INTERDIT (casse tout le layout)                   │
│                                                               │
│  @import                                                      │
│  → @import url(...);  ← INTERDIT (charge du CSS externe)     │
│                                                               │
│  url(http...)                                                 │
│  → background: url(http://evil.com/track.png)  ← INTERDIT    │
│  → background: url(https://cdn.tenant.com/bg.png)  ← OK      │
│    (uniquement HTTPS + domaine whitelist)                      │
│                                                               │
│  SCOPE OBLIGATOIRE : #site-root                               │
│  → Tout le CSS custom est scope sous #site-root               │
│  → Empeche de modifier le back-office ou le shell             │
└──────────────────────────────────────────────────────────────┘
```

### 7. Feature flags pour les capacités

```
┌──────────────────────────────────────────────────────┐
│  Feature flags par plugin                             │
│                                                       │
│  Plugin: "social-share"                               │
│  ┌──────────────────┬──────────┬──────────────────┐  │
│  │ Capability        │ Enabled  │ Scope            │  │
│  ├──────────────────┼──────────┼──────────────────┤  │
│  │ dom.read          │ true     │ #plugin-zone     │  │
│  │ dom.write         │ true     │ #plugin-zone     │  │
│  │ network.fetch     │ true     │ api.social.com   │  │
│  │ storage.local     │ false    │ ---              │  │
│  │ navigation.top    │ false    │ ---              │  │
│  │ clipboard.write   │ false    │ ---              │  │
│  └──────────────────┴──────────┴──────────────────┘  │
│                                                       │
│  Si le plugin tente une action non autorisee :        │
│  → L'action est bloquee silencieusement               │
│  → Un event est logue pour audit                       │
│  → Apres 10 violations → plugin desactive              │
└──────────────────────────────────────────────────────┘
```

---

## Pratique

### Communication postMessage avec strict origin checks

```typescript
// src/plugins/plugin-bridge.ts — cote application CMS

interface PluginMessage {
  type: 'plugin:request' | 'plugin:response' | 'plugin:event';
  pluginId: string;
  action: string;
  payload: unknown;
  requestId: string;
}

class PluginBridge {
  private allowedOrigins: Map<string, string> = new Map();
  private pendingRequests: Map<string, (data: unknown) => void> = new Map();

  constructor() {
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  /** Enregistrer un plugin avec son origin autorisee */
  registerPlugin(pluginId: string, origin: string): void {
    this.allowedOrigins.set(pluginId, origin);
  }

  /** Envoyer des donnees au plugin */
  sendToPlugin(
    pluginId: string,
    iframe: HTMLIFrameElement,
    action: string,
    payload: unknown,
  ): void {
    const origin = this.allowedOrigins.get(pluginId);
    if (!origin) throw new Error(`Plugin ${pluginId} not registered`);

    const message: PluginMessage = {
      type: 'plugin:request',
      pluginId,
      action,
      payload,
      requestId: crypto.randomUUID(),
    };

    // TOUJOURS specifier targetOrigin (jamais '*')
    iframe.contentWindow?.postMessage(message, origin);
  }

  private handleMessage(event: MessageEvent): void {
    // 1. VERIFIER L'ORIGIN — premiere ligne de defense
    const pluginId = this.findPluginByOrigin(event.origin);
    if (!pluginId) {
      console.warn(`[PluginBridge] Blocked message from unknown origin: ${event.origin}`);
      return;
    }

    // 2. VALIDER LE SCHEMA du message
    const message = event.data as PluginMessage;
    if (!message?.type || !message?.action || !message?.requestId) {
      console.warn(`[PluginBridge] Invalid message schema from ${pluginId}`);
      return;
    }

    // 3. TRAITER selon le type
    if (message.type === 'plugin:response') {
      const resolve = this.pendingRequests.get(message.requestId);
      if (resolve) {
        resolve(message.payload);
        this.pendingRequests.delete(message.requestId);
      }
    }

    if (message.type === 'plugin:event') {
      // Emettre un custom event pour que l'app react puisse ecouter
      window.dispatchEvent(
        new CustomEvent(`plugin:${pluginId}:${message.action}`, {
          detail: message.payload,
        }),
      );
    }
  }

  private findPluginByOrigin(origin: string): string | undefined {
    for (const [id, allowedOrigin] of this.allowedOrigins) {
      if (allowedOrigin === origin) return id;
    }
    return undefined;
  }
}

export const pluginBridge = new PluginBridge();
```

### HMAC challenge-response — vérification du manifest (NestJS)

```typescript
// src/plugins/plugin-manifest.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

interface PluginManifest {
  name: string;
  version: string;
  entrypoint: string;
  permissions: string[];
  hosts: string[];
  checksum: string;   // SHA-256 du code du plugin
  signature?: string; // HMAC de la plateforme
}

@Injectable()
export class PluginManifestService {
  private readonly secret = process.env.PLUGIN_HMAC_SECRET!;

  /** Signer un manifest lors de l'enregistrement */
  sign(manifest: Omit<PluginManifest, 'signature'>): PluginManifest {
    const payload = JSON.stringify(manifest);
    const signature = createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');

    return { ...manifest, signature };
  }

  /** Verifier l'integrite du manifest au chargement */
  verify(manifest: PluginManifest): boolean {
    const { signature, ...rest } = manifest;
    if (!signature) return false;

    const expected = createHmac('sha256', this.secret)
      .update(JSON.stringify(rest))
      .digest('hex');

    // Comparaison en temps constant (anti-timing attack)
    const a = Buffer.from(signature, 'hex');
    const b = Buffer.from(expected, 'hex');

    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /** Charger un plugin — verifier avant d'activer */
  async loadPlugin(manifest: PluginManifest): Promise<void> {
    if (!this.verify(manifest)) {
      // Auto-disable : le manifest a ete modifie
      throw new ForbiddenException(
        `Plugin ${manifest.name} signature mismatch — auto-disabled`,
      );
    }

    // Manifest valide → generer la CSP pour ce plugin
    // et charger l'iframe
  }
}
```

### Validateur CSS guardrails

```typescript
// src/themes/css-validator.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';

interface CssValidationResult {
  valid: boolean;
  errors: string[];
}

@Injectable()
export class CssValidatorService {
  private readonly MAX_SIZE_BYTES = 15 * 1024; // 15 KB

  private readonly FORBIDDEN_PATTERNS: Array<{
    regex: RegExp;
    message: string;
  }> = [
    {
      regex: /--[\w-]+\s*:.*!important/gi,
      message: '!important on design tokens is forbidden',
    },
    {
      regex: /(?:^|\s)\*\s*\{/gm,
      message: 'Universal selector *{} is forbidden',
    },
    {
      regex: /@import\s/gi,
      message: '@import is forbidden (use inline styles only)',
    },
    {
      regex: /url\s*\(\s*['"]?http:/gi,
      message: 'url(http...) is forbidden (HTTPS only)',
    },
    {
      regex: /expression\s*\(/gi,
      message: 'CSS expressions are forbidden',
    },
    {
      regex: /-moz-binding/gi,
      message: '-moz-binding is forbidden',
    },
    {
      regex: /behavior\s*:/gi,
      message: 'behavior: is forbidden (IE HTC)',
    },
  ];

  validate(css: string): CssValidationResult {
    const errors: string[] = [];

    // 1. Verifier la taille
    const sizeBytes = new TextEncoder().encode(css).length;
    if (sizeBytes > this.MAX_SIZE_BYTES) {
      errors.push(
        `CSS exceeds size limit: ${sizeBytes} bytes > ${this.MAX_SIZE_BYTES} bytes (15KB)`,
      );
    }

    // 2. Verifier les patterns interdits
    for (const { regex, message } of this.FORBIDDEN_PATTERNS) {
      if (regex.test(css)) {
        errors.push(message);
      }
      regex.lastIndex = 0; // Reset le regex global
    }

    // 3. Verifier le scope #site-root
    const rules = css.match(/[^{}]+\{/g) || [];
    for (const rule of rules) {
      const selector = rule.replace('{', '').trim();
      if (selector.startsWith('@')) continue; // @media, @keyframes OK
      if (!selector.startsWith('#site-root')) {
        errors.push(
          `Selector "${selector}" must be scoped under #site-root`,
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  validateOrThrow(css: string): void {
    const result = this.validate(css);
    if (!result.valid) {
      throw new BadRequestException({
        error: 'css_validation_failed',
        details: result.errors,
      });
    }
  }
}
```

### Feature flags — activer/désactiver des capacités par plugin

```typescript
// src/plugins/plugin-capabilities.service.ts
import { Injectable } from '@nestjs/common';

type Capability =
  | 'dom.read'
  | 'dom.write'
  | 'network.fetch'
  | 'storage.local'
  | 'navigation.top'
  | 'clipboard.write';

interface PluginCapabilities {
  pluginId: string;
  capabilities: Map<Capability, { enabled: boolean; scope?: string }>;
  violationCount: number;
}

@Injectable()
export class PluginCapabilitiesService {
  private plugins: Map<string, PluginCapabilities> = new Map();
  private readonly MAX_VIOLATIONS = 10;

  /** Verifier si une capacite est autorisee */
  isAllowed(pluginId: string, capability: Capability): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    const cap = plugin.capabilities.get(capability);
    if (!cap?.enabled) {
      this.recordViolation(pluginId, capability);
      return false;
    }

    return true;
  }

  /** Enregistrer une violation */
  private recordViolation(pluginId: string, capability: Capability): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    plugin.violationCount++;
    console.warn(
      `[Plugin:${pluginId}] Unauthorized capability: ${capability} ` +
      `(violation ${plugin.violationCount}/${this.MAX_VIOLATIONS})`,
    );

    // Auto-disable apres trop de violations
    if (plugin.violationCount >= this.MAX_VIOLATIONS) {
      this.disablePlugin(pluginId);
    }
  }

  /** Desactiver un plugin (trop de violations) */
  private disablePlugin(pluginId: string): void {
    console.error(`[Plugin:${pluginId}] Auto-disabled after ${this.MAX_VIOLATIONS} violations`);
    // Supprimer l'iframe, notifier l'admin, logger l'evenement
    this.plugins.delete(pluginId);
  }
}
```

---

## Résumé

1. **iframe sandbox** : isolation totale (DOM, JS, styles) pour les plugins tiers — commencer avec `sandbox=""` puis ajouter uniquement les permissions nécessaires, jamais `allow-top-navigation`
2. **postMessage** : seul canal de communication entre l'app et le plugin isole — toujours vérifier `event.origin`, toujours spécifier `targetOrigin` (jamais `*`), valider le schema de chaque message
3. **HMAC challenge-response** : signer les manifests de plugins avec HMAC-SHA256 côté plateforme — au chargement, recalculer et comparer en temps constant, auto-disable si mismatch
4. **CSS guardrails** : 15KB max, interdire `!important` sur les tokens, `*{}`, `@import`, `url(http...)`, et forcer le scope `#site-root` — chaque règle previent un vecteur d'attaque ou de casse CSS
5. **Feature flags** : chaque plugin déclaré ses capacités, le système vérifié à chaque action, auto-disable après 10 violations — defense en profondeur par limitation de surface

---

> **Prochain cours** : [Cours 61 — Privacy by Design & GDPR](./06-privacy-by-design.md) — ou comment architecturer une application conforme au RGPD avec Privacy by Design, gestion du consentement, analytics sans PII et conformite EU AI Act.

---

> **Lien fil rouge — ShopArch**
>
> - Définis les guardrails CSS pour le Custom CSS ShopArch (15KB limit, patterns interdits)
> - Implémente le sandbox iframe pour les widgets tiers du back-office
> - Exercice(s) associé(s) : `exercices/40-audit-securite/`
> - Checkpoint : Module 08, critère 1
