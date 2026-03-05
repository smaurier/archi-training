# Correction — Exercice 41 : Implémenter une CMP

## Hook de consentement

```typescript
// hooks/useConsent.ts
import { useState, useEffect, useCallback } from 'react';

interface ConsentPreferences {
  necessary: true; // toujours true
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: number;
}

const CONSENT_COOKIE = 'shoparch_consent';
const CONSENT_VERSION = 2;
const MAX_AGE = 13 * 30 * 24 * 3600; // 13 mois en secondes

function readConsent(): ConsentPreferences | null {
  if (typeof document === 'undefined') return null;
  const cookie = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  if (!cookie) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(cookie.split('=')[1]));
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function useConsent() {
  const [preferences, setPreferences] = useState<ConsentPreferences | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  // Initialisation
  useEffect(() => {
    const existing = readConsent();
    if (existing) {
      setPreferences(existing);
      applyConsent(existing);
    } else {
      setShowBanner(true);
    }
  }, []);

  const saveConsent = useCallback(
    (prefs: { analytics: boolean; marketing: boolean }) => {
      const consent: ConsentPreferences = {
        necessary: true,
        analytics: prefs.analytics,
        marketing: prefs.marketing,
        timestamp: new Date().toISOString(),
        version: CONSENT_VERSION,
      };

      // Cookie first-party
      document.cookie = [
        `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(consent))}`,
        `max-age=${MAX_AGE}`,
        'path=/',
        'SameSite=Lax',
        location.protocol === 'https:' ? 'Secure' : '',
      ].filter(Boolean).join('; ');

      setPreferences(consent);
      setShowBanner(false);

      // Preuve cote serveur
      sendConsentProof(consent);

      // Charger/decharger les scripts
      applyConsent(consent);
    },
    [],
  );

  const acceptAll = useCallback(() => {
    saveConsent({ analytics: true, marketing: true });
  }, [saveConsent]);

  const rejectAll = useCallback(() => {
    saveConsent({ analytics: false, marketing: false });
  }, [saveConsent]);

  return { preferences, showBanner, setShowBanner, saveConsent, acceptAll, rejectAll };
}
```

## Script gating

```typescript
// lib/consent-scripts.ts
const SCRIPT_REGISTRY: Record<string, { src: string; category: string }[]> = {
  analytics: [
    { src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX', category: 'analytics' },
  ],
  marketing: [
    { src: 'https://connect.facebook.net/en_US/fbevents.js', category: 'marketing' },
  ],
};

export function applyConsent(consent: ConsentPreferences) {
  for (const [category, scripts] of Object.entries(SCRIPT_REGISTRY)) {
    const allowed = consent[category as keyof ConsentPreferences];

    if (allowed) {
      for (const script of scripts) {
        if (!document.querySelector(`script[src="${script.src}"]`)) {
          const el = document.createElement('script');
          el.src = script.src;
          el.async = true;
          document.head.appendChild(el);
        }
      }
    } else {
      for (const script of scripts) {
        const el = document.querySelector(`script[src="${script.src}"]`);
        if (el) el.remove();
      }
      cleanCookies(category);
    }
  }

  // Google Consent Mode v2
  if (typeof gtag !== 'undefined') {
    gtag('consent', 'update', {
      analytics_storage: consent.analytics ? 'granted' : 'denied',
      ad_storage: consent.marketing ? 'granted' : 'denied',
      ad_user_data: consent.marketing ? 'granted' : 'denied',
      ad_personalization: consent.marketing ? 'granted' : 'denied',
    });
  }
}

function cleanCookies(category: string) {
  const cookiesToClean: Record<string, string[]> = {
    analytics: ['_ga', '_ga_*', '_gid'],
    marketing: ['_fbp', '_fbc'],
  };

  for (const name of cookiesToClean[category] ?? []) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}
```

## Banniere accessible

