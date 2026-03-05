# 06 — Raisonner en architecte

## Objectif

A la fin de ce cours, tu sauras **raisonner comme un architecte logiciel** : identifier et évaluer les caractéristiques d'architecture (-ilities), realiser des analyses de trade-offs, utiliser une matrice impact/effort, définir des fitness functions, et documenter tes decisions dans des Architecture Decision Records (ADR). C'est la synthese du module 00.

---

## Rappel du cours précédent

Teste ta mémoire avant de continuer.

**Question 1 — Quelle est la différence entre un scope Singleton et un scope Request-scoped en DI ? Donne un exemple de risque si on les melange.**

<details>
<summary>Réponse</summary>

- **Singleton** : une seule instance pour toute la durée de vie de l'application. Partage entre toutes les requêtes. Usage : services stateless (config, logger, pool de connexions).
- **Request-scoped** : une instance par requête HTTP. Detruite a la fin de la requête. Usage : services avec état par requête (contexte utilisateur, transaction DB).

Risque de melange — "Captive dependency" : si un Singleton injecte un Request-scoped, le Request-scoped est capture pour toute la vie du Singleton. Il devient de facto un Singleton, et les données d'un utilisateur peuvent fuiter vers un autre — faille de sécurité grave.
</details>

**Question 2 — Pourquoi l'anti-pattern Service Locator rend-il les tests difficiles, alors que l'injection par constructeur les facilite ?**

<details>
<summary>Réponse</summary>

- **Service Locator** : les dépendances sont cachees a l'interieur de la classe. Pour tester, il faut configurer un registre global avant chaque test, et le nettoyer apres (risque d'interference entre tests). On ne peut pas voir de l'exterieur ce dont la classe a besoin.

- **Injection par constructeur** : toutes les dépendances sont declarees publiquement dans la signature du constructeur. Pour tester, on instancie simplement la classe en passant des mocks : `new ArticleService(mockRepo, mockBus, mockLogger)`. Pas de configuration globale, pas de nettoyage, pas d'effets de bord.
</details>

---

## Analogie — Le triangle qualité / cout / delai

Tout chef de projet connait le triangle magique : **qualité, cout, delai — choisissez deux**.

```
            QUALITE
               ▲
              / \
             /   \
            /     \
           /       \
          /  ON NE  \
         /  PEUT PAS \
        /  AVOIR LES  \
       /   TROIS A LA  \
      /     FOIS        \
     ─────────────────────
   COUT                DELAI
```

Un architecte raisonne exactement de la meme facon, mais avec des **caractéristiques d'architecture** :
- Veux-tu de la scalabilité ? Ca coutera en complexité operationnelle.
- Veux-tu de la cohérence forte ? Ca coutera en disponibilité.
- Veux-tu de la simplicite ? Ca coutera en flexibilité future.

**Il n'existe pas de bonne architecture — il existe des architectures dont les compromis sont bien compris et explicitement choisis.**

---

## Théorie

### Les caractéristiques d'architecture — les "-ilities"

Les caractéristiques d'architecture (ou "quality attributes") sont les propriétés non-fonctionnelles d'un système. On les appelle les "-ilities" parce que beaucoup se terminent en "-ite" ou "-ibilite" en francais.

```
┌─────────────────────────────────────────────────────────────────────┐
│                  CARACTERISTIQUES D'ARCHITECTURE                    │
├──────────────────────────────┬──────────────────────────────────────┤
│  OPERATIONNELLES             │  STRUCTURELLES                       │
│  (visibles a l'execution)    │  (visibles dans le code)             │
├──────────────────────────────┼──────────────────────────────────────┤
│  Disponibilite               │  Maintenabilite                      │
│  Scalabilite                 │  Testabilite                         │
│  Performance                 │  Lisibilite                          │
│  Fiabilite                   │  Modularite                          │
│  Tolerence aux pannes        │  Couplage faible                     │
│  Recuperabilite              │  Cohesion forte                      │
├──────────────────────────────┼──────────────────────────────────────┤
│  TRANSVERSALES               │  LIEES AU DOMAINE                    │
├──────────────────────────────┼──────────────────────────────────────┤
│  Securite                    │  Observabilite                       │
│  Conformite (RGPD, SOC2)     │  Auditabilite                        │
│  Internationalisation        │  Extensibilite                       │
│  Accessibilite               │  Portabilite                         │
└──────────────────────────────┴──────────────────────────────────────┘
```

**Regles importantes** :
1. On ne peut pas tout optimiser a la fois — choisir, c'est renoncer.
2. Environ 3 a 7 caractéristiques sont critiques pour un système donne.
3. Les caractéristiques non-selectionnees doivent rester "acceptables", pas nulles.

