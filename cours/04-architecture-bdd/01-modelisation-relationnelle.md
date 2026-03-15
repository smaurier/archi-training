# Cours 27 — Modélisation relationnelle avancee

**Objectif :** Savoir concevoir un schema PostgreSQL robuste pour une application multi-tenant SaaS : choisir les bons types de colonnes (UUID, JSON, enum), définir les champs partages obligatoires, implémenter le soft delete, et structurer une architecture dual-database (master + tenant schemas).

---

## Rappel du cours précédent

> Cours 26 — Concurrence & Asynchronisme.

**Question 1 — Quelle est la différence entre un lock optimiste et un lock pessimiste, et quand utiliser chacun ?**

<details>
<summary>Réponse</summary>

Le **lock optimiste** utilise un champ `version` (où un ETag). Avant de sauvegarder, on vérifié que la version en base n'a pas change depuis la lecture. Si elle a change, on rejette avec une erreur 409/412. Pas de verrou en base, donc pas de blocage — ideal pour les cas où les conflits sont rares (ex : edition de contenu CMS).

Le **lock pessimiste** utilise `SELECT ... FOR UPDATE` qui verrouille la ligne en base tant que la transaction n'est pas terminee. Les autres transactions qui tentent de lire/modifier cette ligne sont bloquees. Utilise quand les conflits sont fréquents ou quand la cohérence est critique (ex : débit de solde, reservation de stock).

</details>

**Question 2 — Pourquoi le modèle event-loop single-thread de Node.js peut quand même gérer des milliers de connexions simultanees ?**

<details>
<summary>Réponse</summary>

Parce que Node.js utilise des I/O non-bloquantes. Quand une requête attend une réponse de la base de données ou du réseau, le thread principal ne se bloque pas — il continue a traiter d'autres requêtes. Les opérations I/O sont deleguees au système d'exploitation (epoll/kqueue) via libuv, et le callback est exécuté quand le résultat est pret. C'est comme un serveur de restaurant avec un seul serveur très rapide qui prend les commandes sans attendre que la cuisine ait fini — il passe à la table suivante.

</details>

---

## Analogie — L'architecte d'interieur

Imagine un immeuble de bureaux modulable :

- **Les murs porteurs** = le schema de base de données. Ils définissent la structure. On ne les deplace pas à la légère — chaque modification nécessité un permis (migration).
- **Les cloisons amovibles** = les données. Elles s'adaptent aux besoins du locataire. Chaque etage (tenant) peut reorganiser ses cloisons sans affecter les autres.
- **Le plan d'architecte** = le DDL (Data Définition Language). Il est versionne, chaque modification est tracee.
- **Les plaques de porte** = les identifiants. Si tu mets "Bureau 1, 2, 3..." en sequence, quelqu'un qui connait le "Bureau 5" peut deviner qu'il existe un "Bureau 6". Avec des UUID, c'est comme des noms de code aleatoires — impossible a deviner.
- **Le carnet d'entretien** = les champs `created_at`, `updated_at`, `version`. Chaque modification est horodatee.

Les murs porteurs (schema) ne bougent pas, les cloisons (data) s'adaptent.

---

## Théorie

### 1. UUID v4 comme clé primaire — Prevention IDOR

Les IDs sequentiels (1, 2, 3...) sont un risque de sécurité majeur : **IDOR** (Insecure Direct Object Référence).

```
PROBLEME — IDs sequentiels :
  GET /api/articles/42     -> Mon article
  GET /api/articles/43     -> L'article de quelqu'un d'autre ? Essayons...
  GET /api/articles/44     -> Et celui-la ?
  L'attaquant enumere TOUS les articles en incrementant l'ID.

SOLUTION — UUID v4 :
  GET /api/articles/a3f8c2d1-7e4b-4f9a-b6c8-9d2e1f3a4b5c
  Impossible a deviner. 2^122 combinaisons possibles.
  Meme sans controle d'acces (erreur), l'enumeration est impraticable.
```

