# Correction — Exercice 37 : Threat model STRIDE

## Data Flow Diagram

```
                    ┌─────────────────┐
                    │   Trust Boundary │
┌──────────┐       │  ┌────────────┐  │       ┌─────────────┐
│ Browser  │──HTTPS──▶│    BFF     │──────────▶│ PostgreSQL  │
│ (Client) │       │  └─────┬──────┘  │       └─────────────┘
└──────────┘       │        │         │
                   │        ▼         │       ┌─────────────┐
                   │  ┌────────────┐  │       │   Redis     │
                   │  │  Order     │──────────▶│  (sessions) │
                   │  │  Service   │  │       └─────────────┘
                   │  └─────┬──────┘  │
                   │        │         │
                   │        ▼         │
                   │  ┌────────────┐  │       ┌─────────────┐
                   │  │  Payment   │──────────▶│  Stripe     │
                   │  │  Gateway   │  │       │  (externe)  │
                   │  └────────────┘  │       └─────────────┘
                   └─────────────────┘
```

Trust boundaries :
1. **Browser ↔ BFF** : frontiere internet/DMZ (HTTPS)
2. **BFF ↔ Services** : frontiere DMZ/réseau interne
3. **Services ↔ Stripe** : frontiere interne/externe

## Menaces STRIDE

### Spoofing (Usurpation d'identité)
| # | Menace | Cible | Prob | Impact | Score |
|---|---|---|---|---|---|
| S1 | JWT vole via XSS | Browser→BFF | 3 | 5 | 15 |
| S2 | Usurpation tenant ID | BFF→OrderService | 2 | 5 | 10 |
| S3 | Session hijacking (Redis) | Redis sessions | 2 | 4 | 8 |

### Tampering (Modification de données)
| # | Menace | Cible | Prob | Impact | Score |
|---|---|---|---|---|---|
| T1 | Modifier le prix dans la requête | Browser→BFF | 4 | 5 | 20 |
| T2 | SQL injection sur recherche | BFF→PostgreSQL | 2 | 5 | 10 |
| T3 | Modifier l'adresse de livraison apres paiement | OrderService | 2 | 3 | 6 |

### Repudiation (Nier une action)
| # | Menace | Cible | Prob | Impact | Score |
|---|---|---|---|---|---|
| R1 | Client nie avoir passe une commande | OrderService | 3 | 3 | 9 |
| R2 | Admin modifie un prix sans trace | Back-office | 3 | 4 | 12 |

### Information Disclosure (Fuite de données)
| # | Menace | Cible | Prob | Impact | Score |
|---|---|---|---|---|---|
| I1 | IDOR — accéder aux commandes d'un autre tenant | API | 3 | 5 | 15 |
| I2 | Stack trace expose en production | BFF | 4 | 2 | 8 |
| I3 | Données PCI dans les logs | Payment Gateway | 2 | 5 | 10 |
| I4 | Enumeration des ID sequentiels | API | 3 | 3 | 9 |

### Denial of Service
| # | Menace | Cible | Prob | Impact | Score |
|---|---|---|---|---|---|
| D1 | Flood sur l'API checkout | BFF | 4 | 4 | 16 |
| D2 | Requête de recherche couteuse (ReDoS) | Elasticsearch | 3 | 3 | 9 |
| D3 | Epuisement des connexions DB | PostgreSQL | 2 | 5 | 10 |

