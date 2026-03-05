# Cours 89 — Modernisation Legacy & Anti-Corruption Layer

> **Objectif** : Comprendre les stratégies de modernisation de systèmes legacy (Anti-Corruption Layer, Strangler Fig, intégration patterns), et savoir cohabiter avec un système ancien sur le long terme.

---

## Rappel du cours précédent

<details>
<summary>1. Quelle est la différence entre OT et CRDT pour l'edition collaborative ?</summary>

**OT** (Operational Transform) utilise un serveur central qui transforme les opérations pour maintenir la cohérence (approche Google Docs). **CRDT** (Conflict-free Replicated Data Types) garantit la convergence mathematiquement — chaque opération commute, pas besoin de serveur central, fonctionne offline (approche Figma/Yjs). OT est plus eprouve, CRDT est plus flexible.
</details>

<details>
<summary>2. Qu'est-ce qu'un G-Counter CRDT ?</summary>

Un G-Counter (Grow-only Counter) est le CRDT le plus simple : chaque noeud maintient son propre compteur, le total est la somme de tous. Le merge prend le max de chaque noeud — peu importe l'ordre des merges, le résultat converge vers la meme valeur. Il ne permet que l'incrementation (pas la decrementation).
</details>

---

## Analogie — Renover un immeuble habite

Tu herites d'un immeuble des annees 60. Les locataires y vivent. Tu ne peux pas :
- Demolir et reconstruire (Big Bang) → les locataires sont a la rue
- Tout laisser en l'état → le batiment se degrade

Tu DOIS :
- Construire un **mur coupe-feu** entre les parties renovees et les anciennes (Anti-Corruption Layer)
- Renover **appartement par appartement** (Strangler Fig)
- Maintenir les **deux systèmes de plomberie** temporairement (cohabitation)
- Ne demolir l'ancien que quand le nouveau est **100% operationnel**

---

## Théorie

### 1. Legacy systems — les realites

```
Types de systemes legacy :
  - Mainframe COBOL (banques, assurances)
  - Monolithe PHP/Java (e-commerce, CMS)
  - Base Oracle avec 500 stored procedures
  - Application Visual Basic avec 200K lignes
  - Service qui "fonctionne" mais que personne ne comprend

Pourquoi ne pas tout refaire :
  - Le code legacy contient des ANNEES de regles metier implicites
  - Les edge cases sont geres par du code que personne ne comprend
  - Le Big Bang echoue 70-80% du temps (Gartner)
  - Le business ne peut pas s'arreter pendant la migration
```

### 2. Anti-Corruption Layer (ACL)

```
Le nouveau systeme NE DOIT PAS etre contamine par les concepts du legacy.

Sans ACL :
  New System → appelle directement Legacy API
  → Le nouveau code utilise les types/concepts du legacy
  → Couplage fort → le legacy "contamine" le nouveau

Avec ACL :
  New System → ACL (traduction) → Legacy API
  → L'ACL traduit entre les deux modeles
  → Le nouveau code utilise SES propres concepts
  → Le legacy peut etre remplace sans toucher au nouveau

┌───────────┐    ┌──────────┐    ┌───────────┐
│  Nouveau  │───>│   ACL    │───>│  Legacy   │
│  Systeme  │    │(Adapter, │    │  System   │
│  (Clean   │    │ Facade,  │    │ (Vieux    │
│   Domain) │    │ Mapper)  │    │  modele)  │
└───────────┘    └──────────┘    └───────────┘
```

### 3. Intégration patterns avec le legacy

| Pattern | Description | Quand |
|---|---|---|
| **API Wrapper** | Exposer le legacy via une API REST propre | Legacy accessible par code |
| **Database intégration** | Lire directement la DB du legacy | Pas d'API, lecture seule |
| **File-based** | Echange par fichiers batch (CSV, XML) | Mainframe, legacy sans API |
| **Message Queue** | Echange via MQ (RabbitMQ, IBM MQ) | Async, découplage |
| **Screen scraping** | Parser l'UI du legacy | Dernier recours (fragile) |

