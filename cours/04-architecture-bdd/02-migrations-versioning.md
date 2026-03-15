# Cours 28 — Migrations & Content Versioning

> **Objectif** : Maîtriser les migrations de schema (up/down, zero-downtime), implémenter le content versioning diff-based, et gérer les migrations multi-tenant (schema-per-tenant).

---

## Rappel du cours précédent

<details>
<summary>1. Pourquoi utiliser des UUID v4 comme clés primaires plutot que des IDs sequentiels ?</summary>

Les IDs sequentiels exposent un risque **IDOR** (Insecure Direct Object Référence) : un attaquant peut deviner les IDs voisins (id=42 → id=43). Les UUID v4 sont aleatoires et non-devinables. Ils permettent aussi la génération côté client (pas besoin d'aller-retour DB).
</details>

<details>
<summary>2. Qu'est-ce qu'un MultiLangField et comment est-il stocke ?</summary>

Un champ JSON qui contient le même contenu dans plusieurs langues : `{ "fr": "Bonjour", "en": "Hello", "nl": "Hallo" }`. Stocke dans une colonne `JSONB` PostgreSQL, il permet l'i18n au niveau du champ sans multiplier les tables ou les colonnes.
</details>

---

## Analogie — Le journal de bord du navire

Chaque modification de schema est inscrite dans le journal de bord du navire :

- **Migration up** = on note ce qu'on a fait (ajouter une cabine, deplacer le mat)
- **Migration down** = les instructions pour defaire ce changement si nécessaire
- **Le journal est lineaire** : migration 001 → 002 → 003. On ne peut pas appliquer 003 sans avoir applique 001 et 002
- **Zero-downtime** = faire les travaux PENDANT que les passagers sont a bord, sans qu'ils s'en rendent compte

---

## Théorie

### 1. Migrations de schema

Une migration est un script versionne qui modifie le schema de la DB :

```
migrations/
├── 001-create-products.ts          # Creer la table products
├── 002-add-products-description.ts # Ajouter la colonne description
├── 003-create-categories.ts        # Creer la table categories
├── 004-add-fk-product-category.ts  # Ajouter la FK vers categories
└── 005-add-gin-index-search.ts     # Ajouter l'index GIN full-text
```

Chaque migration est appliquee **une seule fois**. Une table `migrations` traque ce qui a déjà ete exécuté.

### 2. Zero-downtime migrations (Expand-Contract)

Le problème : si tu renommes une colonne `name` → `title`, l'ancienne version du code qui utilise `name` va planter pendant le déploiement.

**Solution : Expand-Contract** en 3 étapes sur 3 déploiements :

```
Etape 1 — EXPAND (deploiement 1)
┌───────────────────────────────────────┐
│  ALTER TABLE products                  │
│    ADD COLUMN title VARCHAR(255);      │
│  -- Copier les donnees existantes      │
│  UPDATE products SET title = name;     │
│  -- Trigger pour garder les deux sync  │
│  CREATE TRIGGER sync_name_title ...    │
└───────────────────────────────────────┘
Le code utilise encore "name" — tout fonctionne.

Etape 2 — MIGRATE (deploiement 2)
┌───────────────────────────────────────┐
│  Le nouveau code utilise "title"       │
│  L'ancien code utilise "name"          │
│  Le trigger garde les deux en sync     │
└───────────────────────────────────────┘
Rolling update : les deux versions coexistent.

Etape 3 — CONTRACT (deploiement 3)
┌───────────────────────────────────────┐
│  DROP TRIGGER sync_name_title;         │
│  ALTER TABLE products                  │
│    DROP COLUMN name;                   │
└───────────────────────────────────────┘
Tout le code utilise "title" — on nettoie.
```

### 3. Types de changements de schema

| Changement | Zero-downtime | Stratégie |
|---|---|---|
| Ajouter une colonne nullable | Oui | Simple `ADD COLUMN` |
| Ajouter une colonne NOT NULL | Non sans default | `ADD COLUMN ... DEFAULT 'value'` |
| Renommer une colonne | Non | Expand-Contract (3 steps) |
| Supprimer une colonne | Non | D'abord arreter de la lire, puis `DROP` |
| Changer le type | Non | Expand-Contract |
| Ajouter un index | Oui | `CREATE INDEX CONCURRENTLY` (PostgreSQL) |
| Supprimer une table | Non | S'assurer qu'aucun code ne la référence |

**Regle d'or** : chaque migration doit etre compatible avec la version N ET N-1 du code.

### 4. Content versioning diff-based

Rappel du cours 23, avec les details d'implémentation :

```
Article v1 ──────────────────────────────────────────────┐
 (snapshot)                                               │
 3000 caracteres                                          │
                                                          │
Article v2 ────────────────────────────────────┐          │
 (diff)                                        │          │
 "+paragraph at line 15, -typo at line 3"      │          │
 ~200 caracteres                               │          │
                                               │          │
Article v3 ────────────────────────┐           │          │
 (diff)                            │           │          │
 "+image caption, -old footer"     │           │          │
 ~150 caracteres                   │           │          │
                                   │           │          │
Reconstruction v3 = v1 + diff v2 + diff v3     │          │
Temps : ~5ms pour 10 versions                  │          │
Stockage : 3000 + 200 + 150 = 3350            │          │
vs full snapshots : 3000 x 3 = 9000           │          │
Reduction : ~63% (et ca s'ameliore avec plus de versions) │
```

Quand créer un nouveau snapshot ? Tous les N diffs (ex: toutes les 20 versions) pour limiter le temps de reconstruction.

### 5. Migrations multi-tenant (schema-per-tenant)

```
┌──────────────────────────────────────────┐
│           Migration runner               │
│                                          │
│  1. Lister les tenants actifs            │
│  2. Pour chaque tenant :                 │
│     a. SET search_path = tenant_slug     │
│     b. Appliquer les migrations pending  │
│     c. Logger le resultat                │
│  3. Si un tenant echoue :               │
│     → ROLLBACK ce tenant seulement       │
│     → Continuer les autres               │
│     → Alerter le monitoring              │
└──────────────────────────────────────────┘
```

---

## Pratique

### Migration TypeORM — Expand-Contract

```typescript
// migrations/004-rename-name-to-title.ts

// STEP 1 : Expand — ajouter la nouvelle colonne
export class RenameNameToTitle1709200001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Ajouter la colonne title
    await queryRunner.query(`
      ALTER TABLE products ADD COLUMN title VARCHAR(255)
    `);
    // Copier les donnees existantes
    await queryRunner.query(`
      UPDATE products SET title = name WHERE title IS NULL
    `);
    // Trigger pour garder les deux colonnes synchronisees
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION sync_product_name_title()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' OR NEW.name IS DISTINCT FROM OLD.name THEN
          NEW.title := NEW.name;
        END IF;
        IF TG_OP = 'INSERT' OR NEW.title IS DISTINCT FROM OLD.title THEN
          NEW.name := NEW.title;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_sync_product_name_title
      BEFORE INSERT OR UPDATE ON products
      FOR EACH ROW EXECUTE FUNCTION sync_product_name_title();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_sync_product_name_title ON products`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS sync_product_name_title`);
    await queryRunner.query(`ALTER TABLE products DROP COLUMN IF EXISTS title`);
  }
}

// STEP 3 : Contract — supprimer l'ancienne colonne (deploiement separe)
export class DropNameColumn1709200003 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_sync_product_name_title ON products`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS sync_product_name_title`);
    await queryRunner.query(`ALTER TABLE products DROP COLUMN name`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE products ADD COLUMN name VARCHAR(255)`);
    await queryRunner.query(`UPDATE products SET name = title`);
  }
}
```

### Content versioning — schema et service

```sql
-- Schema pour le versioning
CREATE TABLE article_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id),
  version INTEGER NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('snapshot', 'diff')),
  data TEXT NOT NULL,
  author_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id, version)
);

