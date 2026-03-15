# Cours 24 — Validation & Error Handling

> **Objectif** : Maîtriser la validation en couches (DTO → domaine → persistence), implémenter RFC 7807 Problem Details, et définir une stratégie d'error handling par code HTTP.

---

## Rappel du cours précédent

<details>
<summary>1. Quelle est la différence entre Active Record et Data Mapper ?</summary>

- **Active Record** : l'entité hérité d'un modèle de base et sait se persister (`product.save()`). L'entité est couplee à la DB.
- **Data Mapper** : l'entité est un objet pur sans référence à la DB. Un mapper séparé traduit entre l'entité et la persistence. L'entité est découplé — testable et portable.
</details>

<details>
<summary>2. Pourquoi le rollback en content versioning est-il "non destructif" ?</summary>

On ne supprime jamais une version existante. "Revenir à la v3" = créer une **nouvelle version** (v11, v12...) dont le contenu est identique a l'ancienne v3. L'historique complet reste intact, ce qui garantit l'auditabilite et permet de "rollback le rollback".
</details>

---

## Analogie — Les controles a l'aeroport

Les données qui entrent dans ton application sont comme un passager a l'aeroport :

1. **Controle des documents** (DTO validation) — le passeport est-il valide ? Le format est-il correct ? → vérifié la forme
2. **Controle de sécurité** (Domain validation) — le passager a-t-il le droit de voyager ? Son billet est-il cohérent ? → vérifié les règles métier
3. **Embarquement** (Persistence validation) — la place est-elle disponible ? Le vol n'est-il pas complet ? → vérifié les contraintes techniques (unique, FK, check)

Si le passager échoué à une étape, il recoit un message **clair et spécifique** expliquant pourquoi et comment corriger.

---

## Théorie

### 1. Validation en 3 couches

```
Requete HTTP
    │
    ▼
┌───────────────────────────────┐
│  Couche 1 : DTO Validation    │  class-validator / Zod
│  - Format (string, number)    │  → 422 Unprocessable Entity
│  - Presence (required)        │
│  - Contraintes (min, max)     │
└───────────────┬───────────────┘
                │ DTO valide
                ▼
┌───────────────────────────────┐
│  Couche 2 : Domain Validation │  Logique metier
│  - Regles metier              │  → 422 avec violation domaine
│  - Coherence inter-champs     │  → 409 Conflict
│  - Invariants d'agregat       │
└───────────────┬───────────────┘
                │ Entite valide
                ▼
┌───────────────────────────────┐
│  Couche 3 : Persistence       │  Contraintes DB
│  - Unique constraint          │  → 409 Conflict
│  - Foreign key                │  → 422 reference invalide
│  - Check constraint           │
└───────────────────────────────┘
```

**Regle fondamentale** : fail fast. Rejeter le plus tot possible, au niveau le plus proche de l'entree.

### 2. RFC 7807 Problem Details

Le standard RFC 7807 définit un format uniforme pour les erreurs API :

```json
{
  "type": "https://api.shoparch.com/errors/validation-failed",
  "title": "Validation Failed",
  "status": 422,
  "detail": "2 field(s) failed validation",
  "instance": "/api/v1/products/abc-123",
  "violations": [
    {
      "field": "price",
      "message": "Price must be positive",
      "code": "POSITIVE"
    },
    {
      "field": "name",
      "message": "Name must be between 3 and 255 characters",
      "code": "LENGTH"
    }
  ]
}
```

| Champ | Type | Description |
|---|---|---|
| `type` | URI | Identifiant unique du type d'erreur (lien vers la doc) |
| `title` | string | Description humaine du type d'erreur |
| `status` | number | Code HTTP |
| `detail` | string | Description spécifique a cette occurrence |
| `instance` | URI | URI de la ressource concernee |
| `violations` | array | (Extension) Liste des violations par champ |

### 3. Stratégie d'error handling par code HTTP

