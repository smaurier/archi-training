# Cours 88 — Collaboration temps reel (CRDT, OT)

> **Objectif** : Comprendre le problème de la concurrence d'edition, différencier Operational Transform (OT) et CRDT, implémenter un CRDT simple, et connaitre les libraries de production (Yjs, Automerge).

---

## Rappel du cours précédent

<details>
<summary>1. Pourquoi l'edge processing réduit-il 99%+ du trafic réseau IoT ?</summary>

Au lieu d'envoyer chaque mesure brute au cloud (50 capteurs × 1/s = 4.3M messages/jour), l'edge gateway agrege localement (moyenne sur 15min) et envoie seulement les données agregees (~4,800 messages/jour). Les alertes urgentes sont traitees localement sans attendre le cloud.
</details>

<details>
<summary>2. Quels sont les 3 niveaux de QoS MQTT ?</summary>

**QoS 0** : at-most-once (fire-and-forget, rapide, pas de garantie). **QoS 1** : at-least-once (avec ack, possibles doublons). **QoS 2** : exactly-once (4-way handshake, lent mais garanti). Le choix dépend du cas : QoS 0 pour la telemetrie fréquente, QoS 1 pour les alertes, QoS 2 pour les opérations critiques.
</details>

---

## Analogie — Deux personnes sur le meme tableau blanc

Deux personnes ecrivent sur le meme tableau blanc a distance :
- **OT** (Operational Transform) : un arbitre central regarde les deux écritures et decide comment les combiner. "Alice a écrit 'Bonjour' a la position 0, Bob a inséré 'Hello' a la position 0 → je transforme l'opération de Bob en position 7."
- **CRDT** (Conflict-free Replicated Data Types) : les stylos sont **magiques** — chaque modification est mathematiquement conçue pour converger vers le meme résultat, peu importe l'ordre. Pas besoin d'arbitre.

---

## Théorie

### 1. Le problème de la concurrence d'edition

```
Alice et Bob editent le meme document simultanément :

Document initial : "Hello"

Alice (t=0) : insert "!" at position 5     → "Hello!"
Bob   (t=0) : insert " World" at position 5 → "Hello World"

Resultat attendu : "Hello World!" ou "Hello! World"
Resultat sans coordination : corruption du document

Solutions :
  1. Lock pessimiste : un seul editeur a la fois (pas collaboratif)
  2. OT : un serveur central transforme les operations
  3. CRDT : convergence mathematique, pas de serveur central
```

### 2. Operational Transform (OT) — approche Google Docs

```
Alice : insert('!', 5)
Bob   : insert(' World', 5)

Serveur recoit d'abord Alice :
  Document : "Hello!"

Serveur recoit Bob :
  "insert(' World', 5)" mais le document a change !
  → Transformer : position 5 → position 5 (avant '!')
  → Resultat : "Hello World!"

Regle de transformation :
  Si insert(a, posA) avant insert(b, posB) :
    Si posA <= posB → posB += len(a)
    Si posA > posB → posA += len(b)

Avantage : eprouve (Google Docs depuis 2006)
Inconvenient : serveur central obligatoire, complexite O(n²)
```

### 3. CRDT — approche Figma/Yjs

```
Principe : chaque operation est conçue pour COMMUTER
  → L'ordre d'application n'a pas d'importance
  → Le resultat est toujours le meme

Types de CRDT :
┌──────────────┬──────────────────────────────────────┐
│ G-Counter    │ Counter qui ne fait qu'incrementer    │
│              │ Chaque noeud a son propre compteur    │
│              │ Total = somme de tous les noeuds      │
├──────────────┼──────────────────────────────────────┤
│ PN-Counter   │ G-Counter pour + et G-Counter pour - │
│              │ Total = positif - negatif             │
├──────────────┼──────────────────────────────────────┤
│ LWW-Register │ Last-Write-Wins : timestamp le plus   │
│              │ recent gagne                          │
├──────────────┼──────────────────────────────────────┤
│ OR-Set       │ Observed-Remove Set : ajouter/retirer │
│              │ des elements sans conflit             │
├──────────────┼──────────────────────────────────────┤
│ RGA          │ Replicated Growable Array : texte     │
│              │ collaboratif (chaque char a un ID)    │
└──────────────┴──────────────────────────────────────┘
```

### 4. OT vs CRDT

| Critère | OT | CRDT |
|---|---|---|
| Serveur central | Obligatoire | Optionnel (peer-to-peer possible) |
| Convergence | Garantie par le serveur | Garantie mathematique |
| Complexite implémentation | Elevee | Moyenne-élevée |
| Performance (petits docs) | Bonne | Bonne |
| Performance (gros docs) | Bonne | Peut etre lourde (metadata) |
| Offline | Difficile | Natif (sync quand reconnecte) |
| Utilise par | Google Docs, Etherpad | Figma, Yjs, Automerge |

### 5. Architecture temps reel avec WebSocket

```
Client A ←──WebSocket──→ Server ←──WebSocket──→ Client B
                           │
                     ┌─────▼─────┐
                     │ Document  │
                     │ Store     │
                     │(Yjs/Redis)│
                     └───────────┘

Awareness protocol :
  - Qui est en ligne ? (presence)
  - Ou est le curseur de chaque utilisateur ? (cursor position)
  - Qui est en train de taper ? (typing indicator)
```

