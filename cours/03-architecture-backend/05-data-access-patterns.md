# Cours 23 — Data Access Patterns

> **Objectif** : Comprendre les patterns d'accès aux données (Repository, Unit of Work, Active Record vs Data Mapper), implémenter un système de versioning de contenu diff-based, et maîtriser le flow d'upload via presigned URLs.

---

## Rappel du cours précédent

<details>
<summary>1. Quels sont les 3 niveaux d'isolation dans une architecture multi-tenant ?</summary>

1. **Schema PostgreSQL** — `SET search_path = tenant_slug`
2. **SQL Filters automatiques** — chaque requête est filtree par `tenant_id` / `site_id`
3. **Storage prefix S3** — `{tenant}/{site}/media/...`

Les 3 couches sont independantes : meme si l'une échoué, les autres protegent.
</details>

<details>
<summary>2. Comment un tenant est-il extrait d'une requête entrante ?</summary>

1. D'abord depuis le **JWT claim** (`tenant_id` dans le payload)
2. Fallback sur le **header HTTP** `X-Tenant-Id`
3. Le middleware rejette la requête si aucun tenant n'est identifie (401/403)
</details>

---

## Analogie — Le bibliothecaire, l'inventaire et le livre magique

Imagine une bibliotheque :

- **Le bibliothecaire** (Repository) : tu lui demandes "donne-moi le livre avec l'ISBN 978-3-16", il sait ou chercher, te le rapporte, et le range quand tu as fini. Tu ne sais pas comment la bibliotheque est organisee.
- **L'inventaire** (DAO) : c'est le registre brut — il sait lire et écrire dans la base de données, mais ne comprend pas ce qu'est un "livre". Il manipule des lignes de données.
- **Le livre magique** (Active Record) : le livre sait se sauvegarder tout seul (`book.save()`), se supprimer (`book.delete()`). Pratique, mais le livre "connait" l'etagere — il est couple a l'infrastructure.

Le **Data Mapper** est l'approche ou le livre (entité) ne sait rien de la bibliotheque — c'est un intermédiaire (mapper) qui traduit entre le livre et l'etagere.

---

## Théorie

### 1. Les 4 patterns d'accès aux données

```
┌──────────────────────────────────────────────────────────────┐
│                    Patterns d'acces aux donnees               │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────┐│
│  │ Active      │  │    DAO      │  │    Repository         ││
│  │ Record      │  │             │  │                       ││
│  │             │  │ Couche      │  │ Collection-like       ││
│  │ L'entite   │  │ d'acces     │  │ interface pour le     ││
│  │ sait se    │  │ generique   │  │ domaine               ││
│  │ persister  │  │ (CRUD brut) │  │                       ││
│  └─────────────┘  └─────────────┘  └───────────────────────┘│
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Unit of Work                          │ │
│  │  Traque les changements, commit en une transaction      │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

| Pattern | Couplage entité/DB | Complexite | Testabilite | Cas d'usage |
|---|---|---|---|---|
| **Active Record** | Fort (l'entité hérité de Model) | Faible | Difficile (besoin de DB) | CRUD simple, prototypage |
| **DAO** | Moyen (couche générique) | Moyen | Moyenne | Accès DB générique |
| **Repository** | Aucun (interface domaine) | Moyen-élevé | Excellente (mock facile) | DDD, domaine riche |
| **Data Mapper** | Aucun (mapper séparé) | Eleve | Excellente | Entités complexes, mapping non trivial |

### Active Record vs Data Mapper

```typescript
// ACTIVE RECORD — l'entite connait la DB
class Product extends BaseEntity {
  @Column()
  name: string;

  async updatePrice(newPrice: number) {
    this.price = newPrice;
    await this.save(); // L'entite sait se persister !
  }
}

// DATA MAPPER — l'entite est pure, ignorante de la DB
class Product {
  constructor(
    public readonly id: string,
    public name: string,
    public price: Money,
  ) {}

  updatePrice(newPrice: Money): void {
    // Logique metier pure — aucune reference a la DB
    if (newPrice.amount <= 0) throw new Error('Price must be positive');
    this.price = newPrice;
  }
}