---

### L'analyse de trade-offs — l'outil central de l'architecte

Un trade-off est un compromis conscient : pour gagner X, on accepte de perdre Y.

**Exemple celebre : le theoreme CAP**

```
                 CONSISTENCY
                 (toutes les lectures voient
                  la derniere ecriture)
                       ▲
                      / \
                     /   \
                    /     \
                   /       \
               CP /         \ CA
               /             \
              /               \
             ─────────────────────────────
  PARTITION              AVAILABILITY
  TOLERANCE              (toute requete recoit
  (le systeme continue   une reponse, meme si
   meme si des noeuds    elle est potentiellement
   ne communiquent plus) obsolete)

  MongoDB : CP  (coherent si partitionne, mais peut refuser des ecrits)
  CouchDB : AP  (disponible si partitionne, mais peut retourner des donnees obsoletes)
  PostgreSQL : CA (coherent + disponible, mais pas partition-tolerant par defaut)
```

**Autre trade-off fondamental : Cohérence vs Disponibilite dans les microservices**

```
APPROCHE                COHERENCE   DISPONIBILITE   COMPLEXITE
──────────────────────────────────────────────────────────────
Saga (evenements)       Eventulle   Haute           Haute
2PC (two-phase commit)  Forte       Faible          Tres haute
Outbox pattern          Forte       Haute           Moyenne
Monolithe modulaire     Forte       Haute           Faible
```

---

### La matrice impact / effort

Avant de prendre une decision d'architecture, evaluez l'impact attendu et l'effort requis :

```
IMPACT ELEVE
     ▲
     │          FAIRE EN PREMIER        PLANIFIER SOIGNEUSEMENT
     │         (gains rapides)          (investissements majeurs)
     │
     │    ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
     │
     │          EVITER                  ACCEPTER SI REQUIS
     │       (perte de temps)           (little value, big cost)
     │
     └────────────────────────────────────────────────────────► EFFORT
   FAIBLE                                                    ELEVE

EXEMPLES CONCRETS (CMS multi-tenant) :
┌──────────────────────────────────────────────────────────────────┐
│  Faire en premier (impact haut, effort faible) :                 │
│    - Ajouter des index sur tenant_id + status                    │
│    - Centraliser la validation dans des Value Objects            │
│    - Ajouter des logs structures (JSON)                          │
│                                                                  │
│  Planifier soigneusement (impact haut, effort eleve) :          │
│    - Migration vers une architecture event-driven                │
│    - Mise en place d'un CDN avec edge caching                    │
│    - Passage en multi-region                                     │
│                                                                  │
│  Eviter (impact faible, effort eleve) :                         │
│    - Reimplementer un ORM maison                                 │
│    - Construire un framework CSS custom                          │
│    - Blockchain pour des logs internes                           │
└──────────────────────────────────────────────────────────────────┘
```

---

### Les fitness functions — mesurer l'architecture

Une fitness function est un **test automatise qui vérifié qu'une caractéristique d'architecture reste respectee** dans le temps. C'est le concept cle du livre "Building Evolutionary Architectures" (Ford, Parsons, Kua).

```
CARACTERISTIQUE        FITNESS FUNCTION
─────────────────────────────────────────────────────────────────────
Performance            Test de charge : P95 < 200ms pour /api/articles
Securite               Scan de dependances : 0 CVE critique en prod
Couplage               Test d'architecture : aucun import de
                       infrastructure dans le domaine
Couverture             Gate CI : coverage > 80%
Disponibilite          SLO monitor : uptime > 99.9% sur 30 jours
Taille des bundles     Build check : bundle JS < 250kb gzippe
Coherence API          Contract tests (Pact) : tous les consumers OK
Accessibilite          Audit Lighthouse : score > 90
```

La puissance des fitness functions : **elles transforment des caractéristiques qualitatives en assertions automatisables**. Si la fitness function passe en CI, l'architecture est respectee. Si elle échoué, le code ne peut pas etre merge.

---

### Architecture Decision Records (ADR)

Un ADR est un document court qui capture **une decision d'architecture importante, son contexte, et ses consequences**. C'est la "traçabilite des decisions" — la quatrieme dimension de l'architecture (cours 01).

