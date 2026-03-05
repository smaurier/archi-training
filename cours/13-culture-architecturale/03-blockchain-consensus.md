# Cours 86 — Blockchain & Consensus distribue

> **Objectif** : Comprendre les mecanismes de consensus distribue (PoW, PoS, BFT), savoir quand la blockchain fait sens (et surtout quand elle NE fait PAS sens), et connaitre les concepts Web3 (smart contracts, DApps, IPFS).

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce qu'un Feature Store et pourquoi est-il important ?</summary>

Un Feature Store définit les features (variables d'entree du modèle) **une seule fois** et les calcule de manière identique en training (offline, batch) et en serving (online, temps reel). Sans Feature Store, les features peuvent etre calculees differemment → training/serving skew → predictions fausses en production.
</details>

<details>
<summary>2. Comment fonctionne le A/B testing ML champion/challenger ?</summary>

Le modèle actuel (champion) recoit 90% du trafic, le nouveau modèle (challenger) recoit 10%. On compare les metriques business (click-through rate, conversion, revenue) sur une periode. Si le challenger est meilleur → il devient champion. Si pire → rollback. C'est le meme principe que le canary deployment, applique aux modèles ML.
</details>

---

## Analogie — Le grand livre comptable public

Imagine un village sans banque, ou chaque transaction est ecrite dans un **grand livre public** pose sur la place du village :
- **Tout le monde** peut lire le livre (transparence)
- **Personne** ne peut effacer une ligne (immutabilite)
- Pour ajouter une ligne, il faut que **la majorite** du village confirme (consensus)
- Si quelqu'un essaie de falsifier une page, les autres copies du livre le detectent

La blockchain est ce grand livre, distribue sur des milliers d'ordinateurs.

---

## Théorie

### 1. Blockchain — les fondamentaux

```
Block N-1          Block N            Block N+1
┌──────────┐      ┌──────────┐      ┌──────────┐
│ Hash prev│◄─────│ Hash prev│◄─────│ Hash prev│
│ Timestamp│      │ Timestamp│      │ Timestamp│
│ Nonce    │      │ Nonce    │      │ Nonce    │
│ ──────── │      │ ──────── │      │ ──────── │
│ Tx 1     │      │ Tx 4     │      │ Tx 7     │
│ Tx 2     │      │ Tx 5     │      │ Tx 8     │
│ Tx 3     │      │ Tx 6     │      │ Tx 9     │
│ Hash: abc│      │ Hash: def│      │ Hash: ghi│
└──────────┘      └──────────┘      └──────────┘

Proprietes :
  - Chaque block contient le hash du block precedent → chaine
  - Modifier un block invalide TOUS les blocks suivants
  - Distribue sur N noeuds → pas de point central de controle
  - Append-only → on ne peut que AJOUTER, jamais MODIFIER
```

### 2. Mecanismes de consensus

| Mecanisme | Comment | Energie | Vitesse | Sécurité |
|---|---|---|---|---|
| **Proof of Work** (PoW) | Résoudre un puzzle crypto | Enorme | Lente (10min/block BTC) | Tres haute |
| **Proof of Stake** (PoS) | Staker des tokens comme garantie | Faible | Rapide (~12s ETH) | Haute |
| **BFT** (Byzantine Fault Tolerance) | Vote entre validateurs connus | Faible | Tres rapide | Haute (si < 1/3 malveillants) |
| **Proof of Authority** (PoA) | Validateurs approuves | Negligeable | Tres rapide | Moyenne (centralise) |

### 3. Smart contracts

```
Un smart contract = du code qui s'execute automatiquement
quand les conditions sont remplies.

Exemple (pseudo-Solidity) :
  contract Escrow {
    function pay(address seller) {
      require(msg.value > 0);
      require(deliveryConfirmed[seller]);
      seller.transfer(msg.value);
    }
  }

Avantage : pas besoin d'un tiers de confiance
Risque : le code est immutable — un bug est permanent (cf. DAO hack)
```

### 4. Quand la blockchain fait sens

```
OUI — la blockchain a du sens quand :
  ✓ Pas de tiers de confiance entre les parties
  ✓ Besoin de tracabilite immutable (supply chain, certifications)
  ✓ Tokens / actifs numeriques (NFT, cryptocurrencies)
  ✓ Identite decentralisee (DID, Verifiable Credentials)
  ✓ Transparence obligatoire (votes, audit trails publics)

NON — la blockchain N'a PAS de sens quand :
  ✗ Tu as un tiers de confiance (une DB classique suffit)
  ✗ Les donnees changent souvent (blockchain = append-only)
  ✗ Tu as besoin de confidentialite (blockchain = public)
  ✗ Tu as besoin de hautes performances (blockchain = lent)
  ✗ Tu peux faire confiance a ton equipe (99% des projets)

Decision framework :
  1. "As-tu besoin de plusieurs parties qui ne se font pas confiance ?"
     Non → pas de blockchain
  2. "As-tu besoin d'un registre immutable et verifiable ?"
     Non → pas de blockchain
  3. "Es-tu pret a accepter les contraintes (lenteur, cout, complexite) ?"
     Non → pas de blockchain
```

### 5. Web3 concepts

| Concept | Description | Équivalent Web2 |
|---|---|---|
| **Wallet** | Identité = cle cryptographique | Compte utilisateur |
| **DApp** | Application decentralisee (front + smart contract) | App web + API |
| **IPFS** | Stockage decentralise | S3 / CDN |
| **DAO** | Organisation gouvernee par smart contracts | Entreprise |
| **Token** | Unite de valeur sur la blockchain | Points de fidelite |
| **NFT** | Token unique, non-fongible | Certificat d'authenticite |

---

## Pratique

### Vérification d'intégrité avec hash chain (sans blockchain)

```typescript
// Pattern inspire de la blockchain pour un audit trail interne
// (pas besoin de blockchain complete si tu controles le systeme)

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  data: Record<string, unknown>;
  previousHash: string;
  hash: string;
}

class AuditChain {
  private lastHash = 'genesis';

  async append(action: string, data: Record<string, unknown>): Promise<AuditEntry> {
    const entry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action,
      data,
      previousHash: this.lastHash,
      hash: '', // Calcule ci-dessous
    };

    // Hash = SHA-256(previousHash + timestamp + action + data)
    entry.hash = await this.computeHash(entry);
    this.lastHash = entry.hash;

    // Stocker en append-only (INSERT, jamais UPDATE/DELETE)
    await this.store(entry);

    return entry;
  }

  async verify(): Promise<{ valid: boolean; brokenAt?: number }> {
    const entries = await this.loadAll();
    let previousHash = 'genesis';

    for (let i = 0; i < entries.length; i++) {
      // Verifier le chainage
      if (entries[i].previousHash !== previousHash) {
        return { valid: false, brokenAt: i };
      }

      // Verifier le hash
      const expectedHash = await this.computeHash(entries[i]);
      if (entries[i].hash !== expectedHash) {
        return { valid: false, brokenAt: i };
      }

      previousHash = entries[i].hash;
    }

    return { valid: true };
  }

  private async computeHash(entry: AuditEntry): Promise<string> {
    const payload = `${entry.previousHash}:${entry.timestamp}:${entry.action}:${JSON.stringify(entry.data)}`;
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
    return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
```

### Decision framework implémentation

```typescript
interface BlockchainDecision {
  question: string;
  answer: boolean;
}

function shouldUseBlockchain(answers: BlockchainDecision[]): {
  recommendation: 'blockchain' | 'database';
  reasoning: string;
} {
  const questions = [
    { q: 'Multiple untrusted parties?', required: true },
    { q: 'Need immutable audit trail?', required: true },
    { q: 'Accept performance tradeoffs?', required: true },
    { q: 'No single trusted authority?', required: true },
  ];

  const allYes = answers.every((a) => a.answer);

  if (allYes) {
    return {
      recommendation: 'blockchain',
      reasoning: 'All criteria met — blockchain adds value for trustless, immutable records.',
    };
  }

  const failedQuestions = answers
    .filter((a) => !a.answer)
    .map((a) => a.question);

  return {
    recommendation: 'database',
    reasoning: `A traditional database is better. Failed criteria: ${failedQuestions.join(', ')}`,
  };
}
```

---

## Resume

1. **Blockchain** : registre distribue, immutable, sans tiers de confiance — chaque block contient le hash du précédent
2. **Consensus** : PoW (lent, sécurisé), PoS (rapide, ecologique), BFT (vote, validateurs connus)
3. **Smart contracts** : code auto-exécuté quand les conditions sont remplies — immutable (un bug est permanent)
4. **99% des projets N'ONT PAS besoin de blockchain** — si tu as un tiers de confiance, une DB classique suffit
5. **Hash chain pattern** : on peut utiliser le chainage de hash pour un audit trail verifiable SANS blockchain complete

---

> **Prochain cours** : [Cours 87 — IoT & Edge Architecture](./04-iot-edge.md)

---

> **Lien fil rouge — ShopArch**
>
> - Réfléchis : dans quel cas ShopArch aurait besoin de blockchain ? (Supply chain tracking ? NFTs produit ? Probablement jamais.)
> - Compare le consensus distribué avec les patterns de consistance vus au Module 07
> - Checkpoint : Module 13, critère 4