// Le mapper traduit entre l'entite et la DB
class ProductMapper {
  toDomain(row: ProductRow): Product {
    return new Product(row.id, row.name, Money.fromCents(row.price_cents));
  }
  toPersistence(product: Product): ProductRow {
    return { id: product.id, name: product.name, price_cents: product.price.cents };
  }
}
```

### 2. Repository pattern en detail

Le Repository expose une interface **collection-like** pour le domaine :

```typescript
// L'interface vit dans le DOMAINE — pas d'import d'infra
interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  findByCategory(categoryId: string): Promise<Product[]>;
  search(query: string, limit?: number): Promise<Product[]>;
  save(product: Product): Promise<void>;
  remove(product: Product): Promise<void>;
}
```

Regles du Repository :
1. **L'interface est dans le domaine** — jamais dans l'infra
2. **Retourne des entités de domaine** — pas des rows SQL
3. **Encapsule la requête** — le domaine ne sait pas si c'est SQL, MongoDB, ou un fichier JSON
4. **Un Repository par agregat** — pas par table

### 3. Unit of Work

Le Unit of Work traque toutes les modifications pendant une transaction et les commit en une seule fois :

```
┌────────────────────────────────────────┐
│            Unit of Work                 │
│                                         │
│  Nouvelles entites : [Product A]        │
│  Modifiees :         [Product B]        │
│  Supprimees :        [Product C]        │
│                                         │
│  commit() → BEGIN                       │
│              INSERT Product A           │
│              UPDATE Product B           │
│              DELETE Product C           │
│             COMMIT                      │
└────────────────────────────────────────┘
```

TypeORM et Doctrine implementent le Unit of Work via l'Entity Manager — tu n'as généralement pas a le coder toi-meme.

### 4. Content versioning diff-based

Pour versionner du contenu (articles, pages), deux approches :

| Approche | Stockage | Reconstruction | Cas d'usage |
|---|---|---|---|
| **Full snapshot** | Chaque version = copie complete | O(1) — lecture directe | Peu de versions, contenu léger |
| **Diff-based** | v1 = snapshot, v2+ = diffs | O(n) — appliquer les diffs | Beaucoup de versions, contenu lourd |

Le diff-based economise ~92% de stockage pour un article moyen avec 10 versions.

```
v1 (snapshot) ──→ v2 (diff) ──→ v3 (diff) ──→ v4 (diff)
    │                                              │
    └── Reconstruction v4 : appliquer v1 + diff v2 + diff v3 + diff v4
        Temps : ~5ms pour 10 versions (negligeable)
```

**Rollback non-destructif** : on ne supprime JAMAIS une version. Revenir en arriere = créer une nouvelle version dont le contenu est l'ancien. L'historique reste intact.

### 5. Presigned URL upload flow

Ne jamais faire transiter les fichiers par ton API — upload directement vers S3 :

```
Client                    API                     S3
  │                        │                       │
  │  POST /uploads         │                       │
  │  { filename, mime }    │                       │
  │───────────────────────>│                       │
  │                        │  Generate presigned   │
  │                        │  PUT URL (5min TTL)   │
  │  { uploadUrl, key }   │                       │
  │<───────────────────────│                       │
  │                        │                       │
  │  PUT uploadUrl         │                       │
  │  [binary data]         │                       │
  │────────────────────────────────────────────────>│
  │                        │                       │
  │  200 OK               │                       │
  │<────────────────────────────────────────────────│
  │                        │                       │
  │  POST /uploads/confirm │                       │
  │  { key }               │                       │
  │───────────────────────>│                       │
  │                        │  Verify file exists   │
  │                        │  Deduplicate SHA256   │
  │                        │  Create Media entity  │
  │  { mediaId, url }     │                       │
  │<───────────────────────│                       │
```

Avantages :
- L'API n'est pas un bottleneck pour les gros fichiers
- Upload parallele possible
- Presigned URL expire apres 5 min (sécurité)
- Deduplication par SHA256 (meme fichier = meme hash = pas de doublon)

---

## Pratique

### Repository avec TypeORM Data Mapper

```typescript
// domain/product.repository.ts — l'interface
export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  findByCategory(categoryId: string, limit?: number): Promise<Product[]>;
  save(product: Product): Promise<void>;
}

// infra/typeorm-product.repository.ts — l'implementation
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity } from './product.entity';
import { ProductMapper } from './product.mapper';
import { ProductRepository } from '../domain/product.repository';
import { Product } from '../domain/product';