| Critère | ID sequentiel (SERIAL) | UUID v4 |
|---|---|---|
| Taille | 4 octets (int) / 8 (bigint) | 16 octets |
| Enumeration | Triviale (1, 2, 3...) | Impossible (2^122) |
| Genere par | La BDD (sequence) | L'application (crypto) |
| Tri naturel | Oui (ordre d'insertion) | Non (aleatoire) |
| Performance index B-tree | Excellente (sequentiel) | Bonne (fragmentation légère) |
| Multi-node | Conflits possibles | Sans conflit (généré côté app) |

**Important :** UUID v4 est aleatoire, donc pas d'ordre d'insertion. Si tu as besoin d'un tri chronologique, utilise `created_at` ou un UUID v7 (horodatage encode).

---

### 2. Colonnes JSON pour l'internationalisation (i18n)

Plutot que de créer une table de traductions séparée avec des jointures couteuses, on stocke les traductions directement dans une colonne JSON :

```
APPROCHE TABLE SEPAREE (complexe, lente) :
  articles (id, site_id, status, ...)
  article_translations (article_id, locale, title, body)
  -> JOIN a chaque requete, cardinalite N, complexite migration

APPROCHE JSON (simple, performante) :
  articles (id, site_id, status, title JSONB, body JSONB, ...)
  title = {"fr": "Mon article", "en": "My article", "nl": "Mijn artikel"}
  -> Un seul SELECT, extraction JSON cote app ou cote SQL
```

Le type `MultiLangField` :

```typescript
// Le type partage entre front et back
interface MultiLangField {
  fr: string;
  en?: string;
  nl?: string;
}

// Exemple de donnee
const title: MultiLangField = {
  fr: "Politique de confidentialite",
  en: "Privacy Policy",
  nl: "Privacybeleid",
};
```

---

### 3. Champs partages obligatoires

Chaque entité du CMS doit avoir ces champs — sans exception :

```
+------------------------------------------------------------------+
|                    CHAMPS OBLIGATOIRES                            |
+------------------------------------------------------------------+
| id         UUID        PK, genere par l'application              |
| site       UUID        FK vers la table sites (isolation)        |
| created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                    |
| updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                    |
| version    INTEGER     NOT NULL DEFAULT 1 (optimistic locking)   |
+------------------------------------------------------------------+

Pourquoi chacun :
  id         -> Identification unique, prevention IDOR
  site       -> Isolation multi-site au sein d'un tenant
  created_at -> Audit, tri chronologique, debug
  updated_at -> Detection de stale data, cache invalidation
  version    -> Optimistic locking (Cours 26), conflit concurrent
```

---

### 4. Soft Delete via champ status

On ne supprime **jamais** physiquement une ligne. On change son statut :

```
HARD DELETE (dangereux) :
  DELETE FROM articles WHERE id = '...';
  -> Donnee perdue a jamais. Pas d'historique. Pas de restauration.
  -> Casse les references (FK orphelines ou CASCADE involontaire).

SOFT DELETE (via status) :
  UPDATE articles SET status = 'archived', updated_at = NOW()
    WHERE id = '...';
  -> Donnee conservee. Restauration possible. Historique intact.
  -> Les requetes filtrent : WHERE status != 'archived'
```

| Méthode | Avantage | Inconvenient |
|---|---|---|
| Hard delete | Espace libéré, simple | Irreversible, casse les FK |
| Soft delete (boolean `deleted`) | Simple | Pas d'états intermédiaires |
| Soft delete (status enum) | États métier (draft, published, archived) | Requiert filtre partout |

Notre CMS utilise le **status enum** car il correspond au workflow editorial :
`draft` -> `scheduled` -> `published` -> `archived`

---

### 5. Architecture dual-database (master + tenant schemas)

```
+-----------------------------------------------------------+
|                    PostgreSQL Cluster                       |
+-----------------------------------------------------------+
|                                                            |
|  MASTER DATABASE (shared)                                  |
|  +------------------------------------------------------+ |
|  | public schema                                        | |
|  |   tenants (id, name, domain, plan, db_schema_name)   | |
|  |   plans (id, name, max_sites, max_storage)           | |
|  |   global_config (key, value)                         | |
|  +------------------------------------------------------+ |
|                                                            |
|  TENANT SCHEMAS (isoles)                                   |
|  +--------------------+  +--------------------+            |
|  | tenant_acme        |  | tenant_globex      |            |
|  |   sites            |  |   sites            |            |
|  |   articles         |  |   articles         |            |
|  |   pages            |  |   pages            |            |
|  |   media            |  |   media            |            |
|  |   users_tenants    |  |   users_tenants    |            |
|  +--------------------+  +--------------------+            |
|                                                            |
+-----------------------------------------------------------+

Isolation :
  1. Schema PostgreSQL (SET search_path = tenant_acme)
  2. Filtre SQL automatique (WHERE site = :currentSiteId)
  3. Prefixe S3 (s3://bucket/tenant_acme/site_1/media/...)
```

**Pourquoi des schemas et pas des bases séparées ?**
- Les schemas partagent le même moteur PostgreSQL = connexion unique
- Les migrations s'appliquent a tous les schemas en boucle
- Le backup peut etre global ou par tenant (`pg_dump -n tenant_acme`)
- Cross-tenant queries possibles en cas de besoin admin (reporting)

---

## Pratique

### CREATE TABLE avec UUID, JSON i18n, version et multi-tenant

```sql
-- Schema d'un tenant (execute dans le contexte SET search_path = tenant_xxx)

-- Table sites : chaque tenant peut avoir plusieurs sites
CREATE TABLE sites (
    -- UUID v4 genere cote application, pas de SERIAL
    -- Pourquoi : prevention IDOR + generation sans round-trip DB
    id         UUID PRIMARY KEY,

    -- Nom interne du site (slug unique dans le tenant)
    slug       VARCHAR(63) NOT NULL UNIQUE,

    -- Nom affichable en multi-langue (JSONB pour indexation et extraction SQL)
    name       JSONB NOT NULL DEFAULT '{"fr": ""}',

    -- Configuration specifique au site (theme, features activees...)
    config     JSONB NOT NULL DEFAULT '{}',

    -- Champs obligatoires partages
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version    INTEGER NOT NULL DEFAULT 1,

    -- Contrainte : le JSON name doit contenir au moins la cle "fr"
    CONSTRAINT chk_name_fr CHECK (name ? 'fr')
);

-- Table articles : contenu editorial avec i18n
CREATE TABLE articles (
    id         UUID PRIMARY KEY,

    -- FK vers le site — isolation multi-site dans le tenant
    site       UUID NOT NULL REFERENCES sites(id),

    -- Champs i18n en JSONB : {"fr": "...", "en": "...", "nl": "..."}
    title      JSONB NOT NULL DEFAULT '{"fr": ""}',
    slug       JSONB NOT NULL DEFAULT '{"fr": ""}',
    body       JSONB NOT NULL DEFAULT '{"fr": ""}',
    excerpt    JSONB NOT NULL DEFAULT '{"fr": ""}',

    -- Status = soft delete + workflow editorial
    -- Pas de boolean 'deleted', on utilise un vrai etat metier
    status     VARCHAR(20) NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),

    -- Date de publication planifiee (nullable si draft)
    published_at TIMESTAMPTZ,

    -- Auteur (reference vers le user du tenant)
    author_id  UUID NOT NULL,

    -- SEO metadata en JSON (title, description, og_image...)
    seo        JSONB NOT NULL DEFAULT '{}',

    -- Champs obligatoires partages
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version    INTEGER NOT NULL DEFAULT 1,

    -- Contrainte : title doit avoir au moins "fr"
    CONSTRAINT chk_title_fr CHECK (title ? 'fr')
);

-- Index pour les requetes frequentes
-- B-tree sur site + status : filtre principal de toute requete
CREATE INDEX idx_articles_site_status ON articles(site, status);

-- Index pour le tri chronologique des articles publies
CREATE INDEX idx_articles_published ON articles(site, published_at DESC)
    WHERE status = 'published';

-- Trigger pour mettre a jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_articles_updated
    BEFORE UPDATE ON articles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

### Entité TypeORM correspondante

```typescript
// src/articles/infrastructure/article.orm-entity.ts
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
  Check,
} from 'typeorm';