| Code | Signification | Action client | Exemple |
|---|---|---|---|
| **400** | Bad Request | Corriger la requête | JSON malformed, paramètre manquant |
| **401** | Unauthorized | Rediriger vers login | Token expire ou absent |
| **403** | Forbidden | Afficher "accès refuse" | Pas le bon role RBAC |
| **404** | Not Found | Afficher "non trouve" | Ressource inexistante |
| **409** | Conflict | Rafraichir et reessayer | Unique constraint, version conflict |
| **412** | Precondition Failed | Refresh ETag et reessayer | `If-Match` ETag mismatch (optimistic lock) |
| **422** | Unprocessable Entity | Afficher les violations | Validation échouée |
| **429** | Too Many Requests | Attendre `Retry-After` | Rate limiting |
| **500** | Internal Server Error | Afficher erreur générique | Bug serveur |

**Cote front-end, chaque code à un handler dédié** :

```typescript
// Pas de switch/case infini — une map de strategies
const errorHandlers: Record<number, (error: ApiError) => void> = {
  401: () => authStore.logout(),
  403: () => router.push('/forbidden'),
  409: () => refreshAndRetry(),
  412: () => refreshEtagAndRetry(),
  422: (err) => displayViolations(err.violations),
  429: (err) => scheduleRetry(err.retryAfter),
};
```

### 4. Fail-fast principle

Ne pas accumuler les erreurs silencieusement. Rejeter **immédiatement** des que quelque chose est invalide :

```typescript
// MAUVAIS — on continue malgre l'erreur
function processOrder(order: OrderDTO) {
  let errors: string[] = [];
  if (!order.items.length) errors.push('No items');
  if (!order.shippingAddress) errors.push('No address');
  if (errors.length) throw new ValidationError(errors);
  // ... 50 lignes plus tard, on decouvre un autre probleme
}

// BON — guard clauses, on sort immediatement
function processOrder(order: OrderDTO) {
  if (!order.items.length) throw new ValidationError('No items');
  if (!order.shippingAddress) throw new ValidationError('No address');
  // A partir d'ici, tout est garanti valide
}
```

Exception : pour la validation DTO, on VEUT collecter toutes les erreurs d'un coup pour les retourner au client (sinon il devrait soumettre 10 fois pour découvrir 10 erreurs).

---

## Pratique

### DTO Validation avec class-validator

```typescript
import { IsString, IsPositive, IsUUID, MinLength, MaxLength, IsOptional } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(3, { message: 'Name must be at least 3 characters' })
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;

  @IsPositive({ message: 'Price must be positive' })
  price: number;

  @IsUUID('4', { message: 'Invalid category ID format' })
  categoryId: string;
}
```

### Domain validation dans l'entité

```typescript
export class Product {
  private constructor(
    public readonly id: string,
    private _name: string,
    private _price: Money,
    private _status: ProductStatus,
  ) {
    this.validate();
  }

  private validate(): void {
    if (this._price.amount <= 0) {
      throw new DomainError('Product price must be positive');
    }
    if (this._name.trim().length < 3) {
      throw new DomainError('Product name too short');
    }
  }

  publish(): void {
    // Validation metier contextuelle
    if (this._status !== ProductStatus.DRAFT) {
      throw new DomainError('Only draft products can be published');
    }
    if (!this._price) {
      throw new DomainError('Cannot publish a product without price');
    }
    this._status = ProductStatus.PUBLISHED;
  }
}
```