-- Index pour la reconstruction rapide
CREATE INDEX idx_article_versions_article_version
ON article_versions (article_id, version);
```

```typescript
@Injectable()
export class ArticleVersioningService {
  private readonly SNAPSHOT_INTERVAL = 20; // Nouveau snapshot toutes les 20 versions

  async createVersion(
    articleId: string,
    newContent: string,
    authorId: string,
  ): Promise<void> {
    const versions = await this.versionRepo.find({
      where: { articleId },
      order: { version: 'ASC' },
    });

    const lastVersion = versions[versions.length - 1];
    const nextVersionNumber = lastVersion ? lastVersion.version + 1 : 1;

    if (!lastVersion || nextVersionNumber % this.SNAPSHOT_INTERVAL === 1) {
      // Creer un snapshot complet
      await this.versionRepo.save({
        articleId,
        version: nextVersionNumber,
        type: 'snapshot',
        data: newContent,
        authorId,
      });
    } else {
      // Creer un diff par rapport au contenu actuel
      const currentContent = this.reconstruct(versions, lastVersion.version);
      const diff = this.createDiff(currentContent, newContent);
      await this.versionRepo.save({
        articleId,
        version: nextVersionNumber,
        type: 'diff',
        data: diff,
        authorId,
      });
    }
  }

