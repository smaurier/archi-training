# Cours 46 — WebSockets & Real-time

> **Objectif** : Maîtriser le cycle de vie WebSocket, implémenter des rooms et channels avec Socket.IO, comprendre SSE et ses cas d'usage, gérer la reconnexion et le heartbeat, et scaler les WebSockets avec Redis pub/sub.

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce que le problème N+1 en GraphQL et comment le résoudre ?</summary>

Le problème N+1 se produit quand une requête GraphQL qui récupéré N éléments effectue 1 requête supplementaire par élément pour résoudre une relation (ex: l'auteur de chaque article). Pour 20 articles, on obtient 1 + 20 = 21 requêtes SQL. **DataLoader** resout ce problème en collectant tous les IDs demandes dans un même tick de l'event loop, puis en effectuant une seule requête batchee (`WHERE id IN (...)`). On passe de 21 a 2 requêtes.
</details>

<details>
<summary>2. Quand choisir gRPC plutot que REST ou GraphQL ?</summary>

**gRPC** est ideal pour la communication **inter-services** (microservices) ou la performance est critique : serialisation binaire protobuf (5-10x plus compact que JSON), HTTP/2 obligatoire, 4 types de streaming natif (unary, server, client, bidirectionnel). Il n'est pas adapte aux navigateurs (nécessité gRPC-Web + proxy) ni aux API publiques (pas de documentation Swagger, pas lisible par un humain).
</details>

---

## Analogie — Le telephone, la radio et la boite aux lettres

Trois facons de communiquer en temps réel :

- **WebSocket = le telephone** : tu decroches, la ligne est ouverte dans les deux sens. Tu parles, l'autre repond immédiatement. La connexion reste etablie tant qu'on ne raccroche pas. Si la ligne coupe, il faut rappeler manuellement. Ideal pour une conversation (chat, collaboration).
- **SSE = la radio** : tu allumes la radio (tu te connectes), et la station emet en continu. Tu ecoutes, mais tu ne peux pas parler au presentateur. Si tu perds le signal, la radio se reconnecte automatiquement à la bonne fréquence. Ideal pour des annonces (notifications, flux d'événements).
- **Polling = la boite aux lettres** : toutes les 30 secondes, tu vas vérifier si tu as du courrier. Même s'il n'y a rien, tu te deplaces. Couteux en effort, souvent pour rien. Le courrier peut attendre jusqu'a 30 secondes avant que tu le voies. Simple mais inefficace.

---

## Théorie

### 1. Cycle de vie WebSocket

```
WebSocket Lifecycle

  Client                              Serveur
    │                                    │
    │── HTTP GET /ws ──────────────────>│  (1) Upgrade Request
    │   Upgrade: websocket               │
    │                                    │
    │<── 101 Switching Protocols ───────│  (2) Handshake OK
    │                                    │
    │══ OPEN ══════════════════════════>│  (3) Connection ouverte
    │                                    │
    │── message (frame texte/binaire) ─>│  (4) Client envoie
    │<── message ──────────────────────│  (5) Serveur repond
    │                                    │
    │── ping ──────────────────────────>│  (6) Heartbeat
    │<── pong ─────────────────────────│  (7) Serveur vivant
    │                                    │
    │── close (code: 1000) ────────────>│  (8) Fermeture propre
    │<── close (code: 1000) ───────────│  (9) Confirmation
    │                                    │
    │   CLOSED                           │
```

| Phase | Event | Description |
|---|---|---|
| **Connecting** | `onopen` | Handshake HTTP → 101 → connexion WS etablie |
| **Open** | `onmessage` | Echange bidirectionnel de frames (texte ou binaire) |
| **Heartbeat** | `ping/pong` | Vérifier que la connexion est vivante |
| **Closing** | `onclose` | Fermeture propre avec code (1000=normal, 1006=anormal) |
| **Error** | `onerror` | Erreur réseau, timeout, protocole invalide |

### 2. Rooms et channels

```
Architecture Rooms / Channels

  ┌─────────────────────────────────────────────────┐
  │                 Serveur WebSocket                │
  │                                                  │
  │  Room: "tenant:abc:articles"                     │
  │  ┌────────┐  ┌────────┐  ┌────────┐            │
  │  │ User A │  │ User B │  │ User C │            │
  │  └────────┘  └────────┘  └────────┘            │
  │                                                  │
  │  Room: "tenant:abc:article:42:editing"           │
  │  ┌────────┐  ┌────────┐                         │
  │  │ User A │  │ User D │  ← Collaboration        │
  │  └────────┘  └────────┘    en temps reel         │
  │                                                  │
  │  Room: "tenant:xyz:notifications"                │
  │  ┌────────┐                                      │
  │  │ User E │  ← Seul dans son tenant              │
  │  └────────┘                                      │
  └─────────────────────────────────────────────────┘
```

| Concept | Description |
|---|---|
| **Room** | Groupe logique de connexions — un message envoye à la room atteint tous ses membres |
| **Channel** | Pattern de topic (`tenant:{id}:{resource}`) pour router les messages |
| **Namespace** | Isolation au niveau protocol (Socket.IO : `/admin`, `/public`) |
| **Broadcast** | Envoyer a tous les membres d'une room sauf l'emetteur |

### 3. Reconnexion et backoff

```
Strategie de reconnexion avec backoff exponentiel

  Tentative 1 : immediate (0ms)         → echec
  Tentative 2 : delai 1s + jitter       → echec
  Tentative 3 : delai 2s + jitter       → echec
  Tentative 4 : delai 4s + jitter       → echec
  Tentative 5 : delai 8s + jitter       → succes !

  Plafonner a 30s pour ne pas attendre trop longtemps.

  Avec jitter (aleatoire) pour eviter que 1000 clients
  reconnectent exactement au meme instant (thundering herd).
```

| Paramètre | Valeur | Pourquoi |
|---|---|---|
| **Delai initial** | 1s | Assez court pour une reprise rapide |
| **Multiplicateur** | 2x | Exponentiel pour espacer les tentatives |
| **Delai max** | 30s | Ne pas attendre des minutes |
| **Jitter** | +/- 50% | Éviter le thundering herd |
| **Max tentatives** | Illimite (avec backoff) | L'utilisateur attend la reconnexion |

### 4. Heartbeat

```
Heartbeat bidirectionnel

  Client                              Serveur
    │                                    │
    │  [30s sans message]                │
    │── ping ──────────────────────────>│
    │<── pong ─────────────────────────│  OK — connexion vivante
    │                                    │
    │  [30s sans message]                │
    │── ping ──────────────────────────>│
    │   ... pas de pong apres 5s ...     │
    │                                    │
    │  TIMEOUT → connexion morte         │
    │  → demarrer la reconnexion         │
```

Le heartbeat détecté les connexions "mortes" (half-open) ou le réseau a coupe silencieusement. Sans heartbeat, une connexion peut rester "ouverte" côté client alors que le serveur l'a perdue.

### 5. Scaling WebSockets — Redis pub/sub adapter

```
Scaling horizontal avec Redis adapter

  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ Serveur 1│     │ Serveur 2│     │ Serveur 3│
  │ (500 WS) │     │ (500 WS) │     │ (500 WS) │
  └─────┬────┘     └─────┬────┘     └─────┬────┘
        │                │                │
        └────────┬───────┴────────┬───────┘
                 │                │
           ┌─────┴────┐    ┌─────┴────┐
           │  Redis    │    │  Redis   │
           │  PUB/SUB  │    │ (backup) │
           └──────────┘    └──────────┘

  1. User A (Serveur 1) envoie un message dans la room "article:42"
  2. Serveur 1 PUBLISH sur Redis channel "article:42"
  3. Serveurs 2 et 3 recoivent le message via SUBSCRIBE
  4. Chaque serveur diffuse a ses clients locaux dans la room
```

| Problème | Solution |
|---|---|
| **Sticky sessions** | Le load balancer doit router un client toujours vers le même serveur (par IP ou cookie) |
| **Room cross-server** | Redis pub/sub — chaque serveur publie et s'abonne aux memes channels |
| **Deconnexion serveur** | Le client se reconnecte → peut tomber sur un autre serveur → Redis synchronise |
| **Mémoire** | 10K connexions WS = ~1GB RAM. Monitorer et scaler horizontalement |

### 6. WebSocket vs SSE vs Polling — arbre de decision

```
Besoin temps reel ?
  │
  ├─ NON → Requetes HTTP classiques
  │
  └─ OUI → Le client doit envoyer des messages ?
              │
              ├─ NON → SSE (Server-Sent Events)
              │         Simple, reconnexion auto, HTTP standard
              │         Ex: notifications, flux d'events, logs
              │
              └─ OUI → Frequence elevee ? (< 1s entre messages)
                          │
                          ├─ OUI → WebSocket
                          │         Full-duplex, overhead minimal
                          │         Ex: chat, collaboration, gaming
                          │
                          └─ NON → REST + polling court (5-15s)
                                    Simple, stateless, cache CDN
                                    Ex: statut commande, refresh dashboard
```

---

## Pratique

### Gateway WebSocket avec Socket.IO (NestJS)

```typescript
// events.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
  namespace: '/realtime',
  pingInterval: 25_000,    // Heartbeat toutes les 25s
  pingTimeout: 10_000,     // Timeout si pas de pong apres 10s
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly presenceService: PresenceService,
  ) {}

  // Authentification a la connexion
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwt.verifyAsync(token);
      client.data.userId = payload.sub;
      client.data.tenantId = payload.tenantId;

      // Rejoindre la room du tenant automatiquement
      await client.join(`tenant:${payload.tenantId}`);

      // Marquer l'utilisateur comme "en ligne"
      await this.presenceService.setOnline(payload.sub);

      console.log(`User ${payload.sub} connected (tenant: ${payload.tenantId})`);
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    if (client.data.userId) {
      await this.presenceService.setOffline(client.data.userId);
    }
  }

  // Rejoindre une room de collaboration sur un article
  @SubscribeMessage('join:article')
  async handleJoinArticle(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { articleId: string },
  ): Promise<void> {
    const room = `tenant:${client.data.tenantId}:article:${data.articleId}:editing`;
    await client.join(room);

    // Notifier les autres editeurs
    client.to(room).emit('editor:joined', {
      userId: client.data.userId,
      articleId: data.articleId,
    });
  }

  // Quitter la room d'edition
  @SubscribeMessage('leave:article')
  async handleLeaveArticle(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { articleId: string },
  ): Promise<void> {
    const room = `tenant:${client.data.tenantId}:article:${data.articleId}:editing`;
    await client.leave(room);

    client.to(room).emit('editor:left', {
      userId: client.data.userId,
      articleId: data.articleId,
    });
  }

  // Recevoir un message d'edition en temps reel
  @SubscribeMessage('article:update')
  handleArticleUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { articleId: string; field: string; value: any },
  ): void {
    const room = `tenant:${client.data.tenantId}:article:${data.articleId}:editing`;

    // Broadcast a tous les editeurs SAUF l'emetteur
    client.to(room).emit('article:updated', {
      userId: client.data.userId,
      ...data,
    });
  }

  // Methode appelee par le service metier pour notifier un tenant
  notifyTenant(tenantId: string, event: string, data: any): void {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }
}
```

### Redis adapter pour scaling horizontal

```typescript
// main.ts — configurer Redis adapter
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const pubClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

// Dans bootstrap()
const app = await NestFactory.create(AppModule);
const redisAdapter = new RedisIoAdapter(app);
await redisAdapter.connectToRedis();
app.useWebSocketAdapter(redisAdapter);
```

### Client React avec reconnexion

```typescript
// hooks/useSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  url: string;
  token: string;
  onEvent?: Record<string, (data: any) => void>;
}

export function useSocket({ url, token, onEvent }: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    const socket = io(url, {
      auth: { token },
      transports: ['websocket'],  // Pas de polling fallback
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,        // Delai initial 1s
      reconnectionDelayMax: 30_000,   // Max 30s
      randomizationFactor: 0.5,       // Jitter 50%
    });

    socket.on('connect', () => {
      setIsConnected(true);
      setReconnectAttempt(0);
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        // Le serveur a coupe → reconnecter manuellement
        socket.connect();
      }
      // Sinon socket.io gere la reconnexion automatiquement
    });

    socket.io.on('reconnect_attempt', (attempt) => {
      setReconnectAttempt(attempt);
    });

    // Enregistrer les listeners
    if (onEvent) {
      Object.entries(onEvent).forEach(([event, handler]) => {
        socket.on(event, handler);
      });
    }

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [url, token]);

  const emit = useCallback((event: string, data: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { isConnected, reconnectAttempt, emit, socket: socketRef };
}
```

### SSE avec dernier event ID (reprise après deconnexion)

```typescript
// sse.controller.ts — SSE avec Last-Event-ID
import { Controller, Sse, Headers, Query, MessageEvent } from '@nestjs/common';
import { Observable, Subject, filter, map, merge, interval } from 'rxjs';

@Controller('events')
export class SseController {
  private readonly eventBus = new Subject<DomainEvent>();

  @Sse('stream')
  stream(
    @Headers('last-event-id') lastEventId?: string,
    @Query('tenantId') tenantId?: string,
  ): Observable<MessageEvent> {
    // Si le client reconnecte avec un Last-Event-ID, renvoyer les events manques
    const missedEvents = lastEventId
      ? this.replayFrom(lastEventId, tenantId)
      : [];

    const heartbeat$ = interval(30_000).pipe(
      map(() => ({
        type: 'heartbeat',
        data: JSON.stringify({ ts: Date.now() }),
      })),
    );

    const events$ = this.eventBus.pipe(
      filter((e) => !tenantId || e.tenantId === tenantId),
      map((e) => ({
        id: e.id,        // Le navigateur stocke ce ID pour la reconnexion
        type: e.type,
        data: JSON.stringify(e.payload),
        retry: 5000,     // Reconnecter apres 5s en cas de coupure
      })),
    );

    return merge(heartbeat$, events$);
  }

  // Replay des events manques (depuis un event store ou Redis streams)
  private replayFrom(lastEventId: string, tenantId?: string): DomainEvent[] {
    // Implementation : lire les events depuis Redis Streams
    // avec XRANGE lastEventId + pour recuperer les events manques
    return [];
  }

  // Appele par le service metier pour publier un event
  publish(event: DomainEvent): void {
    this.eventBus.next(event);
  }
}
```

---

## Résumé

1. **WebSocket** ouvre une connexion full-duplex persistante — ideal pour le chat, la collaboration temps réel, le gaming, ou toute interaction bidirectionnelle
2. **Rooms/channels** (`tenant:{id}:resource:{id}`) isolent les messages par contexte — toujours prefixer par le tenant pour respecter l'isolation multi-tenant
3. **Reconnexion** avec backoff exponentiel + jitter pour éviter le thundering herd — plafonner a 30s, ne jamais arreter de tenter
4. **Redis pub/sub adapter** permet de scaler horizontalement les WebSockets — chaque serveur publie/s'abonne, Redis synchronise les rooms cross-serveurs
5. **SSE** pour les flux unidirectionnels simples (notifications, logs) — reconnexion automatique native, `Last-Event-ID` pour la reprise sans perte

---

> **Prochain cours** : [Cours 47 — Event-driven, Webhooks & Message Queues](./05-event-driven-messaging.md) — ou comment implémenter des webhooks signes HMAC, des queues de messages asynchrones, et une architecture event-driven.

---

> **Lien fil rouge — ShopArch**
>
> - Identifie les cas d'usage temps réel dans ShopArch (notification commande, stock update)
> - Évalue SSE vs WebSocket pour les notifications admin ShopArch
> - Exercice(s) associé(s) : `exercices/30-webhook-hmac/`
> - Checkpoint : Module 06, critère 4