### 6. Libraries de production

| Library | Type | Langage | Cas d'usage |
|---|---|---|---|
| **Yjs** | CRDT | TypeScript | Editeur texte, formulaires, dessin |
| **Automerge** | CRDT | Rust/JS | Documents structures, JSON |
| **ShareDB** | OT | JavaScript | Collaboration temps reel |
| **Liveblocks** | CRDT (hosted) | TypeScript | SaaS rapide, pas de serveur |

---

## Pratique

### G-Counter CRDT

```typescript
// Le CRDT le plus simple : un compteur qui ne fait qu'incrementer
class GCounter {
  // Chaque noeud a son propre compteur
  private counts: Map<string, number> = new Map();

  constructor(private readonly nodeId: string) {}

  increment(amount: number = 1): void {
    const current = this.counts.get(this.nodeId) ?? 0;
    this.counts.set(this.nodeId, current + amount);
  }

  value(): number {
    let total = 0;
    for (const count of this.counts.values()) {
      total += count;
    }
    return total;
  }

  // Merge : prendre le max de chaque noeud
  merge(other: GCounter): void {
    for (const [nodeId, count] of other.counts) {
      const current = this.counts.get(nodeId) ?? 0;
      this.counts.set(nodeId, Math.max(current, count));
    }
  }

  // Serialiser pour le reseau
  toJSON(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }

  static fromJSON(nodeId: string, data: Record<string, number>): GCounter {
    const counter = new GCounter(nodeId);
    counter.counts = new Map(Object.entries(data));
    return counter;
  }
}

// Usage : 3 noeuds comptent des votes
const nodeA = new GCounter('A');
const nodeB = new GCounter('B');

nodeA.increment(); nodeA.increment(); // A = 2
nodeB.increment(); // B = 1

// Merge (peu importe l'ordre)
nodeA.merge(nodeB); // nodeA.value() = 3
nodeB.merge(nodeA); // nodeB.value() = 3 (meme resultat !)
```

### Collaborative editor avec Yjs

```typescript
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Creer un document partage
const doc = new Y.Doc();
const yText = doc.getText('content');

// Connecter au serveur WebSocket
const provider = new WebsocketProvider(
  'wss://collaboration.example.com',
  'document-123', // Room ID
  doc,
);

// Awareness (curseurs, presence)
const awareness = provider.awareness;
awareness.setLocalState({
  user: { name: 'Alice', color: '#ff0000' },
  cursor: { index: 42 },
});

// Observer les changements des autres
awareness.on('change', () => {
  const states = awareness.getStates();
  // Afficher les curseurs des autres utilisateurs
  for (const [clientId, state] of states) {
    if (clientId !== doc.clientID) {
      renderRemoteCursor(state.user, state.cursor);
    }
  }
});

// Observer les changements de texte
yText.observe((event) => {
  // Mettre a jour l'editeur UI
  updateEditorContent(yText.toString());
});

// Ecrire (propagation automatique via WebSocket)
yText.insert(0, 'Hello from Alice!');
```

### LWW-Register CRDT

```typescript
// Last-Write-Wins Register : pour des valeurs simples (titre, status)
class LWWRegister<T> {
  private value: T;
  private timestamp: number;
  private nodeId: string;

  constructor(nodeId: string, initialValue: T) {
    this.nodeId = nodeId;
    this.value = initialValue;
    this.timestamp = Date.now();
  }

  set(newValue: T): void {
    this.value = newValue;
    this.timestamp = Date.now();
  }

  get(): T {
    return this.value;
  }

  merge(other: LWWRegister<T>): void {
    if (other.timestamp > this.timestamp) {
      this.value = other.value;
      this.timestamp = other.timestamp;
      this.nodeId = other.nodeId;
    } else if (other.timestamp === this.timestamp) {
      // Tie-breaker : nodeId le plus grand gagne
      if (other.nodeId > this.nodeId) {
        this.value = other.value;
        this.nodeId = other.nodeId;
      }
    }
    // Sinon : on garde notre valeur (plus recente)
  }
}
```

---

## Resume

1. **Concurrence d'edition** : deux utilisateurs modifient le meme document → sans coordination, corruption
2. **OT** (Google Docs) : serveur central transforme les opérations pour maintenir la cohérence — eprouve mais centralise
3. **CRDT** (Figma, Yjs) : convergence mathematique garantie, pas besoin de serveur central, fonctionne offline — metadata overhead
4. **Types de CRDT** : G-Counter (compteur), LWW-Register (valeur simple), OR-Set (ensemble), RGA (texte)
5. **Architecture** : WebSocket pour la propagation temps reel + awareness protocol (presence, curseurs) + Yjs/Automerge comme library CRDT

---

> **Prochain cours** : [Cours 89 — Modernisation Legacy & Anti-Corruption Layer](./06-modernisation-legacy.md)

---

> **Lien fil rouge — ShopArch**
>
> - Implémente un PoC CRDT pour l'édition collaborative du catalogue ShopArch (2 admins éditent le même produit)
> - Compare CRDT vs OT pour le cas d'usage ShopArch
> - Exercice(s) associé(s) : `exercices/58-crdt-editeur/`
> - Checkpoint : Module 13, critère 2
