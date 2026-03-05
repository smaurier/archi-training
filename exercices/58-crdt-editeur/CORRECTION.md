# Correction — Exercice 58 : CRDT pour editeur collaboratif

## G-Counter

```typescript
// g-counter.ts
class GCounter {
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

  // Merge = max de chaque noeud (commutatif, associatif, idempotent)
  merge(other: GCounter): void {
    for (const [nodeId, count] of other.counts) {
      const myCount = this.counts.get(nodeId) ?? 0;
      this.counts.set(nodeId, Math.max(myCount, count));
    }
  }

  toJSON() {
    return Object.fromEntries(this.counts);
  }
}
```

## LWW-Register

```typescript
// lww-register.ts
class LWWRegister<T> {
  private value_: T;
  private timestamp_: number;
  private nodeId_: string;

  constructor(value: T, nodeId: string, timestamp?: number) {
    this.value_ = value;
    this.nodeId_ = nodeId;
    this.timestamp_ = timestamp ?? Date.now();
  }

  get value(): T {
    return this.value_;
  }

  set(value: T, nodeId: string): void {
    this.value_ = value;
    this.nodeId_ = nodeId;
    this.timestamp_ = Date.now();
  }

  // Merge : garder la valeur la plus recente
  // Egalite de timestamp → le node ID le plus grand gagne (deterministe)
  merge(other: LWWRegister<T>): void {
    if (
      other.timestamp_ > this.timestamp_ ||
      (other.timestamp_ === this.timestamp_ && other.nodeId_ > this.nodeId_)
    ) {
      this.value_ = other.value_;
      this.timestamp_ = other.timestamp_;
      this.nodeId_ = other.nodeId_;
    }
  }

  toJSON() {
    return { value: this.value_, timestamp: this.timestamp_, nodeId: this.nodeId_ };
  }
}
```

## LWW-Map pour les champs produit

```typescript
// lww-map.ts
class LWWMap<T extends Record<string, unknown>> {
  public registers: Map<keyof T, LWWRegister<T[keyof T]>> = new Map();

  constructor(private readonly nodeId: string) {}

  set<K extends keyof T>(key: K, value: T[K]): void {
    const register = this.registers.get(key);
    if (register) {
      register.set(value, this.nodeId);
    } else {
      this.registers.set(key, new LWWRegister(value, this.nodeId));
    }
  }

  get<K extends keyof T>(key: K): T[K] | undefined {
    return this.registers.get(key)?.value as T[K] | undefined;
  }

  merge(other: LWWMap<T>): void {
    for (const [key, otherRegister] of other.registers) {
      const myRegister = this.registers.get(key);
      if (myRegister) {
        myRegister.merge(otherRegister);
      } else {
        this.registers.set(key, otherRegister);
      }
    }
  }

  toObject(): Partial<T> {
    const result: Partial<T> = {};
    for (const [key, register] of this.registers) {
      (result as any)[key] = register.value;
    }
    return result;
  }

  toJSON() {
    const result: Record<string, unknown> = {};
    for (const [key, register] of this.registers) {
      result[key as string] = register.toJSON();
    }
    return result;
  }
}

// Usage pour un produit
interface ProductFields {
  name: string;
  description: string;
  price: number;
}

const product = new LWWMap<ProductFields>('admin-1');
product.set('name', 'TypeScript Book');
product.set('price', 29.99);
```

## Synchronisation WebSocket

```typescript
// collaborative-editor.gateway.ts (NestJS backend — framework-agnostic)
@WebSocketGateway({ namespace: 'product-edit' })
export class CollaborativeEditorGateway {
  @WebSocketServer()
  server: Server;

  private editors = new Map<string, Set<string>>();

  @SubscribeMessage('join')
  handleJoin(client: Socket, productId: string) {
    client.join(`product:${productId}`);
    const editors = this.editors.get(productId) ?? new Set();
    editors.add(client.id);
    this.editors.set(productId, editors);

    client.to(`product:${productId}`).emit('editor:joined', {
      editorId: client.id,
      count: editors.size,
    });
  }

  @SubscribeMessage('change')
  handleChange(client: Socket, data: { productId: string; field: string; register: any }) {
    client.to(`product:${data.productId}`).emit('change', {
      field: data.field,
      register: data.register,
      editorId: client.id,
    });
  }

  @SubscribeMessage('leave')
  handleLeave(client: Socket, productId: string) {
    client.leave(`product:${productId}`);
    const editors = this.editors.get(productId);
    if (editors) {
      editors.delete(client.id);
      client.to(`product:${productId}`).emit('editor:left', {
        editorId: client.id,
        count: editors.size,
      });
    }
  }
}
```