```tsx
// components/ConsentBanner.tsx
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useConsent } from '../hooks/useConsent';

export function ConsentBanner() {
  const { showBanner, acceptAll, rejectAll, saveConsent } = useConsent();
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Focus trap
  useEffect(() => {
    if (showBanner) bannerRef.current?.focus();
  }, [showBanner]);

  if (!showBanner) return null;

  function saveCustom() {
    saveConsent({ analytics, marketing });
  }

  return createPortal(
    <div
      ref={bannerRef}
      role="dialog"
      aria-label="Gestion des cookies"
      aria-modal="true"
      tabIndex={-1}
      className="consent-banner"
      onKeyDown={(e) => e.key === 'Escape' && rejectAll()}
    >
      <div className="consent-banner__content">
        <h2 id="consent-title">Nous utilisons des cookies</h2>
        <p>
          Nous utilisons des cookies pour ameliorer votre experience,
          analyser le trafic et personnaliser le contenu.
        </p>

        {showDetails && (
          <div className="consent-banner__details">
            <label className="consent-category">
              <input type="checkbox" checked disabled />
              <strong>Necessaires</strong> — Toujours actifs (session, panier, securite)
            </label>

            <label className="consent-category">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
              />
              <strong>Analytique</strong> — Mesure d'audience anonyme (Google Analytics)
            </label>

            <label className="consent-category">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
              />
              <strong>Marketing</strong> — Publicite ciblee (Facebook Pixel)
            </label>
          </div>
        )}

        <div className="consent-banner__actions">
          <button onClick={rejectAll} className="btn btn--secondary">
            Tout refuser
          </button>
          {!showDetails && (
            <button onClick={() => setShowDetails(true)} className="btn btn--secondary">
              Personnaliser
            </button>
          )}
          {showDetails && (
            <button onClick={saveCustom} className="btn btn--primary">
              Sauvegarder
            </button>
          )}
          <button onClick={acceptAll} className="btn btn--primary">
            Tout accepter
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

## Preuve de consentement côté serveur

```typescript
// lib/consent-proof.ts — client
async function sendConsentProof(consent: ConsentPreferences) {
  await fetch('/api/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      categories: {
        analytics: consent.analytics,
        marketing: consent.marketing,
      },
      timestamp: consent.timestamp,
      version: consent.version,
      source: 'banner',
      userAgent: navigator.userAgent,
    }),
  });
}

// consent.entity.ts — serveur (NestJS)
@Entity('consent_proofs')
export class ConsentProof {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string; // si connecte

  @Column()
  sessionId: string; // si anonyme

  @Column('jsonb')
  categories: { analytics: boolean; marketing: boolean };

  @Column()
  policyVersion: number;

  @Column()
  source: string; // 'banner', 'footer_link', 'api'

  @Column()
  userAgent: string;

  @CreateDateColumn()
  consentedAt: Date;

  @Column()
  tenantId: string;
}
```

## Ce que tu aurais pu oublier

### 1. Scripts charges avant le consentement
```
FAUX — charger GTM/analytics dans le <head> et les desactiver apres refus
CORRECT — ne JAMAIS charger les scripts non-necessaires avant le consentement explicite
         Meme Google Consent Mode doit etre initialise en 'denied' par defaut
```

### 2. Refuser plus difficile qu'accepter
```
FAUX — "Tout accepter" en gros bouton, "Refuser" cache dans les parametres
CORRECT — "Tout refuser" et "Tout accepter" au meme niveau visuel
         La CNIL sanctionne les dark patterns
```

### 3. Pas de preuve de consentement
```
FAUX — le consentement est stocke uniquement dans un cookie client
CORRECT — preuve cote serveur avec qui/quand/quoi/comment
         En cas d'audit RGPD, tu dois prouver le consentement
```

### 4. Cookie > 13 mois
```
FAUX — cookie de consentement qui expire jamais
CORRECT — max 13 mois (RGPD), puis re-demander le consentement
         Versionner la politique pour re-demander si elle change
```
