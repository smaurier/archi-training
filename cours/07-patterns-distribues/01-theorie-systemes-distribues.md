# Cours 49 — Théorie des systèmes distribues (CAP, PACELC)

> **Objectif** : Comprendre le theoreme CAP et son extension PACELC, maîtriser les modèles de consistance (strong, eventual, causal, session), découvrir le consensus distribue (Raft), et connaitre les erreurs classiques de raisonnement sur les systèmes distribues.

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce que le pattern BFF (Backend for Frontend) et quel problème resout-il ?</summary>

Le BFF est un backend dédié a un client spécifique (web, mobile, admin). Il agrege les appels a plusieurs microservices en une seule réponse adaptee au client, géré les tokens d'authentification côté serveur (évité de les exposer au navigateur), et isole la logique de presentation du backend. Chaque client a son propre BFF — on évité le "one API to rule them all" qui finit par convenir a personne.
</details>

<details>
<summary>2. Quelle est la différence entre un API Gateway et un Service Mesh ?</summary>

L'**API Gateway** est un point d'entree unique pour le trafic Nord-Sud (clients → services) : routing, auth, rate limiting, response aggregation. Le **Service Mesh** (Istio, Linkerd) géré le trafic Est-Ouest (service → service) : mTLS transparent, circuit breaker, observabilité via sidecar proxy. L'API Gateway connait la logique métier, le Service Mesh est purement infrastructure.
</details>

---

## Analogie — Les horloges dans les gares

En 1880, chaque gare europeenne affichait sa propre heure locale. Le train de Paris arrivait a Lyon, mais l'horloge de Lyon n'etait pas synchronisee avec celle de Paris. Comment coordonner un réseau de 100 gares sans telephone fiable ?

- **Le telegraphe tombe en panne** (partition réseau) → chaque gare doit fonctionner seule
- **Deux gares divergent** (consistance) → le train de 14h arrive a 13h50 selon Lyon
- **On arrete le trafic pour synchroniser** (sacrifier la disponibilité) → aucun train ne part
- **On accepte un decalage de 5 min** (eventual consistency) → les trains circulent, les horloges convergent lentement

C'est exactement le dilemme CAP : quand le réseau coupe entre deux noeuds, tu dois choisir entre disponibilité et cohérence.

---

## Théorie

### 1. Le theoreme CAP (Brewer, 2000)

Un système distribue ne peut garantir simultanement que 2 des 3 propriétés suivantes :

```
              Consistency (C)
                  /\
                 /  \
                /    \
               / CP   \
              /  zone  \
             /          \
            /────────────\
           /   CA zone    \
          / (pas de        \
         /  partition)      \
        /                    \
       /─────────────────────\
Availability (A)    Partition Tolerance (P)
              AP zone
```

| Propriété | Définition | Exemple concret |
|---|---|---|
| **Consistency** | Tout read renvoie la dernière écriture | Solde bancaire identique sur tous les ATM |
| **Availability** | Tout noeud non-crash repond | Le site e-commerce ne renvoie jamais 503 |
| **Partition Tolerance** | Le système survit a une coupure réseau entre noeuds | Le datacenter Paris et Lyon sont deconnectes |

**Pourquoi "pick 2" est trompeur** : en production, les partitions réseau **arrivent** (cables coupes, switches defaillants, timeout DNS). On ne "choisit" pas P — on le subit. Le vrai choix est : quand une partition survient, tu sacrifies **C** ou **A**.

| Choix | Sigle | Comportement pendant partition | Exemples |
|---|---|---|---|
| Consistance + Partition | **CP** | Refuse les écritures si pas de quorum | PostgreSQL (single master), MongoDB (write concern majority), ZooKeeper |
| Disponibilite + Partition | **AP** | Accepte les écritures, merge plus tard | Cassandra, DynamoDB, CouchDB, DNS |
| Consistance + Disponibilite | **CA** | N'existe pas en distribue (pas de partition possible) | PostgreSQL single node (pas distribue) |

### 2. PACELC — l'extension pragmatique

CAP ne decrit que le cas de partition. PACELC (Abadi, 2012) ajoute le cas normal :