```
STRUCTURE D'UN ADR
──────────────────────────────────────────────────────────────────
Titre      : ADR-NNN — Titre court de la decision
Statut     : Proposed | Accepted | Deprecated | Superseded
Date       : YYYY-MM-DD
Auteurs    : noms

Contexte   : Quelles forces et contraintes nous ont amenes a cette
             decision ? Quel est le probleme a resoudre ?

Decision   : Quelle est la decision prise ? (phrase claire)

Consequences : Quelles sont les implications positives et negatives ?
               Quels nouveaux problemes cette decision cree-t-elle ?

Alternatives considerees (optionnel) : pourquoi on ne les a pas choisies
──────────────────────────────────────────────────────────────────
```

**Pourquoi les ADR sont importants** :
- Dans 6 mois, un nouveau développeur ne saura pas pourquoi une decision a ete prise
- Sans ADR, on remet en question des decisions déjà validees (cout cognitif)
- Les ADR evitent de répéter les memes debats
- Ils capturent non seulement la decision mais les **alternatives rejetees**

---

### Les pieges classiques de l'architecte debutant

```
PIEGE                    SYMPTOME                  REMEDE
────────────────────────────────────────────────────────────────────
Resume-Driven Design     Architecture choisie      Baser les decisions
                         pour mettre des mots      sur les besoins
                         sur le CV                 reels mesures

Architecture             Chaque cas d'usage a      Commencer simple,
Astronaute               son propre pattern,        evoluer sur la base
                         abstractions pour des      de vrais problemes
                         problemes inexistants

Cargo Cult               "Netflix utilise des       Adapter l'archi
Architecture             microservices donc         a votre contexte,
                         on le fait aussi"          pas au contexte
                                                   de Netflix

Second System Effect     V2 entierement repensee   Evoluer incrementalement,
                         = projet de 2 ans         ne jamais tout jeter

BDUF (Big Design         Architecture complete      Architecture
Up Front)                avant d'ecrire une        evolutive : decider
                         ligne de code             au "last responsible
                                                   moment"
```

---

## Pratique