```
EVITER : database integration directe
  → Couplage au schema du legacy
  → Schema change → nouveau systeme casse
  → 2 systemes ecrivent dans la meme DB → conflits

PREFERER : API Wrapper ou Message Queue
  → Interface stable, decouplage
```

### 4. Strangler Fig applique au legacy

```
Phase 1 : Proxy devant le legacy
  Clients → Proxy → 100% Legacy

Phase 2 : Premiere feature migree
  Clients → Proxy → 90% Legacy
                   → 10% New (feature A)

Phase 3 : Plus de features migrees
  Clients → Proxy → 50% Legacy
                   → 50% New (features A, B, C)

Phase 4 : Legacy decomissionne
  Clients → Proxy → 100% New

Duree typique : 6 mois → 3 ans selon la complexite
```

### 5. Cohabitation longue durée

```
Realite : la migration peut prendre DES ANNEES
Il faut planifier la cohabitation :

□ Data sync : les deux systemes partagent des donnees → CDC ou dual-write
□ Auth : SSO entre legacy et nouveau (SAML, OIDC)
□ Redirects : URLs legacy → nouveau (301)
□ Feature parity tracking : tableau de bord (migre / en cours / pas commence)
□ Budget : maintenir le legacy COUTE (licences, expertise)
□ Risque : l'equipe legacy part → documenter MAINTENANT
```

### 6. Quand NE PAS moderniser

```
NE PAS moderniser si :
  - Le systeme fonctionne et n'a PAS besoin d'evoluer
  - Le cout de modernisation > le cout de maintenance × 5 ans
  - L'equipe n'a pas les competences pour le nouveau systeme
  - Le produit sera decomissionne dans < 2 ans

"If it ain't broke, don't fix it" est parfois le bon choix.

MODERNISER si :
  - Le systeme BLOQUE de nouvelles fonctionnalites business
  - Le cout de maintenance AUGMENTE chaque annee
  - L'expertise se rarefie (le dev COBOL part a la retraite)
  - Des exigences regulatoires imposent des changements profonds
```

---

## Pratique

### Anti-Corruption Layer implémentation

```typescript
// Le legacy expose des "products" avec un format bizarre
interface LegacyProduct {
  PROD_ID: number;        // ID sequentiel (IDOR risk)
  PROD_NM: string;        // Nom abrege
  PROD_PRC: string;       // Prix en string "29.90"
  PROD_CAT: number;       // Category ID
  PROD_ACT: 'Y' | 'N';   // Actif ?
  PROD_DT: string;        // Date format "20240301"
}

// Notre domain model propre
interface Product {
  id: string;             // UUID
  name: string;
  price: number;
  categoryId: string;
  isActive: boolean;
  createdAt: Date;
}

// Anti-Corruption Layer
@Injectable()
export class ProductACL {
  constructor(
    private readonly legacyClient: LegacyApiClient,
    private readonly idMapper: IdMappingService,
  ) {}

  async findById(id: string): Promise<Product> {
    // Traduire l'UUID vers l'ID legacy
    const legacyId = await this.idMapper.getlegacyId('product', id);

    // Appeler le legacy
    const legacy = await this.legacyClient.getProduct(legacyId);

    // Traduire vers notre modele
    return this.toDomain(legacy);
  }

  async findAll(): Promise<Product[]> {
    const legacyProducts = await this.legacyClient.getAllProducts();
    return Promise.all(legacyProducts.map((lp) => this.toDomain(lp)));
  }

  private async toDomain(legacy: LegacyProduct): Promise<Product> {
    return {
      id: await this.idMapper.getOrCreateUuid('product', legacy.PROD_ID),
      name: legacy.PROD_NM,
      price: parseFloat(legacy.PROD_PRC),
      categoryId: await this.idMapper.getOrCreateUuid('category', legacy.PROD_CAT),
      isActive: legacy.PROD_ACT === 'Y',
      createdAt: this.parseDate(legacy.PROD_DT),
    };
  }

  private parseDate(legacyDate: string): Date {
    // "20240301" → Date
    const year = legacyDate.slice(0, 4);
    const month = legacyDate.slice(4, 6);
    const day = legacyDate.slice(6, 8);
    return new Date(`${year}-${month}-${day}`);
  }
}
```