```
Si Partition → choix A ou C
Sinon (Else) → choix Latency ou Consistency

PACELC = PA/EL, PA/EC, PC/EL, PC/EC
```

| Système | Partition → | Else → | Classification |
|---|---|---|---|
| PostgreSQL (single master) | PC (refuse writes) | EC (consistance forte) | PC/EC |
| Cassandra (quorum=ONE) | PA (accepte writes) | EL (latence basse) | PA/EL |
| MongoDB (majority) | PC (refuse si pas quorum) | EC (consistance forte) | PC/EC |
| DynamoDB (eventual read) | PA (accepte) | EL (latence basse) | PA/EL |
| Cosmos DB (strong) | PC (refuse) | EC (consistance forte) | PC/EC |
| Cosmos DB (eventual) | PA (accepte) | EL (latence basse) | PA/EL |

**Point cle** : la plupart du temps il n'y a pas de partition. Le choix Latency vs Consistency est le choix quotidien que tu fais a chaque requête.

### 3. Modèles de consistance

Du plus fort au plus faible :

```
  Linearizability (Strong)
       │
       │  "Chaque read voit la derniere ecriture, globalement"
       │
  Sequential Consistency
       │
       │  "L'ordre des ops de chaque process est respecte"
       │
  Causal Consistency
       │
       │  "Si A cause B, tout le monde voit A avant B"
       │
  Session Consistency
       │
       │  "Dans MA session, je vois mes propres ecritures"
       │
  Eventual Consistency
       │
       │  "Tous les replicas convergent... un jour"
       │
  (Aucune garantie)
```

| Modèle | Garantie | Latence | Cas d'usage |
|---|---|---|---|
| **Strong (Linearizable)** | Derniere écriture visible partout | Elevee (quorum) | Solde bancaire, stock critique |
| **Causal** | Relations cause→effet respectees | Moyenne | Fils de commentaires, chat |
| **Session** | Read-your-own-writes dans la session | Basse | Profil utilisateur apres edition |
| **Eventual** | Convergence a terme (~ms a ~s) | Tres basse | Compteurs likes, analytics, CDN |

### 4. Le problème des deux généraux (Two Generals Problem)

```
General A ─────── territoire ennemi ─────── General B

  "Attaquons a l'aube !"
       ─────────────────────>
              (messager 1, capture ?)

  "OK, on attaque a l'aube"
       <─────────────────────
              (messager 2, capture ?)

  "Confirmation recu !"
       ─────────────────────>
              (messager 3, capture ?)

  ... (boucle infinie d'acquittements)
```

**Conclusion** : il est **impossible** de garantir un accord sur un canal de communication non fiable. C'est un theoreme (prouve mathematiquement), pas une limitation technique. En pratique : on utilise des timeouts, des retries et des idempotence keys pour s'en approcher.

### 5. Consensus distribue — Raft (conceptuel)

Raft resout le problème de consensus dans un cluster de N noeuds :

```
                    ┌──────────┐
                    │  Leader   │  ← Seul a traiter les ecritures
                    │  (node 1) │
                    └────┬─────┘
                         │
           ┌─────────────┼─────────────┐
           ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ Follower │  │ Follower │  │ Follower │
    │ (node 2) │  │ (node 3) │  │ (node 4) │
    └──────────┘  └──────────┘  └──────────┘

Election :
  1. Un follower ne recoit plus de heartbeat du leader
  2. Il se declare "candidate" et demande des votes
  3. Majorite des votes → il devient le nouveau leader
  4. Tolerant a N/2 - 1 pannes (3 noeuds → 1 panne)
```

| Concept | Description |
|---|---|
| **Leader** | Seul a accepter les écritures, répliqué aux followers |
| **Term** | Numero d'epoque, incremente a chaque election |
| **Log réplication** | Le leader envoie chaque entree aux followers, commit quand majorite |
| **Quorum** | Majorite stricte (3/5, 2/3) — empeche le split-brain |

### 6. Les 8 erreurs du calcul distribue (Fallacies)