// Interface pour les colonnes JSON multi-langue
// Partagee entre toutes les entites du CMS
export interface MultiLangField {
  fr: string;
  en?: string;
  nl?: string;
}

// Enum des statuts — identique a la contrainte CHECK en SQL
// Definir l'enum en TypeScript ET en SQL garantit la coherence
export enum ArticleStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('articles')
@Index('idx_articles_site_status', ['site', 'status'])
@Check(`"status" IN ('draft', 'scheduled', 'published', 'archived')`)
export class ArticleOrmEntity {
  // PrimaryColumn (pas PrimaryGeneratedColumn) : le UUID est genere
  // par l'application, PAS par la base de donnees
  // Cela permet de connaitre l'ID avant l'INSERT (utile pour les events)
  @PrimaryColumn('uuid')
  id: string;

  // FK vers sites — isolation multi-site
  @Column('uuid')
  site: string;

  // Colonnes JSONB pour l'i18n
  // TypeORM mappe automatiquement les objets JS en JSONB PostgreSQL
  @Column({ type: 'jsonb', default: { fr: '' } })
  title: MultiLangField;

  @Column({ type: 'jsonb', default: { fr: '' } })
  slug: MultiLangField;

  @Column({ type: 'jsonb', default: { fr: '' } })
  body: MultiLangField;

  @Column({ type: 'jsonb', default: { fr: '' } })
  excerpt: MultiLangField;

  // Status avec enum TypeScript
  @Column({
    type: 'varchar',
    length: 20,
    default: ArticleStatus.DRAFT,
  })
  status: ArticleStatus;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column('uuid')
  authorId: string;

  @Column({ type: 'jsonb', default: {} })
  seo: Record<string, unknown>;

