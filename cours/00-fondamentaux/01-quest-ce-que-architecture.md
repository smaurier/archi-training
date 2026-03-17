# 01 — Qu'est-ce que l'architecture logicielle ?

<!-- nav-cours-précédent -->
> **Cours précédent** : [HTTP & Caching](../../../07-http-caching/modules/15-projet-final.md). Si tu arrives ici sans avoir fait les cours précédents, consulte le [guide de démarrage](../../../GUIDE-DEMARRAGE.md).


## Objectif

A la fin de ce cours, tu sauras **définir ce qu'est l'architecture logicielle**, distinguer le rôle de l'architecte de celui du développeur, et expliquer pourquoi les décisions d'architecture prises tôt dans un projet ont un coût exponentiel si elles sont mal faites.

> **Ressource transversale** : consulte [`00-pieges-frequents-archi.md`](../00-pieges-frequents-archi.md) régulièrement — il liste 20 pièges architecturaux classés par domaine, référencés depuis les cours concernés.

---

## Analogie — L'architecte du bâtiment vs le maçon

Imagine que tu veuilles construire un immeuble.

- Le **maçon** pose les briques, applique le mortier, construit les murs. Il sait parfaitement comment assembler des matériaux.
- L'**architecte** décide : combien d'étages ? Ou sont les escaliers de secours ? Comment les appartements communiquent-ils entre eux ? Comment l'immeuble résiste-t-il aux séismes ?

Le maçon peut construire n'importe quel mur que tu lui demandes. Mais si l'architecte a oublié de prévoir des gaines techniques pour les câbles électriques, **démolir et reconstruire coûtera dix fois plus cher** que de l'avoir prévu dès le début.

En logiciel, c'est exactement pareil :
- Le **développeur** (maçon) écrit du code fonctionnel, implémente des fonctionnalités.
- L'**architecte logiciel** décide de la structure globale, des frontières entre modules, des protocoles de communication, et des compromis entre qualité, coût et délai.

> La différence fondamentale : le maçon répond à "comment faire ?", l'architecte répond à "quoi faire, ou le mettre, et pourquoi".

---

## Théorie

### Définition de l'architecture logicielle

L'architecture logicielle est l'ensemble des **décisions structurantes** qui définissent :

1. Comment le système est **organisé** (composants, modules, couches)
2. Comment ces composants **communiquent** entre eux
3. Quelles **contraintes** s'appliquent (sécurité, performance, scalabilité)
4. Pourquoi ces choix ont été faits (**traçabilité des décisions**)

```
Architecture = Structure + Communication + Décisions + Vision
```

Une définition souvent citée (Martin Fowler) :