```typescript
// ============================================================
// FITNESS FUNCTIONS — Tests d'architecture automatises
// ============================================================

// Un test d'architecture verifie des proprietes structurelles du code
// En TypeScript, on peut implementer des fitness functions simples

// Fitness function 1 : Verifier que les couches ne sont pas violees
// (Infrastructure ne doit pas importer du Domaine)

import * as fs from 'fs';
import * as path from 'path';

function checkLayerViolations(
  sourceLayer: string,
  forbiddenImports: string[]
): string[] {
  const violations: string[] = [];
  const layerDir = path.resolve(process.cwd(), sourceLayer);

  if (!fs.existsSync(layerDir)) return violations;

  const files = fs.readdirSync(layerDir, { recursive: true }) as string[];

  for (const file of files) {
    if (!file.endsWith('.ts')) continue;

    const content = fs.readFileSync(path.join(layerDir, file), 'utf-8');
    for (const forbidden of forbiddenImports) {
      if (content.includes(`from '${forbidden}'`) ||
          content.includes(`from "${forbidden}"`)) {
        violations.push(`${file} importe ${forbidden} (violation)`);
      }
    }
  }

  return violations;
}

// Exemple d'usage dans un test (Jest/Vitest) :
// describe('Architecture fitness functions', () => {
//   it('Le domaine ne doit pas importer de la couche infrastructure', () => {
//     const violations = checkLayerViolations('src/domain', [
//       '@/infrastructure',
//       'typeorm',
//       'pg',
//     ]);
//     expect(violations).toHaveLength(0);
//   });
// });

// ============================================================
// ADR — Structure TypeScript pour gerer les ADRs comme du code
// ============================================================

type AdrStatus = 'proposed' | 'accepted' | 'deprecated' | 'superseded-by';

interface ArchitectureDecisionRecord {
  id: string;               // ADR-001, ADR-002...
  title: string;
  status: AdrStatus;
  date: string;             // ISO 8601
  authors: string[];
  context: string;
  decision: string;
  consequences: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
  alternatives?: Array<{
    option: string;
    reason: string;         // Pourquoi on l'a rejete
  }>;
  supersededBy?: string;    // ID de l'ADR qui remplace celui-ci
}

// Exemple concret : ADR pour le choix de l'ORM dans le CMS
const ADR_001: ArchitectureDecisionRecord = {
  id: 'ADR-001',
  title: 'Choix de TypeORM pour la persistance des donnees',
  status: 'accepted',
  date: '2025-09-15',
  authors: ['alice@givexpert.com', 'bob@givexpert.com'],
  context: `
    Notre CMS multi-tenant sur Symfony/API Platform necessite un ORM
    pour la couche de persistance. Nous avons plusieurs contraintes :
    - Multi-tenancy avec isolation au niveau des donnees (tenant_id)
    - Schema flexible (articles, medias, utilisateurs, roles)
    - Migrations versionnees pour les mises a jour de production
    - Equipe familiere avec les patterns Active Record et Repository
  `,
  decision: `
    Nous utilisons TypeORM avec le pattern Repository pour toute
    la persistance de l'application back-office (React + Node.js).
  `,
  consequences: {
    positive: [
      'Migrations versionnees avec CLI (typeorm migration:run)',
      'Decorateurs TypeScript natifs (@Entity, @Column)',
      'Support du pattern Repository pour le DIP',
      'Community large, maintenanace active',
    ],
    negative: [
      'Schema rigide — migrations requises a chaque changement de modele',
      'Moins performant que des requetes SQL raw pour les rapports complexes',
      'Decorateurs expérimentaux TypeScript (stage 2)',
    ],
    neutral: [
      'Les repositories devront etre implementes manuellement',
      'Les tests utiliseront InMemoryRepository — pas de DB en test unitaire',
    ],
  },
  alternatives: [
    {
      option: 'Prisma',
      reason: 'Syntaxe differente (schema.prisma), moins familiere pour l\'equipe. Migrations moins matures en 2025.',
    },
    {
      option: 'Knex (query builder)',
      reason: 'Trop bas niveau — necessite d\'ecrire toute la couche de mapping manuellement.',
    },
    {
      option: 'SQL raw avec pg',
      reason: 'Pas de migrations versionnees, pas de typage statique des requetes.',
    },
  ],
};

// ============================================================
// ANALYSE DE TRADE-OFFS — Comparaison structuree d'options
// ============================================================

type ScoreMark = 1 | 2 | 3 | 4 | 5; // 1 = mauvais, 5 = excellent

interface ArchitectureOption {
  name: string;
  scores: Record<string, ScoreMark>;
  dealbreakers?: string[]; // caracteristiques qui elimininent l'option
}

interface TradeOffAnalysis {
  decision: string;
  characteristics: Array<{
    name: string;
    weight: number; // importance relative (somme = 1)
    description: string;
  }>;
  options: ArchitectureOption[];
}

function evaluateOptions(analysis: TradeOffAnalysis): Array<{
  name: string;
  weightedScore: number;
  isEliminated: boolean;
  eliminationReason?: string;
}> {
  return analysis.options.map(option => {
    // Verifier les dealbreakers d'abord
    if (option.dealbreakers && option.dealbreakers.length > 0) {
      return {
        name: option.name,
        weightedScore: 0,
        isEliminated: true,
        eliminationReason: option.dealbreakers.join('; '),
      };
    }

    // Calculer le score pondere
    const weightedScore = analysis.characteristics.reduce((total, char) => {
      const score = option.scores[char.name] ?? 3;
      return total + (score * char.weight);
    }, 0);

    return {
      name: option.name,
      weightedScore: Math.round(weightedScore * 10) / 10,
      isEliminated: false,
    };
  }).sort((a, b) => b.weightedScore - a.weightedScore);
}

// Exemple : choisir entre Monolithe modulaire, microservices, et modulith
const architectureChoice: TradeOffAnalysis = {
  decision: 'Choix de l\'architecture pour le CMS v2 (100-500 tenants)',
  characteristics: [
    { name: 'Complexite operationnelle', weight: 0.25, description: 'Difficulte de deploy et maintien' },
    { name: 'Scalabilite independante',  weight: 0.20, description: 'Capacite a scaler chaque composant' },
    { name: 'Vitesse de developpement',  weight: 0.25, description: 'Rapidite a livrer des features' },
    { name: 'Testabilite',               weight: 0.15, description: 'Facilite a tester les composants' },
    { name: 'Coherence des donnees',     weight: 0.15, description: 'Facilite a maintenir la coherence' },
  ],
  options: [
    {
      name: 'Monolithe modulaire',
      scores: {
        'Complexite operationnelle': 5, // simple a deployer
        'Scalabilite independante':  2, // scale tout ou rien
        'Vitesse de developpement':  5, // refactoring facile
        'Testabilite':               4, // tests d'integration simples
        'Coherence des donnees':     5, // transactions ACID
      },
    },
    {
      name: 'Microservices',
      scores: {
        'Complexite operationnelle': 1, // Kubernetes, service mesh, etc.
        'Scalabilite independante':  5, // scale par service
        'Vitesse de developpement':  2, // overhead de coordination
        'Testabilite':               2, // tests d'integration complexes
        'Coherence des donnees':     2, // eventuellement coherent
      },
      dealbreakers: ['Equipe de 4 devs — overhead organisationnel trop eleve pour la taille actuelle'],
    },
    {
      name: 'Modulith (modules independants, deploy unique)',
      scores: {
        'Complexite operationnelle': 4, // un seul deploiement
        'Scalabilite independante':  3, // horizontal scaling du monolithe
        'Vitesse de developpement':  4, // frontieres claires
        'Testabilite':               5, // modules testes independamment
        'Coherence des donnees':     5, // transactions ACID
      },
    },
  ],
};

const results = evaluateOptions(architectureChoice);

console.log('\n=== Analyse de trade-offs ===');
console.log(`Decision : ${architectureChoice.decision}\n`);
results.forEach(result => {
  if (result.isEliminated) {
    console.log(`  ✗ ${result.name} — ELIMINE : ${result.eliminationReason}`);
  } else {
    console.log(`  ${result.weightedScore.toFixed(1)}/5.0  ${result.name}`);
  }
});

// Sortie attendue :
//   4.2/5.0  Modulith (modules independants, deploy unique)
//   3.9/5.0  Monolithe modulaire
//   ✗ Microservices — ELIMINE : Equipe de 4 devs...

// ============================================================
// PREVISION DES CARACTERISTIQUES — Pour le module 01
// ============================================================

// Dans les prochains modules, nous apprendrons a reconnaitre
// ces patterns par leurs caracteristiques :

const architectureCharacteristicsMap: Record<string, {
  strengths: string[];
  weaknesses: string[];
}> = {
  'Architecture en couches': {
    strengths: ['Simplicite', 'Separation des preoccupations', 'Maintenabilite'],
    weaknesses: ['Couplage inter-couches', 'Scalabilite limitee', 'Rigidite'],
  },
  'Hexagonale / Ports & Adapters': {
    strengths: ['Testabilite maximale', 'Independance des frameworks', 'Flexibilite'],
    weaknesses: ['Complexity initiale', 'Overhead pour les petits projets'],
  },
  'Event-Driven': {
    strengths: ['Decouplage', 'Scalabilite', 'Resilience'],
    weaknesses: ['Coherence eventulle', 'Debugging difficile', 'Overhead opérationnel'],
  },
  'CQRS + Event Sourcing': {
    strengths: ['Auditabilite complete', 'Performance en lecture', 'Scalabilite'],
    weaknesses: ['Tres complexe', 'Coherence eventulle', 'Courbe d\'apprentissage'],
  },
};

// Afficher les caracteristiques
for (const [pattern, chars] of Object.entries(architectureCharacteristicsMap)) {
  console.log(`\n${pattern}`);
  console.log(`  Forces   : ${chars.strengths.join(', ')}`);
  console.log(`  Faiblesses : ${chars.weaknesses.join(', ')}`);
}
```