@Injectable()
export class TypeOrmProductRepository implements ProductRepository {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly repo: Repository<ProductEntity>,
    private readonly mapper: ProductMapper,
  ) {}

  async findById(id: string): Promise<Product | null> {
    const entity = await this.repo.findOne({
      where: { id },
      relations: ['category', 'images'],
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByCategory(categoryId: string, limit = 20): Promise<Product[]> {
    const entities = await this.repo.find({
      where: { category: { id: categoryId } },
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.mapper.toDomain(e));
  }

  async save(product: Product): Promise<void> {
    const entity = this.mapper.toPersistence(product);
    await this.repo.save(entity);
  }
}
```

### Content versioning service

```typescript
import { diff_match_patch } from 'diff-match-patch';

interface ContentVersion {
  version: number;
  type: 'snapshot' | 'diff';
  data: string;           // Contenu complet (snapshot) ou patch (diff)
  createdAt: Date;
  authorId: string;
}

export class ContentVersioningService {
  private dmp = new diff_match_patch();

  // Creer un diff entre l'ancienne et la nouvelle version
  createDiff(oldContent: string, newContent: string): string {
    const patches = this.dmp.patch_make(oldContent, newContent);
    return this.dmp.patch_toText(patches);
  }

  // Reconstruire le contenu a une version donnee
  reconstruct(versions: ContentVersion[], targetVersion: number): string {
    // Trouver le snapshot le plus recent <= targetVersion
    const snapshot = versions
      .filter((v) => v.type === 'snapshot' && v.version <= targetVersion)
      .sort((a, b) => b.version - a.version)[0];

    if (!snapshot) throw new Error('No snapshot found');

    let content = snapshot.data;

    // Appliquer les diffs sequentiellement
    const diffs = versions
      .filter((v) => v.type === 'diff' && v.version > snapshot.version && v.version <= targetVersion)
      .sort((a, b) => a.version - b.version);

    for (const diff of diffs) {
      const patches = this.dmp.patch_fromText(diff.data);
      const [result, success] = this.dmp.patch_apply(patches, content);
      if (success.some((s) => !s)) {
        throw new Error(`Failed to apply diff v${diff.version}`);
      }
      content = result;
    }

    return content;
  }

  // Rollback non-destructif : creer une NOUVELLE version avec l'ancien contenu
  rollback(
    versions: ContentVersion[],
    targetVersion: number,
    currentContent: string,
    authorId: string,
  ): ContentVersion {
    const oldContent = this.reconstruct(versions, targetVersion);
    const nextVersion = Math.max(...versions.map((v) => v.version)) + 1;

    return {
      version: nextVersion,
      type: 'diff',
      data: this.createDiff(currentContent, oldContent),
      createdAt: new Date(),
      authorId,
    };
  }
}
```

### Presigned URL service

```typescript
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';

interface UploadRequest {
  filename: string;
  mimeType: string;
  tenantId: string;
  siteId: string;
}

interface UploadResponse {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

export class PresignedUploadService {
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
  ) {}

  async requestUpload(req: UploadRequest): Promise<UploadResponse> {
    // Generer une cle unique avec le prefix tenant/site
    const key = `${req.tenantId}/${req.siteId}/media/${crypto.randomUUID()}/${req.filename}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: req.mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 300, // 5 minutes
    });

    return { uploadUrl, key, expiresIn: 300 };
  }

  async confirmUpload(key: string): Promise<{ sha256: string; size: number }> {
    // Verifier que le fichier existe
    const head = await this.s3.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    if (!head.ContentLength) throw new Error('File not found');

    // Calculer le hash pour deduplication
    // (en production, utiliser un hash stocke par S3 ou un worker)
    const sha256 = createHash('sha256').update(key).digest('hex');

    return { sha256, size: head.ContentLength };
  }
}
```

---

## Resume

1. **Active Record** couple l'entité a la DB — rapide pour du CRUD, mauvais pour du DDD
2. **Repository** + **Data Mapper** decoupent le domaine de l'infra — testable, évolutif
3. **Unit of Work** traque les changements et commit en une transaction
4. **Content versioning diff-based** economise ~92% de stockage avec reconstruction O(n) negligeable
5. **Presigned URLs** evitent que l'API soit un goulot d'etranglement pour les uploads

---

> **Prochain cours** : [Cours 24 — Validation & Error Handling](./06-validation-error-handling.md) — ou comment valider les données a chaque couche et communiquer les erreurs proprement.

---

> **Lien fil rouge — ShopArch**
>
> - Implémente le pattern Repository pour le module Catalog avec TypeORM
> - Ajoute l'optimistic locking (ETag/version) sur la mise à jour du stock produit
> - Exercice(s) associé(s) : `exercices/16-race-condition-locking/`
> - Checkpoint : Module 03, critère 4