### Elevation of Privilege
| # | Menace | Cible | Prob | Impact | Score |
|---|---|---|---|---|---|
| E1 | Viewer accede aux endpoints admin | BFF | 3 | 5 | 15 |
| E2 | Escalade tenant (accéder aux données d'un autre tenant) | API | 2 | 5 | 10 |

## Matrice de risques priorisee

| Priorite | Menaces | Score |
|---|---|---|
| **HIGH** (>12) | T1 (20), D1 (16), S1 (15), I1 (15), E1 (15) | |
| **MEDIUM** (8-12) | S2 (10), T2 (10), I3 (10), D3 (10), E2 (10), R2 (12) | |
| **LOW** (<8) | S3 (8), T3 (6), R1 (9), I2 (8), I4 (9), D2 (9) | |

## Mitigations

```typescript
// T1 — Mitigation : ne JAMAIS faire confiance au prix du client
// FAUX
async checkout(req: { items: Array<{ productId: string; price: number }> }) {
  // Utilise le prix envoye par le client ❌
  const total = req.items.reduce((sum, i) => sum + i.price, 0);
}

// CORRECT
async checkout(req: { items: Array<{ productId: string; quantity: number }> }) {
  // Recalculer le prix depuis la DB
  const total = await this.calculateTotalFromDB(req.items);
}
```

```typescript
// S1 — Mitigation : JWT short-lived + refresh token HttpOnly
// Cookies HttpOnly + Secure + SameSite=Strict
res.cookie('access_token', jwt, {
  httpOnly: true,  // pas accessible via JS (XSS)
  secure: true,    // HTTPS only
  sameSite: 'strict', // pas envoye cross-origin
  maxAge: 15 * 60 * 1000, // 15 min
});
```

```typescript
// I1 — Mitigation : tenant isolation systemique
// Middleware qui injecte automatiquement le tenant_id
@Injectable()
export class TenantIsolationMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'];
    // TOUTES les queries sont automatiquement filtrees par tenant
    req.queryRunner = this.dataSource.createQueryRunner();
    req.queryRunner.query(`SET app.current_tenant = '${tenantId}'`);
    // Row-Level Security en PostgreSQL fait le reste
    next();
  }
}
```

```typescript
// D1 — Mitigation : rate limiting + circuit breaker
@UseGuards(RateLimiterGuard) // 10 checkout/min par user
@Post('checkout')
async checkout() { /* ... */ }

// E1 — Mitigation : RBAC avec guard
@Roles('admin', 'superadmin')
@UseGuards(RolesGuard)
@Post('admin/products')
async createProduct() { /* ... */ }
```

```typescript
// R2 — Mitigation : audit log immutable
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: string; // 'product.price.updated'

  @Column()
  userId: string;

  @Column('jsonb')
  before: Record<string, unknown>;

  @Column('jsonb')
  after: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
  // Pas de @UpdateDateColumn — immutable
}
```

## Alternatives et arbitrages

> En architecture, ta valeur n'est pas de connaître UNE solution,
> mais de savoir POURQUOI tu choisis celle-ci plutôt qu'une autre.

### Option A : STRIDE (solution présentée)
**Quand la choisir :** Approche systématique par catégorie de menace, bien adaptée au développement logiciel, équipe qui découvre le threat modeling, bonne couverture des menaces techniques.
**Limites :** Peut générer beaucoup de menaces (bruit), pas de priorisation native, focalisée sur les menaces techniques (moins sur les risques business).

### Option B : PASTA (Process for Attack Simulation and Threat Analysis)
**Quand la choisir :** Approche risk-centric (7 étapes), alignement avec les objectifs business, attacker-centric (simuler les scénarios d'attaque), adapté aux organisations matures.
**Limites :** Processus lourd (7 étapes formelles), nécessite une expertise sécurité avancée, temps de réalisation long.

### Option C : TRIKE
**Quand la choisir :** Approche basée sur les risques avec matrice d'acceptabilité, focus sur les acteurs et leurs actions autorisées, bonne traçabilité (qui peut faire quoi).
**Limites :** Moins connue que STRIDE, outillage limité, documentation plus rare.

### Option D : LINDDUN
**Quand la choisir :** Focus sur la privacy (GDPR, données personnelles), complément à STRIDE pour les aspects vie privée (Linkability, Identifiability, Non-repudiation, Detectability, Disclosure, Unawareness, Non-compliance).
**Limites :** Spécialisée privacy uniquement, pas de couverture des menaces techniques classiques, souvent utilisée en complément.

### Matrice de décision
| Critère | STRIDE | PASTA | TRIKE | LINDDUN |
|---|---|---|---|---|
| Facilité d'adoption | Excellente | Faible | Moyenne | Moyenne |
| Couverture technique | Excellente | Bonne | Bonne | Faible |
| Couverture privacy | Faible | Moyenne | Moyenne | Excellente |
| Priorisation native | Non | Oui | Oui | Non |
| Alignement business | Faible | Excellent | Moyen | Moyen |

### Pour ShopArch, on choisit...
STRIDE car c'est la méthode la plus accessible pour une équipe de développeurs. On l'applique sur le data flow diagram (client → BFF → API → DB) pour identifier les menaces par composant. On complète avec une analyse LINDDUN simplifiée pour les données personnelles (adresses, paiements) car ShopArch traite des données RGPD sensibles.

---

## Ce que tu aurais pu oublier

### 1. Faire confiance au client
```
FAUX — utiliser le prix/quantite envoye par le navigateur
CORRECT — TOUJOURS recalculer cote serveur depuis la DB
         Le client est un territoire hostile
```

### 2. Oublier le multi-tenant
```
FAUX — threat model qui ignore l'isolation entre tenants
CORRECT — l'escalade tenant est la menace #1 en SaaS multi-tenant
         Row-Level Security + middleware systemique
```

### 3. STRIDE incomplet
```
FAUX — ne regarder que Spoofing et Injection (les plus connus)
CORRECT — chaque lettre de STRIDE identifie des menaces differentes
         Repudiation et Information Disclosure sont souvent oubliees
```

### 4. Mitigations non testables
```
FAUX — "ajouter de la securite au checkout"
CORRECT — mitigation concrete + test automatise
         Ex: "rate limiter a 10 req/min" + test qui envoie 15 req et verifie le 429
```