  // Champs partages obligatoires
  // CreateDateColumn : TypeORM genere automatiquement la valeur a l'INSERT
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  // UpdateDateColumn : TypeORM met a jour automatiquement a chaque save()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // VersionColumn : incremente automatiquement a chaque save()
  // Si la version en base != la version attendue -> OptimisticLockVersionMismatchError
  // C'est l'implementation de l'optimistic locking vu au Cours 26
  @VersionColumn()
  version: number;
}
```

### Service multi-tenant : selection du schema

```typescript
// src/multi-tenant/tenant-connection.service.ts
import { Injectable, Scope } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

// Scope REQUEST : une nouvelle instance par requete HTTP
// Chaque requete travaille dans le schema du tenant correspondant
@Injectable({ scope: Scope.REQUEST })
export class TenantConnectionService {
  private schemaName: string;

  constructor(private readonly dataSource: DataSource) {}

  // Appele par le middleware d'extraction du tenant (depuis le JWT)
  setTenant(tenantSchema: string): void {
    // Validation : empeche l'injection SQL via le nom du schema
    // Seuls les caracteres alphanumeriques et underscores sont autorises
    if (!/^[a-z][a-z0-9_]{2,62}$/.test(tenantSchema)) {
      throw new Error(`Invalid tenant schema name: ${tenantSchema}`);
    }
    this.schemaName = tenantSchema;
  }

  // Retourne un QueryRunner configure pour le schema du tenant
  async getQueryRunner(): Promise<QueryRunner> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    // SET search_path : toutes les requetes SQL de ce QueryRunner
    // seront executees dans le schema du tenant
    // Pas d'injection possible grace a la validation ci-dessus
    await queryRunner.query(
      `SET search_path TO ${this.schemaName}, public`
    );

    return queryRunner;
  }

  // Requete dans le contexte du tenant
  async query<T>(sql: string, params?: unknown[]): Promise<T> {
    const qr = await this.getQueryRunner();
    try {
      return await qr.query(sql, params);
    } finally {
      await qr.release(); // Toujours liberer la connexion
    }
  }
}
```

### Extraction JSON en SQL (requête i18n)

```sql
-- Extraire le titre dans la locale demandee avec fallback sur "fr"
-- COALESCE : si la locale demandee n'existe pas, on tombe sur "fr"
SELECT
    id,
    COALESCE(
        title ->> $1,     -- $1 = locale demandee (ex: 'en')
        title ->> 'fr'    -- Fallback sur le francais
    ) AS title,
    COALESCE(
        excerpt ->> $1,
        excerpt ->> 'fr'
    ) AS excerpt,
    status,
    published_at,
    created_at
FROM articles
WHERE site = $2            -- Isolation multi-site
  AND status = 'published' -- Soft delete : on exclut les archives
ORDER BY published_at DESC
LIMIT 20;

-- Recherche dans le JSON : articles dont le titre FR contient un mot
-- L'operateur ->> extrait le texte, ILIKE fait une recherche insensible a la casse
SELECT id, title ->> 'fr' AS title_fr
FROM articles
WHERE site = $1
  AND status = 'published'
  AND title ->> 'fr' ILIKE '%' || $2 || '%';
```

---

## Résumé

- **UUID v4 comme clé primaire** empeche l'enumeration IDOR, permet la génération côté application (pas de round-trip DB), et fonctionne en multi-node sans conflit de sequence.
- **Les colonnes JSONB** pour l'i18n (`MultiLangField { fr, en, nl }`) evitent les jointures couteuses avec une table de traductions et permettent l'extraction directe en SQL via l'opérateur `->>`.
- **Les 5 champs obligatoires** (`id`, `site`, `created_at`, `updated_at`, `version`) garantissent l'identification, l'isolation multi-site, l'audit temporel et l'optimistic locking sur chaque entité.
- **Le soft delete via status** (`draft → scheduled → published → archived`) remplace la suppression physique — les données sont conservees, restaurables, et le status encode le workflow editorial métier.
- **L'architecture dual-database** (master DB pour les tenants + un schema PostgreSQL par tenant) isole les données, permet les migrations globales, et autorise le backup/restore par tenant via `pg_dump -n`.


---

> **Lien fil rouge — ShopArch**
>
> - Conçois le schéma PostgreSQL de ShopArch avec UUID PKs et timestamps
> - Crée les tables products, categories, orders, order_lines, users
> - Exercice(s) associé(s) : `exercices/17-schema-ecommerce/`
> - Checkpoint : Module 04, critère 1

## Prochain cours

[Cours 28 — Migrations & Content Versioning](./02-migrations-versioning.md)

> On va voir comment faire évoluer le schema de base de données sans interruption de service (expand-contract), et comment implémenter le versioning de contenu avec un système de diffs qui réduit le stockage de 92%.