---

## Resume

- L'architecte raisonne en termes de **caractéristiques d'architecture** (-ilities) : performance, scalabilité, maintenabilité, sécurité, testabilité... Environ 3 a 7 sont vraiment critiques pour un système — les autres doivent rester "acceptables".
- Toute decision d'architecture est un **trade-off** conscient : gagner en scalabilité coute en complexité, gagner en cohérence forte coute en disponibilité (theoreme CAP). Il n'existe pas de bonne architecture sans compromis — il existe des compromis bien documentes.
- La **matrice impact/effort** permet de prioriser les decisions : faire en premier ce qui a un impact élevé pour un effort faible, planifier soigneusement les investissements majeurs, et éviter ce qui a un faible impact pour un effort élevé.
- Les **fitness functions** transforment des caractéristiques qualitatives en assertions automatisables : tests de performance, d'architecture (couches), de couverture, de sécurité. Elles s'executent en CI et alertent quand l'architecture derive.
- Les **ADR** (Architecture Decision Records) documentent chaque decision importante avec son contexte, la decision prise, ses consequences positives et negatives, et les alternatives rejetees. C'est la mémoire collective de l'équipe et la protection contre les debats repetes.


---

> **Lien fil rouge — ShopArch**
>
> - Rédige un ADR pour le choix de NestJS vs Fastify vs Express pour ShopArch
> - Identifie les 3 quality attributes prioritaires pour ShopArch (performance, maintenabilité, sécurité)
> - Exercice(s) associé(s) : `exercices/04-tradeoff-analysis/`
> - Checkpoint : Module 00, critère 4

## Prochain cours

[Module 01 — Cours 01 : Architecture en couches](../01-patterns-architecturaux/01-architecture-en-couches.md)

> Tu as maintenant les fondamentaux théoriques. Dans le module 01, nous allons etudier les patterns architecturaux classiques en commençant par l'architecture en couches (Layered Architecture) — le pattern le plus repandu, celui que tu utilises probablement sans le savoir.