| # | Erreur | Realite |
|---|---|---|
| 1 | Le réseau est fiable | Paquets perdus, cables coupes, BGP leaks |
| 2 | La latence est nulle | 1ms local, 50ms cross-datacenter, 150ms cross-continent |
| 3 | La bande passante est infinie | Saturation lors de pics, throttling cloud |
| 4 | Le réseau est sécurisé | MITM, sniffing, DNS spoofing |
| 5 | La topologie ne change pas | Auto-scaling, failover, deplacement de pods |
| 6 | Il y a un seul admin | Multi-équipe, multi-cloud, SRE + devs |
| 7 | Le cout de transport est nul | Serialisation, TLS, load balancer overhead |
| 8 | Le réseau est homogene | 10Gbps intra-DC, 100Mbps inter-DC, 4G mobile |

**Regle pragmatique** : chaque appel réseau peut échouer, prendre 100x plus de temps que prevu, ou renvoyer des données obsoletes. Code defensivement.

---

## Pratique

### Simuler les garanties de consistance

```typescript
// consistency-simulator.ts
// Illustre la difference entre strong et eventual consistency

interface ReplicaNode {
  id: string;
  data: Map<string, { value: string; timestamp: number }>;
}

class DistributedStore {
  private nodes: ReplicaNode[];
  private replicationDelayMs: number;

  constructor(nodeCount: number, replicationDelayMs: number) {
    this.nodes = Array.from({ length: nodeCount }, (_, i) => ({
      id: `node-${i + 1}`,
      data: new Map(),
    }));
    this.replicationDelayMs = replicationDelayMs;
  }

  // --- Strong Consistency (quorum write + quorum read) ---
  async writeStrong(key: string, value: string): Promise<void> {
    const quorum = Math.floor(this.nodes.length / 2) + 1;
    const timestamp = Date.now();
    let acks = 0;

    for (const node of this.nodes) {
      node.data.set(key, { value, timestamp });
      acks++;
      if (acks >= quorum) break; // Quorum atteint → confirmer
    }

    // Replication asynchrone aux restants
    this.replicateAsync(key, value, timestamp, quorum);
  }

  async readStrong(key: string): Promise<string | null> {
    const quorum = Math.floor(this.nodes.length / 2) + 1;
    const responses: { value: string; timestamp: number }[] = [];

    for (const node of this.nodes) {
      const entry = node.data.get(key);
      if (entry) responses.push(entry);
      if (responses.length >= quorum) break;
    }

    if (responses.length === 0) return null;
    // Retourner la valeur avec le timestamp le plus recent
    return responses.sort((a, b) => b.timestamp - a.timestamp)[0].value;
  }

  // --- Eventual Consistency (write to one, replicate later) ---
  async writeEventual(key: string, value: string): Promise<void> {
    const timestamp = Date.now();
    // Ecrire sur un seul noeud (le plus proche)
    this.nodes[0].data.set(key, { value, timestamp });

    // Replication asynchrone (simulee avec setTimeout)
    this.replicateAsync(key, value, timestamp, 1);
  }

  async readEventual(key: string, nodeIndex: number): Promise<string | null> {
    // Lire depuis un noeud specifique (pas forcement a jour)
    const entry = this.nodes[nodeIndex]?.data.get(key);
    return entry?.value ?? null;
  }

  private async replicateAsync(
    key: string,
    value: string,
    timestamp: number,
    startFrom: number,
  ): Promise<void> {
    for (let i = startFrom; i < this.nodes.length; i++) {
      setTimeout(() => {
        const existing = this.nodes[i].data.get(key);
        // Last-write-wins : ne mettre a jour que si plus recent
        if (!existing || existing.timestamp < timestamp) {
          this.nodes[i].data.set(key, { value, timestamp });
        }
      }, this.replicationDelayMs * (i + 1));
    }
  }
}

// --- Usage : demonstrer la difference ---
async function demo() {
  const store = new DistributedStore(3, 100); // 3 noeuds, 100ms de lag

  // Strong consistency : tous les reads voient la meme valeur
  await store.writeStrong('balance', '1000');
  const strong = await store.readStrong('balance');
  console.log(`Strong read: ${strong}`); // → "1000" (garanti)

  // Eventual consistency : un noeud peut etre en retard
  await store.writeEventual('likes', '42');
  const node0 = await store.readEventual('likes', 0); // → "42" (noeud d'ecriture)
  const node2 = await store.readEventual('likes', 2); // → null (pas encore replique)
  console.log(`Eventual node 0: ${node0}, node 2: ${node2}`);
}
```