### ID mapping service

```typescript
// Mapper les IDs sequentiels du legacy vers des UUIDs
@Injectable()
export class IdMappingService {
  constructor(private readonly db: DataSource) {}

  async getOrCreateUuid(entity: string, legacyId: number): Promise<string> {
    // Chercher un mapping existant
    const existing = await this.db.findOne(IdMapping, {
      where: { entity, legacyId },
    });

    if (existing) return existing.uuid;

    // Creer un nouveau mapping
    const uuid = crypto.randomUUID();
    await this.db.save(IdMapping, { entity, legacyId, uuid });

    return uuid;
  }

  async getlegacyId(entity: string, uuid: string): Promise<number> {
    const mapping = await this.db.findOne(IdMapping, {
      where: { entity, uuid },
    });

    if (!mapping) {
      throw new NotFoundException(`No legacy mapping for ${entity}:${uuid}`);
    }

    return mapping.legacyId;
  }
}
```

### Migration progress dashboard

```typescript
interface MigrationStatus {
  feature: string;
  status: 'legacy' | 'migrating' | 'new' | 'decommissioned';
  legacyEndpoints: string[];
  newEndpoints: string[];
  dataSync: 'none' | 'one-way' | 'bidirectional';
  migratedAt?: Date;
}

const migrationDashboard: MigrationStatus[] = [
  {
    feature: 'Product Catalog',
    status: 'new',
    legacyEndpoints: ['/legacy/products'],
    newEndpoints: ['/api/v2/products'],
    dataSync: 'none',
    migratedAt: new Date('2024-06-15'),
  },
  {
    feature: 'Order Management',
    status: 'migrating',
    legacyEndpoints: ['/legacy/orders'],
    newEndpoints: ['/api/v2/orders'],
    dataSync: 'bidirectional', // Les deux systemes partagent les commandes
  },
  {
    feature: 'User Management',
    status: 'legacy',
    legacyEndpoints: ['/legacy/users'],
    newEndpoints: [],
    dataSync: 'none',
  },
];
```

---

## Resume

1. **Anti-Corruption Layer** : facade de traduction entre le nouveau et le legacy — le nouveau code NE DOIT PAS utiliser les concepts du legacy
2. **Intégration patterns** : API Wrapper (préféré) > Message Queue > File-based > Database (éviter) > Screen scraping (dernier recours)
3. **Strangler Fig** : migrer feature par feature derriere un proxy — durée typique 6 mois a 3 ans
4. **Cohabitation** : planifier le data sync, l'auth partagee (SSO), les redirects, et le budget de maintenance du legacy
5. **Ne pas moderniser** si le système fonctionne, ne bloque rien, et sera decomissionne bientot — "if it ain't broke, don't fix it"

---

> **Fin du parcours** — Tu as parcouru 89 cours et explore l'architecture logicielle de bout en bout. L'architecture n'est pas une destination, c'est un voyage continu. Continue a apprendre, experimenter, et surtout : construire.

---

> **Lien fil rouge — ShopArch**
>
> - Implémente l'Anti-Corruption Layer entre ShopArch et un ERP legacy simulé
> - L'ACL traduit les formats ERP (XML SOAP) en domain objects ShopArch
> - Exercice(s) associé(s) : `exercices/59-anti-corruption-layer/`
> - Checkpoint : Module 13, critère 3
