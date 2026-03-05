# Cours 57 — Architecture Zero Trust

> **Objectif** : Comprendre le modèle Zero Trust ("never trust, always verify"), savoir implémenter la microsegmentation, le mTLS entre services, le least privilege et le default-deny, et remplacer la sécurité perimetrique par une sécurité basee sur l'identité.

---

## Rappel du cours précédent

<details>
<summary>1. Pourquoi les UUIDs v4 ne suffisent-ils pas a protéger contre les IDOR ?</summary>

Les UUIDs empechent la **devination** (122 bits d'entropie vs IDs sequentiels), mais un attaquant peut obtenir un UUID par d'autres moyens (log fuite, referrer, API response). Il faut toujours ajouter un **ownership check côté serveur** : vérifier que `resource.tenantId === user.tenantId`. L'UUID est une couche de defense, pas la seule.
</details>

<details>
<summary>2. Qu'est-ce que STRIDE et a quoi sert chaque lettre ?</summary>

STRIDE est un modèle de threat modeling de Microsoft. Chaque lettre identifie une categorie de menace : **S**poofing (usurpation d'identité), **T**ampering (modification de données), **R**epudiation (deni d'action), **I**nformation Disclosure (fuite de données), **D**enial of Service (saturation), **E**levation of Privilege (escalade de droits). On l'applique a chaque traversee de trust boundary dans un Data Flow Diagram.
</details>

---

## Analogie — L'aeroport

Un aeroport illustre parfaitement le Zero Trust — chaque zone a son propre controle de sécurité :

- **L'entree de l'aeroport** = le perimetre réseau classique (un seul checkpoint). En Zero Trust, ce n'est que le debut
- **Le controle des billets** = l'authentification initiale (prouver qui tu es)
- **Le controle de sécurité** = l'inspection des requêtes (WAF, validation)
- **Le controle aux portes d'embarquement** = la re-vérification avant chaque accès (mTLS entre services)
- **Le passeport vérifié a CHAQUE étape** = identity-based access (pas "tu es dans le bon batiment, donc tu es fiable")
- **Les zones reservees (piste, tour de controle)** = microsegmentation (meme le personnel n'accede qu'a SA zone)
- **Le badge du personnel** = le certificat mTLS (prouve l'identité de la machine, pas juste de l'humain)

Dans un aeroport, personne ne dit "il est passe le premier controle, donc il est fiable partout". C'est exactement le principe du Zero Trust.

---

## Théorie

### 1. Sécurité perimetrique vs Zero Trust

```
MODELE PERIMETRIQUE (chateau-fort) :
┌──────────────────────────────────────────────────┐
│  FIREWALL (mur du chateau)                        │
│  ┌────────────────────────────────────────────┐  │
│  │  RESEAU INTERNE = "zone de confiance"       │  │
│  │                                              │  │
│  │  Service A ←──→ Service B ←──→ Service C    │  │
│  │       ↕              ↕              ↕        │  │
│  │      DB A           DB B           DB C      │  │
│  │                                              │  │
│  │  Tout le monde se fait confiance a           │  │
│  │  l'interieur du perimetre                     │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
  Probleme : un attaquant qui passe le firewall
  a acces a TOUT (lateral movement)

MODELE ZERO TRUST :
┌──────────────────────────────────────────────────┐
│  CHAQUE SERVICE EST SON PROPRE PERIMETRE          │
│                                                    │
│  ┌──────────┐  mTLS   ┌──────────┐  mTLS         │
│  │ Service A │◄═══════►│ Service B │◄═══════►...   │
│  │ ┌──────┐  │  JWT    │ ┌──────┐  │  JWT          │
│  │ │Policy│  │  RBAC   │ │Policy│  │  RBAC         │
│  │ └──────┘  │         │ └──────┘  │               │
│  └──────────┘         └──────────┘               │
│                                                    │
│  Chaque appel est authentifie, autorise, chiffre  │
│  Meme en interne. Pas de confiance implicite.      │
└──────────────────────────────────────────────────┘
```

### 2. Les 5 piliers du Zero Trust

| Pilier | Principe | Implémentation |
|---|---|---|
| **Never trust** | Aucun réseau, device ou user n'est fiable par defaut | Tout trafic est chiffre, meme interne |
| **Always verify** | Chaque requête est authentifiee et autorisee | JWT valide par chaque service |
| **Least privilege** | Accorder le minimum de droits nécessaires | Roles granulaires, pas de "super-admin" |
| **Assume breach** | Architecturer comme si l'attaquant etait déjà dedans | Microsegmentation, blast radius minimal |
| **Verify explicitly** | Decision basee sur tous les signaux disponibles | IP, device, heure, comportement, role |

### 3. Microsegmentation

La microsegmentation isole chaque service dans son propre segment réseau :

```
SANS microsegmentation :
┌──────────────────────────────┐
│  Namespace "default"          │
│                                │
│  API ──── Orders ──── Users   │
│   │         │          │      │
│   └────── Payments ────┘      │
│                                │
│  Tout communique avec tout     │
└──────────────────────────────┘

AVEC microsegmentation (Kubernetes NetworkPolicies) :
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ ns: api-gateway │  │ ns: orders      │  │ ns: payments    │
│                  │  │                  │  │                  │
│  ┌──────────┐   │  │  ┌──────────┐   │  │  ┌──────────┐   │
│  │ API GW   │───┼──┼─>│ Orders   │───┼──┼─>│ Payments │   │
│  └──────────┘   │  │  └──────────┘   │  │  └──────────┘   │
│                  │  │                  │  │                  │
│  Ingress: *     │  │  Ingress: api-gw│  │  Ingress: orders│
│  Egress: orders,│  │  Egress: payments│  │  Egress: DENY   │
│    users        │  │  Egress: DENY    │  │  (sauf DB)      │
└────────────────┘  └────────────────┘  └────────────────┘

  Si "orders" est compromis → l'attaquant ne peut PAS
  atteindre "users" ni sortir vers Internet
```

### 4. mTLS — authentification mutuelle entre services

```
TLS classique (unidirectionnel) :
  Client ──────────> Serveur
          "Prouve-moi      "Voici mon
           qui tu es"       certificat"

mTLS (bidirectionnel) :
  Client <─────────> Serveur
          "Prouve-moi      "Voici mon certificat"
           qui tu es"
          "Voici MON        "Je verifie le tien
           certificat"       aussi"

  → Les DEUX parties prouvent leur identite
  → Meme si un attaquant est dans le reseau,
     il n'a pas le certificat du service
```

| Aspect | TLS classique | mTLS |
|---|---|---|
| Serveur prouve son identité | Oui | Oui |
| Client prouve son identité | Non | **Oui** |
| Protection contre MITM | Oui | Oui + identité client |
| Cas d'usage | Navigateur → serveur | **Service → service** |
| Gestion des certificats | Simple (1 cert) | Complexe (cert par service) |
| Outils | Let's Encrypt | **Service mesh** (Istio, Linkerd) |

### 5. Least Privilege — matrice de permissions

```
┌──────────────┬─────────┬──────────┬──────────┬──────────┐
│ Role          │ Articles│ Users    │ Payments │ Settings │
├──────────────┼─────────┼──────────┼──────────┼──────────┤
│ viewer        │ read    │ ---      │ ---      │ ---      │
│ editor        │ read    │ ---      │ ---      │ ---      │
│               │ write   │          │          │          │
│ manager       │ read    │ read     │ read     │ ---      │
│               │ write   │          │          │          │
│ admin (tenant)│ read    │ read     │ read     │ read     │
│               │ write   │ write    │ write    │ write    │
│ super-admin   │ ALL     │ ALL      │ ALL      │ ALL      │
│ (platform)    │         │          │          │          │
└──────────────┴─────────┴──────────┴──────────┴──────────┘

  Chaque role n'a que les permissions NECESSAIRES
  Pas de "admin peut tout" — meme l'admin tenant
  n'accede pas aux settings de la plateforme
```

### 6. Default-deny network egress (Kubernetes)

Par defaut, un pod Kubernetes peut envoyer des requêtes n'importe ou sur Internet. En Zero Trust, on inverse : **tout est bloque sauf ce qui est explicitement autorise**.

```
DEFAULT-DENY :
  Pod → Internet        BLOQUE
  Pod → Autre namespace BLOQUE
  Pod → Meme namespace  BLOQUE (si policy existe)

EXCEPTIONS EXPLICITES :
  Pod "api" → Pod "database" (port 5432)     AUTORISE
  Pod "api" → Pod "redis" (port 6379)         AUTORISE
  Pod "api" → keycloak.example.com (443)      AUTORISE
  Pod "api" → * (tout le reste)               BLOQUE
```

### 7. Identity-based access vs IP-based access

| Approche | Principe | Problème |
|---|---|---|
| **IP-based** | "Si IP = 10.0.1.x, alors fiable" | IPs changent (auto-scaling, containers) |
| **Identity-based** | "Si certificat = service-orders, alors fiable" | Fonctionne peu importe l'IP |

En Zero Trust, l'identité du service (certificat mTLS, JWT, SPIFFE ID) remplace l'adresse IP comme critère de confiance.

---

## Pratique

### Kubernetes NetworkPolicy — default deny + whitelist

```yaml
# k8s/network-policies/default-deny.yaml
# Bloquer TOUT le trafic entrant et sortant par defaut
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: orders
spec:
  podSelector: {}  # Applique a TOUS les pods du namespace
  policyTypes:
    - Ingress
    - Egress
  # Pas de regles = tout est bloque

---
# k8s/network-policies/allow-orders-ingress.yaml
# Autoriser UNIQUEMENT le trafic depuis api-gateway
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-api-gateway
  namespace: orders
spec:
  podSelector:
    matchLabels:
      app: orders-service
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: api-gateway
          podSelector:
            matchLabels:
              app: api-gateway
      ports:
        - port: 3000
          protocol: TCP
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - port: 5432
          protocol: TCP
    # DNS interne (necessaire pour la resolution)
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - port: 53
          protocol: UDP
```

### Guard NestJS — vérification JWT a chaque requête

```typescript
// src/auth/jwt-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = await this.jwt.verifyAsync(token, {
        // Verification stricte : issuer, audience, expiration
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
        algorithms: ['RS256'], // Asymmetrique uniquement
      });

      // Attacher le payload au request pour les guards suivants
      request['user'] = payload;

      // Zero Trust : re-verifier le tenant a chaque requete
      const tenantId = request.headers['x-tenant-id'];
      if (payload.tenantId !== tenantId) {
        throw new UnauthorizedException('Tenant mismatch');
      }

      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractToken(request: Request): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }
}
```

### Decorator @RequirePermission — least privilege

```typescript
// src/auth/require-permission.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'required_permission';

// Usage : @RequirePermission('articles', 'write')
export const RequirePermission = (resource: string, action: string) =>
  SetMetadata(PERMISSION_KEY, { resource, action });

// src/auth/permission.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from './require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<{ resource: string; action: string }>(
      PERMISSION_KEY,
      context.getHandler(),
    );

    if (!required) return true; // Pas de permission requise

    const { user } = context.switchToHttp().getRequest();
    const permissions: string[] = user.permissions ?? [];

    // Verifier la permission specifique : "articles:write"
    const hasPermission = permissions.includes(`${required.resource}:${required.action}`);

    if (!hasPermission) {
      throw new ForbiddenException(
        `Missing permission: ${required.resource}:${required.action}`,
      );
    }

    return true;
  }
}

// Usage dans un controller
@Controller('articles')
export class ArticlesController {
  @Post()
  @RequirePermission('articles', 'write')
  create(@Body() dto: CreateArticleDto) {
    // Seuls les users avec "articles:write" arrivent ici
  }

  @Get()
  @RequirePermission('articles', 'read')
  findAll() {
    // Meme la lecture est protegee — pas de "public par defaut"
  }
}
```

---

## Resume

1. **Zero Trust** = "never trust, always verify" — aucun réseau, device ou service n'est fiable par defaut, meme en interne
2. **Microsegmentation** : chaque service dans son namespace Kubernetes avec des NetworkPolicies default-deny — si un service est compromis, le blast radius est minimal
3. **mTLS** : authentification mutuelle entre services — les deux parties prouvent leur identité via certificats, géré par un service mesh (Istio/Linkerd)
4. **Least privilege** : chaque role n'a que les permissions strictement nécessaires — utiliser des permissions granulaires (`resource:action`) plutot que des roles larges
5. **Identity-based access** : l'identité du service (certificat, JWT, SPIFFE ID) remplace l'adresse IP comme critère de confiance — les IPs changent, les identités non

---

> **Prochain cours** : [Cours 58 — CSP, Trusted Types, SRI & Security Headers](./03-csp-trusted-types-sri.md) — ou comment configurer les Content Security Policies, les Trusted Types et les headers de sécurité pour bloquer les XSS au niveau du navigateur.

---

> **Lien fil rouge — ShopArch**
>
> - Applique le principe Zero Trust aux communications inter-modules ShopArch
> - Vérifie que chaque appel API est authentifié et autorisé (pas de trust implicite)
> - Exercice(s) associé(s) : `exercices/38-securiser-api/`
> - Checkpoint : Module 08, critère 1