### Classifier des systèmes reels (exercice type)

```typescript
// cap-classifier.ts
// Pour chaque systeme, determiner sa classification CAP et PACELC

interface SystemProfile {
  name: string;
  duringPartition: 'CP' | 'AP';
  elseTradeoff: 'EL' | 'EC';
  consistencyModel: 'strong' | 'causal' | 'session' | 'eventual';
  explanation: string;
}

const systems: SystemProfile[] = [
  {
    name: 'PostgreSQL (single master)',
    duringPartition: 'CP',
    elseTradeoff: 'EC',
    consistencyModel: 'strong',
    explanation:
      'Un seul master accepte les ecritures. Si le master est injoignable, ' +
      'les ecritures sont refusees (CP). En fonctionnement normal, chaque ' +
      'read voit la derniere ecriture (EC).',
  },
  {
    name: 'Redis Cluster',
    duringPartition: 'AP',
    elseTradeoff: 'EL',
    consistencyModel: 'eventual',
    explanation:
      'Redis utilise une replication asynchrone. Pendant une partition, ' +
      'les ecritures sont acceptees sur le master local (AP). ' +
      'En normal, la latence est priorisee sur la consistance (EL).',
  },
  {
    name: 'Elasticsearch',
    duringPartition: 'AP',
    elseTradeoff: 'EL',
    consistencyModel: 'eventual',
    explanation:
      'Elasticsearch indexe de maniere asynchrone. Un document ecrit ' +
      'n\'est pas immediatement searchable (~1s refresh). ' +
      'La disponibilite prime sur la consistance.',
  },
  {
    name: 'Notre CMS multi-tenant',
    duringPartition: 'CP',
    elseTradeoff: 'EC',
    consistencyModel: 'session',
    explanation:
      'PostgreSQL single master pour les ecritures (CP/EC). ' +
      'Mais le cache Redis et le CDN font de l\'eventual consistency ' +
      'pour les lectures publiques. Read-your-own-writes garanti ' +
      'en session via le master direct apres ecriture.',
  },
];

function printClassification(system: SystemProfile): void {
  console.log(`\n--- ${system.name} ---`);
  console.log(`  CAP      : ${system.duringPartition}`);
  console.log(`  PACELC   : ${system.duringPartition}/${system.elseTradeoff}`);
  console.log(`  Modele   : ${system.consistencyModel}`);
  console.log(`  Raison   : ${system.explanation}`);
}

systems.forEach(printClassification);
```

---

## Resume

1. **CAP** : en cas de partition réseau (inevitable en distribue), tu choisis entre Consistance (CP) et Disponibilite (AP) — jamais les trois a la fois
2. **PACELC** : sans partition, le choix quotidien est Latence vs Consistance — la plupart des systèmes choisissent EL (latence basse)
3. **Modèles de consistance** : strong (linearizable) pour la finance, eventual pour les likes, session consistency (read-your-own-writes) pour les UX courantes
4. **Two Generals Problem** : il est mathematiquement impossible de garantir un accord sur un canal non fiable — on s'en approche avec timeouts, retries et idempotence
5. **8 Fallacies** : le réseau n'est ni fiable, ni rapide, ni gratuit, ni sécurisé — chaque appel réseau peut échouer et doit etre code defensivement

---

> **Prochain cours** : [Cours 50 — CQRS](./02-cqrs.md) — ou comment séparer les chemins de lecture et d'écriture pour optimiser chaque côté independamment.

---

> **Lien fil rouge — ShopArch**
>
> - Classifie chaque composant ShopArch selon le théorème CAP (CP ou AP)
> - Identifie les single points of failure dans l'architecture ShopArch
> - Exercice(s) associé(s) : `exercices/32-cap-classifier/`
> - Checkpoint : Module 07, critère 1