> "Architecture is the decisions that are hard to change."
> (L'architecture, ce sont les décisions difficiles à changer.)

### Les 4 dimensions de l'architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   ARCHITECTURE LOGICIELLE                    │
├──────────────┬──────────────┬───────────────┬───────────────┤
│  STRUCTURE   │ COMMUNICATION│  DÉCISIONS    │    VISION     │
│              │              │               │               │
│ Comment les  │ Comment les  │ Pourquoi ces  │ Ou va le      │
│ composants   │ composants   │ choix ont été │ système dans  │
│ sont         │ échangent    │ faits (ADR)   │ 2 ans ?       │
│ organisés    │ données      │               │               │
│              │              │               │               │
│ Ex: couches, │ Ex: REST,    │ Ex: "on a     │ Ex: migration │
│ microservices│ events,      │ choisi SQL    │ vers cloud,   │
│ monolithe    │ queues       │ car..."       │ multi-tenant  │
└──────────────┴──────────────┴───────────────┴───────────────┘
```

#### Dimension 1 : Structure

La structure répond à la question **"Comment organise-t-on le code ?"**

```
Monolithe modulaire       Microservices
──────────────────        ─────────────────────────────

┌──────────────────┐      ┌────────┐  ┌────────┐  ┌────────┐
│   Application    │      │Service │  │Service │  │Service │
│  ┌────────────┐  │      │  A     │  │  B     │  │  C     │
│  │  Module A  │  │      └───┬────┘  └───┬────┘  └───┬────┘
│  ├────────────┤  │          │           │           │
│  │  Module B  │  │          └───────────┴───────────┘
│  ├────────────┤  │                    Bus
│  │  Module C  │  │
│  └────────────┘  │
└──────────────────┘
```

#### Dimension 2 : Communication

La communication répond à **"Comment les pièces se parlent-elles ?"**

| Style | Exemple | Quand l'utiliser |
|---|---|---|
| Synchrone (REST/gRPC) | API HTTP | Réponse immédiate requise |
| Asynchrone (Events) | Kafka, RabbitMQ | Découplage, tolérance de panne |
| In-process (appel direct) | Import TypeScript | Même déploiement |

#### Dimension 3 : Décisions (ADR)

Chaque décision architecturale importante doit être documentée dans un **Architecture Decision Record** (ADR) :

```
ADR-001 : Choix de PostgreSQL vs MongoDB
─────────────────────────────────────────
Contexte : Notre application stocke des données relationnelles
           avec des transactions ACID requises.

Décision : PostgreSQL

Conséquences :
  ✓ Transactions ACID garanties
  ✓ Requêtes complexes avec JOINs
  ✗ Schéma rigide (migrations nécessaires)
  ✗ Moins flexible pour données non-structurées
```

Nous verrons les ADR en détail dans le cours 06.

#### Dimension 4 : Vision

L'architecture n'est pas un snapshot figé, c'est une **trajectoire**. L'architecte doit anticiper :
- La croissance du trafic
- L'évolution des fonctionnalités
- Le turnover des équipes
- L'évolution des technologies

---

### Architecture vs Design

Ces deux termes sont souvent confondus. Voici la distinction pratique :

```
ARCHITECTURE                          DESIGN
────────────────────────────────      ──────────────────────────────────
Décisions à fort impact               Décisions locales
Difficiles à changer après coup       Faciles à refactorer
Concernent plusieurs équipes          Concernent un développeur / fichier
Ex: choix de base de données,         Ex: nommage des fonctions,
    découpage en services,                structure d'une classe,
    protocole d'authentification           algorithme de tri
```

En pratique, la ligne est floue. Martin Fowler dit que la distinction est souvent **une question de contexte** : ce qui est "design" pour une grande entreprise peut être "architecture" pour une startup.

---

### Les types d'architectes

```
┌─────────────────────────────────────────────────────────────────┐
│                         CTO / VP Engineering                     │
│                    (stratégie, budget, équipes)                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
    ┌─────────────────┐ ┌──────────────┐ ┌──────────────────┐
    │   Architecte    │ │  Architecte  │ │   Architecte     │
    │   Enterprise    │ │   Solution   │ │   Application    │
    │                 │ │              │ │  (Tech Lead)     │
    │ Vue globale de  │ │ Conçoit une  │ │ Conçoit une      │
    │ l'organisation  │ │ solution pour│ │ application ou   │
    │ IT de l'entrep. │ │ un projet    │ │ un service       │
    │                 │ │              │ │                  │
    │ Horizon: 3-5 ans│ │Horizon: 1 an │ │Horizon: sprint   │
    └─────────────────┘ └──────────────┘ └──────────────────┘
```

Dans ce cours, nous nous concentrons sur les compétences de **l'architecte application / solution**, qui sont les plus directement utiles pour un développeur senior ou tech lead.

---

### Pourquoi l'architecture est importante — La courbe du coût du changement

C'est l'argument le plus puissant pour justifier l'investissement en architecture.

```
Coût de
changer
   │
   │                                              ●
   │                                         ●
   │                                    ●
   │                               ●
   │                          ●
   │                    ●
   │              ●
   │        ●
   │   ●
   │● ─────────────────────────────────────────────────────
   └─────────────────────────────────────────────────────► Temps
     Analyse  Design  Code  Test  Prod  Maintenance
```

**Plus on découvre un problème d'architecture tard, plus il coûte cher à corriger.**

Exemples concrets :

| Problème détecté en... | Coût relatif | Exemple |
|---|---|---|
| Analyse / Design | 1x | Changer un schéma sur papier = 5 minutes |
| Développement | 6x | Changer une interface partagée = refactoring |
| Tests | 15x | Changer une dépendance couplée = réécriture |
| Production | 100x | Migrer une base de données en production = projet à part entière |

> Investir en architecture tôt n'est pas un luxe, c'est une **optimisation économique**.

---

### L'architecture "juste suffisante"

Attention : l'architecture ne doit pas non plus devenir une fin en soi. Le syndrome de **l'over-engineering** est aussi dangereux que l'absence d'architecture.

```
Risque              Sous-architecture         Sur-architecture
────────────────    ─────────────────────     ──────────────────────────
Code spaghetti      ✗✗                        ─
Dette technique     ✗✗                        ─
Rigidité            ─                         ✗✗
Complexité inutile  ─                         ✗✗
Temps de livraison  ✓ (court terme)           ✗ (long terme)
Maintenabilité      ✗                         ✗ (différente raison)
```

La règle d'or : **"Architecture last responsible moment"** — décide le plus tard possible ce qui peut être décidé plus tard, mais décide tôt ce qui est vraiment structurant.

---

## Pratique

Voici un exemple de code TypeScript illustrant la différence entre une décision d'**architecture** et une décision de **design** :

```typescript
// ============================================================
// DÉCISION D'ARCHITECTURE : Comment les couches communiquent ?
// C'est difficile à changer après coup.
// ============================================================

// Approche A : Accès direct à la base de données depuis le contrôleur
// ⚠️ Mauvaise architecture — le contrôleur est couplé à l'ORM
class ArticleController {
  async getArticle(id: string) {
    // Dépendance directe sur TypeORM — si on change d'ORM, on réécrit tout
    const article = await AppDataSource.getRepository(Article).findOne({ where: { id } });
    return article;
  }
}

// Approche B : Séparation par couches (Repository Pattern)
// ✓ Bonne architecture — le contrôleur ne sait pas comment les données sont stockées
interface ArticleRepository {
  findById(id: string): Promise<Article | null>;
}

class ArticleController {
  // L'architecte a décidé : le contrôleur reçoit une abstraction, pas une implémentation
  constructor(private readonly articleRepo: ArticleRepository) {}

  async getArticle(id: string) {
    return this.articleRepo.findById(id); // Fonctionne avec PostgreSQL, MongoDB, ou un mock
  }
}

// ============================================================
// DÉCISION DE DESIGN : Nommage et structure interne
// Facile à changer avec un refactoring.
// ============================================================

// Design A : nommage peu clair
async function get(x: string) {
  return repo.find(x);
}

// Design B : nommage expressif — simple refactoring, pas d'impact architectural
async function getArticleById(articleId: string): Promise<Article | null> {
  return this.articleRepository.findById(articleId);
}
```

**Observation clé** : Si demain tu décides de passer de TypeORM à Prisma, avec l'approche B tu changes uniquement l'implémentation du `ArticleRepository` — le contrôleur ne change pas. Avec l'approche A, tu dois modifier chaque contrôleur. C'est la valeur concrète d'une bonne décision architecturale.

---

## Résumé

- L'**architecture logicielle** est l'ensemble des décisions structurantes difficiles à changer, qui définissent la structure, la communication, les décisions et la vision d'un système.
- L'**architecte** répond à "quoi faire et pourquoi", le **développeur** répond à "comment faire" — mais en pratique, tout développeur senior prend des décisions architecturales.
- Les 4 dimensions de l'architecture : **Structure** (organisation), **Communication** (échanges), **Décisions** (ADR), **Vision** (trajectoire).
- La **courbe du coût du changement** montre qu'un problème d'architecture détecté en production coûte 100x plus cher qu'en phase de design.
- L'objectif n'est pas l'architecture parfaite, mais l'architecture **juste suffisante** : éviter l'over-engineering autant que le sous-engineering.


---

> **Lien fil rouge — ShopArch**
>
> - Identifie les 5 Bounded Contexts de ShopArch (Catalog, Cart, Order, Payment, User)
> - Dessine un schéma des dépendances entre ces contexts
> - Exercice(s) associé(s) : `exercices/04-tradeoff-analysis/`
> - Checkpoint : Module 00, critère 4

## Prochain cours

[02 — Les principes SOLID](./02-principes-solid.md)

> Dans le prochain cours, nous verrons les 5 principes SOLID, le socle de tout code maintenable et extensible. Chaque principe sera illustré avec une analogie du monde réel et une comparaison code "avant / après".