### Global Exception Filter RFC 7807

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  violations?: Array<{ field: string; message: string; code: string }>;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const problem = this.toProblemDetails(exception, request.url);

    response
      .status(problem.status)
      .header('Content-Type', 'application/problem+json')
      .json(problem);
  }

  private toProblemDetails(exception: unknown, instance: string): ProblemDetails {
    // Validation error (class-validator via ValidationPipe)
    if (exception instanceof HttpException && exception.getStatus() === 422) {
      const response = exception.getResponse() as any;
      return {
        type: 'https://api.shoparch.com/errors/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: `${response.message?.length || 0} field(s) failed validation`,
        instance,
        violations: this.extractViolations(response),
      };
    }

    // Domain error
    if (exception instanceof DomainError) {
      return {
        type: 'https://api.shoparch.com/errors/domain-error',
        title: 'Domain Rule Violation',
        status: 422,
        detail: exception.message,
        instance,
      };
    }

    // ETag mismatch
    if (exception instanceof HttpException && exception.getStatus() === 412) {
      return {
        type: 'https://api.shoparch.com/errors/precondition-failed',
        title: 'Precondition Failed',
        status: 412,
        detail: 'The resource has been modified. Refresh and retry.',
        instance,
      };
    }

    // Generic HTTP exception
    if (exception instanceof HttpException) {
      return {
        type: `https://api.shoparch.com/errors/http-${exception.getStatus()}`,
        title: HttpStatus[exception.getStatus()] || 'Error',
        status: exception.getStatus(),
        detail: exception.message,
        instance,
      };
    }

    // Unknown error — never leak internal details
    return {
      type: 'https://api.shoparch.com/errors/internal',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred',
      instance,
    };
  }

  private extractViolations(response: any) {
    if (!Array.isArray(response.message)) return [];
    return response.message.map((msg: string) => {
      const [field, ...rest] = msg.split(' ');
      return { field, message: msg, code: 'VALIDATION' };
    });
  }
}

class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
```

### Error handler côté front-end

```typescript
type ApiError = {
  type: string;
  title: string;
  status: number;
  detail: string;
  violations?: Array<{ field: string; message: string }>;
  retryAfter?: number;
};

export function handleApiError(error: ApiError, context: ErrorContext): void {
  switch (error.status) {
    case 401:
      // Token expire → logout + redirect login
      authStore.getState().logout();
      window.location.href = '/login';
      break;

    case 412:
      // ETag mismatch → rafraichir la ressource et reessayer
      context.refreshResource().then(() => context.retryAction());
      break;

    case 422:
      // Violations → afficher sous chaque champ
      if (error.violations) {
        const fieldErrors: Record<string, string> = {};
        for (const v of error.violations) {
          fieldErrors[v.field] = v.message;
        }
        context.setFieldErrors(fieldErrors);
      }
      break;

    case 429:
      // Rate limited → attendre Retry-After
      const delay = (error.retryAfter ?? 60) * 1000;
      setTimeout(() => context.retryAction(), delay);
      context.showNotification(`Too many requests. Retry in ${error.retryAfter}s`);
      break;

    default:
      context.showNotification(error.detail || 'An error occurred');
  }
}
```

---

## Résumé

1. **3 couches de validation** : DTO (format), Domain (règles métier), Persistence (contraintes DB) — fail fast à chaque couche
2. **RFC 7807 Problem Details** donne un format standard (`type`, `title`, `status`, `detail`, `violations`) pour toutes les erreurs API
3. **Chaque code HTTP à une semantique précisé** — 412 = ETag mismatch, 422 = validation, 429 = rate limit
4. **Le front-end à un handler par code HTTP** — pas de `if (error) alert(error)` générique
5. **Ne jamais leaker les details internes** en production — les 500 retournent un message générique

---

> **Prochain cours** : [Cours 25 — Background Jobs & Queues](./07-background-jobs-queues.md) — ou comment gérer les taches longues sans bloquer l'API.

---

> **Lien fil rouge — ShopArch**
>
> - Implémente la validation des DTOs avec class-validator dans ShopArch
> - Standardise les réponses d'erreur (400 validation, 404 not found, 409 conflict, 422 business rule)
> - Exercice(s) associé(s) : `exercices/12-api-rest-nestjs/`
> - Checkpoint : Module 03, critère 1