## Hook React pour l'edition collaborative

```typescript
// hooks/useCollaborativeProduct.ts
import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface ProductFields {
  name: string;
  description: string;
  price: number;
}

export function useCollaborativeProduct(productId: string) {
  const nodeId = useRef(`admin-${Date.now()}`).current;
  const socketRef = useRef<Socket | null>(null);
  const productRef = useRef(new LWWMap<ProductFields>(nodeId));
  const [productState, setProductState] = useState<Partial<ProductFields>>({});
  const [otherEditors, setOtherEditors] = useState<string[]>([]);

  // Connexion WebSocket
  useEffect(() => {
    const socket = io('/product-edit');
    socketRef.current = socket;

    socket.emit('join', productId);

    // Recevoir les modifications des autres
    socket.on('change', (data: { field: string; register: any }) => {
      const otherRegister = new LWWRegister(
        data.register.value,
        data.register.nodeId,
        data.register.timestamp,
      );
      const myRegister = productRef.current.registers.get(data.field as keyof ProductFields);
      if (myRegister) {
        myRegister.merge(otherRegister);
      } else {
        productRef.current.registers.set(
          data.field as keyof ProductFields,
          otherRegister as any,
        );
      }
      // Mettre a jour le state React pour re-render
      setProductState({ ...productRef.current.toObject() });
    });

    socket.on('editor:joined', (data) => {
      setOtherEditors((prev) => [...prev, data.editorId]);
    });

    socket.on('editor:left', (data) => {
      setOtherEditors((prev) => prev.filter((id) => id !== data.editorId));
    });

    return () => {
      socket.emit('leave', productId);
      socket.disconnect();
    };
  }, [productId]);

  // Modifier un champ et diffuser
  const updateField = useCallback(
    <K extends keyof ProductFields>(field: K, value: ProductFields[K]) => {
      productRef.current.set(field, value);
      setProductState({ ...productRef.current.toObject() });

      socketRef.current?.emit('change', {
        productId,
        field,
        register: productRef.current.registers.get(field)?.toJSON(),
      });
    },
    [productId],
  );

  return { product: productState, otherEditors, updateField };
}

// Usage dans un composant React :
// function ProductEditor({ productId }: { productId: string }) {
//   const { product, otherEditors, updateField } = useCollaborativeProduct(productId);
//
//   return (
//     <div>
//       {otherEditors.length > 0 && <span>{otherEditors.length} editeur(s) connecte(s)</span>}
//       <input
//         value={product.name ?? ''}
//         onChange={(e) => updateField('name', e.target.value)}
//       />
//       <textarea
//         value={product.description ?? ''}
//         onChange={(e) => updateField('description', e.target.value)}
//       />
//     </div>
//   );
// }
```

## Ce que tu aurais pu oublier

### 1. Merge non commutatif
```
FAUX — merge(A, B) != merge(B, A) (resultat different selon l'ordre)
CORRECT — le merge CRDT doit etre commutatif : merge(A,B) === merge(B,A)
         LWW-Register : toujours garder le timestamp le plus grand
```

### 2. Egalite de timestamp non résolue
```
FAUX — deux modifications avec le meme timestamp → resultat non deterministe
CORRECT — tie-breaker sur le node ID (comparaison de string deterministe)
         merge(A,B) donne toujours le meme resultat quel que soit l'ordre
```

### 3. Conflits par champ entier
```
FAUX — deux admins modifient le meme produit = conflit sur tout l'objet
CORRECT — LWW-Map : chaque champ est un registre independant
         Admin A modifie le prix, Admin B modifie la description = pas de conflit
```

### 4. Pas de fonctionnement offline
```
FAUX — l'editeur ne fonctionne pas sans WebSocket
CORRECT — les modifications locales sont stockees dans le CRDT
         Au retour du reseau, merge avec l'etat distant (convergence automatique)
```