  reconstruct(versions: ArticleVersion[], targetVersion: number): string {
    // Trouver le snapshot le plus recent <= targetVersion
    const snapshot = versions
      .filter((v) => v.type === 'snapshot' && v.version <= targetVersion)
      .sort((a, b) => b.version - a.version)[0];

    if (!snapshot) throw new Error('No snapshot found');

    let content = snapshot.data;
    const diffs = versions.filter(
      (v) => v.type === 'diff' && v.version > snapshot.version && v.version <= targetVersion,
    );

    for (const diff of diffs.sort((a, b) => a.version - b.version)) {
      content = this.applyDiff(content, diff.data);
    }
    return content;
  }

  private createDiff(oldContent: string, newContent: string): string {
    // Utiliser diff-match-patch ou similar
    const dmp = new diff_match_patch();
    const patches = dmp.patch_make(oldContent, newContent);
    return dmp.patch_toText(patches);
  }

  private applyDiff(content: string, diffText: string): string {
    const dmp = new diff_match_patch();
    const patches = dmp.patch_fromText(diffText);
    const [result] = dmp.patch_apply(patches, content);
    return result;
  }
}
```

### Multi-tenant migration runner

```typescript
@Injectable()
export class TenantMigrationRunner {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantService: TenantService,
    private readonly logger: Logger,
  ) {}

  async runMigrationsForAllTenants(): Promise<MigrationReport> {
    const tenants = await this.tenantService.findAllActive();
    const report: MigrationReport = { success: [], failed: [] };

    for (const tenant of tenants) {
      try {
        // Changer le search_path pour ce tenant
        await this.dataSource.query(
          `SET search_path TO ${tenant.schemaName}, public`,
        );

        // Appliquer les migrations pending
        const migrations = await this.dataSource.runMigrations();

        report.success.push({
          tenantId: tenant.id,
          migrationsRun: migrations.length,
        });

        this.logger.log(
          `Tenant ${tenant.slug}: ${migrations.length} migrations applied`,
        );
      } catch (error) {
        report.failed.push({
          tenantId: tenant.id,
          error: error.message,
        });

        this.logger.error(
          `Tenant ${tenant.slug}: migration failed — ${error.message}`,
        );
        // Continuer avec le prochain tenant — ne pas bloquer tout le monde
      }
    }

    // Restaurer le search_path par defaut
    await this.dataSource.query(`SET search_path TO public`);

    return report;
  }
}
```

---

## Résumé

1. **Migrations versionnees** : chaque changement de schema est un script up/down traçable
2. **Zero-downtime** : utiliser Expand-Contract pour les changements incompatibles (renommage, suppression)
3. **`CREATE INDEX CONCURRENTLY`** en PostgreSQL pour ajouter des index sans bloquer les lectures
4. **Content versioning diff-based** : snapshot initial + diffs = ~92% de réduction de stockage
5. **Multi-tenant migrations** : iterer sur chaque schema, ne pas bloquer les autres en cas d'echec

---

> **Prochain cours** : [Cours 29 — Indexation & Performance](./03-indexation-performance.md) — ou comment choisir et créer les bons index pour des requêtes rapides.

---

> **Lien fil rouge — ShopArch**
>
> - Crée les migrations versionnées pour le schéma ShopArch
> - Vérifie que `npm run db:migrate:undo` fonctionne (migrations réversibles)
> - Exercice(s) associé(s) : `exercices/17-schema-ecommerce/`
> - Checkpoint : Module 04, critère 2
