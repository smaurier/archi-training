# Cours 43 — Fondamentaux réseau pour architectes

> **Objectif** : Comprendre les différences entre HTTP/1.1, HTTP/2 et HTTP/3, maîtriser TLS 1.3 et mTLS, connaître le fonctionnement de la résolution DNS, du TCP pooling, du WebSocket upgrade et des alternatives temps réel (SSE, long polling).

---

## Rappel du cours précédent

<details>
<summary>1. Quelle est la différence entre Cache First et Network First dans un Service Worker ?</summary>

**Cache First** sert depuis le cache et ne va au réseau qu'en cas de miss — idéal pour les assets statiques (CSS, JS, images) qui ne changent pas souvent. **Network First** tente le réseau d'abord et tombe sur le cache en cas d'échec — idéal pour les appels API ou les pages dynamiques où la fraîcheur est prioritaire. Le choix dépend du type de contenu : un logo peut être Cache First, une liste de produits doit être Network First.
</details>

<details>
<summary>2. Pourquoi Background Sync utilise-t-il IndexedDB et non localStorage ?</summary>

**IndexedDB** est asynchrone, supporte les transactions, stocke des objets structurés (pas juste des strings), et a une capacité quasi illimitée (des centaines de MB). **localStorage** est synchrone (bloque le thread principal), limité à ~5MB, et ne stocke que des strings. Pour une queue d'actions offline qui peut accumuler des dizaines d'opérations, seul IndexedDB est viable.
</details>

---

## Analogie — L'autoroute, les 6 voies et l'hélicoptère

Imagine que tu dois livrer 20 colis à un entrepôt situé à 100 km :

- **HTTP/1.1 = autoroute à 1 voie** : tu envoies un camion, il livre, il revient, puis tu envoies le suivant. Si un camion tombe en panne (head-of-line blocking), tous les autres attendent derrière. Pour aller plus vite, tu ouvres 6 autoroutes parallèles (6 connexions TCP) — lourd et coûteux.
- **HTTP/2 = autoroute à 6 voies** : une seule autoroute, mais 6 voies. Les camions circulent en parallèle sur la même route. Si un camion tombe en panne sur la voie 3, les voies 1, 2, 4, 5, 6 continuent... sauf que c'est toujours TCP — si un paquet se perd au niveau de la route (pas du camion), tout le monde attend.
- **HTTP/3 = hélicoptère** : chaque colis a son propre hélicoptère (UDP/QUIC). Pas de route partagée, pas de blocage. Si un hélicoptère a un problème, les autres continuent sans ralentir. Et en plus, l'hélicoptère connaît déjà le chemin (0-RTT).

---

## Théorie

### 1. HTTP/1.1 — le protocole fondateur

HTTP/1.1 (1997) est toujours utilisé. Ses limitations :

| Limitation | Consequence | Workaround |
|---|---|---|
| **Head-of-line blocking** | Une requête lente bloque les suivantes sur la même connexion | Ouvrir 6 connexions TCP parallèles |
| **Headers en texte clair** | Chaque requête répète tous les headers (~500 bytes à 2KB) | Aucun — on subit |
| **Pas de multiplexing** | 1 requête = 1 aller-retour complet avant la suivante | Domain sharding (répartir sur plusieurs domaines) |
| **Pas de server push** | Le serveur ne peut rien envoyer proactivement | Inliner le CSS critique dans le HTML |

```
HTTP/1.1 — Head-of-line blocking

  Client                          Serveur
    │                                │
    │── GET /style.css ────────────>│
    │<──────────────── 200 OK ──────│  (300ms)
    │                                │
    │── GET /app.js ───────────────>│
    │<──────────────── 200 OK ──────│  (500ms)   ← BLOQUE tant que
    │                                │              style.css n'est
    │── GET /logo.png ─────────────>│              pas fini
    │<──────────────── 200 OK ──────│  (200ms)
    │                                │
    Total sequentiel : 1000ms
```

### 2. HTTP/2 — multiplexing et HPACK

HTTP/2 (2015) résout le head-of-line blocking au niveau applicatif :

```
HTTP/2 — Multiplexing sur une seule connexion TCP

  Client                          Serveur
    │                                │
    │══ Stream 1: GET /style.css ══>│
    │══ Stream 3: GET /app.js ═════>│  (en parallele !)
    │══ Stream 5: GET /logo.png ══=>│
    │                                │
    │<══ Stream 5: 200 logo ════════│  (200ms — arrive en premier)
    │<══ Stream 1: 200 style ═══════│  (300ms)
    │<══ Stream 3: 200 app.js ══════│  (500ms)
    │                                │
    Total parallele : 500ms (vs 1000ms en HTTP/1.1)
```

| Feature HTTP/2 | Description |
|---|---|
| **Multiplexing** | Plusieurs requêtes/réponses en parallèle sur 1 connexion TCP |
| **HPACK** | Compression des headers via table de référence statique + dynamique (Huffman) |
| **Server Push** | Le serveur envoie des ressources avant que le client les demande (déprécié en pratique) |
| **Binary framing** | Les messages sont en binaire, pas en texte — parsing plus rapide |
| **Stream priority** | Le client indique quels streams sont prioritaires |

**Limitation restante** : TCP head-of-line blocking. Si un seul paquet TCP est perdu, TOUTES les streams attendent la retransmission.

### 3. HTTP/3 — QUIC et 0-RTT

HTTP/3 (2022) remplace TCP par **QUIC** (Quick UDP Internet Connections) :

```
Comparaison des handshakes :

HTTP/1.1 + TLS 1.2 :     HTTP/2 + TLS 1.3 :     HTTP/3 + QUIC :
  TCP SYN       (1 RTT)    TCP SYN     (1 RTT)    QUIC Initial  (0-1 RTT)
  TCP SYN-ACK              TCP SYN-ACK             (TLS integre dans QUIC)
  TLS ClientHello (1 RTT)  TLS 1.3     (1 RTT)
  TLS ServerHello          handshake
  TLS Finished  (1 RTT)
  ─────────────            ──────────              ──────────
  Total: 3 RTT             Total: 2 RTT            Total: 1 RTT (0-RTT si deja connu)
```

| Feature QUIC/HTTP/3 | Avantage |
|---|---|
| **Pas de HOL blocking TCP** | Chaque stream QUIC est indépendant — une perte n'affecte qu'un stream |
| **0-RTT** | Reconnexion instantanée à un serveur déjà visité (clé de session en cache) |
| **Migration de connexion** | L'ID de connexion est dans QUIC, pas dans le tuple IP:port — le mobile qui passe du Wi-Fi à la 4G ne perd pas la connexion |
| **TLS 1.3 intégré** | Chiffrement obligatoire, handshake combiné avec le transport |

### 4. TLS 1.3 — sécuriser le transport

```
TLS 1.3 Handshake (1-RTT)

  Client                          Serveur
    │                                │
    │── ClientHello ───────────────>│  (ciphers supportes, clef ephemere)
    │<── ServerHello ───────────────│  (cipher choisi, clef ephemere, certificat)
    │                                │
    │  [Les deux calculent le secret partage via ECDHE]
    │                                │
    │── Finished ──────────────────>│  (verifie le handshake)
    │<── Finished ──────────────────│
    │                                │
    │══ Donnees chiffrees ═════════>│  (1 RTT total)
```

| Concept | Description |
|---|---|
| **Certificate pinning** | Le client ne fait confiance qu'à un certificat spécifique (ou sa clef publique), pas à toute la chaîne CA — protégé contre les CA compromises |
| **mTLS** | Mutual TLS — le serveur aussi vérifie le certificat du client. Utilisé en inter-services (service A prouve son identité à service B) |
| **ECDHE** | Échange de clefs Diffie-Hellman sur courbes elliptiques — forward secrecy (compromis de la clef privée ne décrypte pas le passé) |

### 5. DNS — résolution et TTL

```
Resolution DNS

  Navigateur          Resolver local       Root DNS       .com DNS       ns.example.com
    │                      │                  │              │                │
    │─ api.example.com ──>│                  │              │                │
    │                      │─ "qui gere .com ?" ────>│      │                │
    │                      │<── ns pour .com ────────│      │                │
    │                      │                  │              │                │
    │                      │─ "qui gere example.com ?" ───>│                │
    │                      │<── ns.example.com ────────────│                │
    │                      │                  │              │                │
    │                      │─ "IP de api.example.com ?" ───────────────────>│
    │                      │<── 93.184.216.34 (TTL=300s) ──────────────────│
    │                      │                  │              │                │
    │<─ 93.184.216.34 ────│  [cache 300s]    │              │                │
```

| Paramètre | Valeur recommandée | Pourquoi |
|---|---|---|
| **TTL production** | 300s (5 min) | Bon compromis entre cache et propagation rapide |
| **TTL avant migration** | 60s (1 min) | Réduire le TTL 24h avant un changement d'IP |
| **TTL failover** | 30s | Pour du failover DNS, le TTL doit être court |
| **DNS-over-HTTPS** | Activé si possible | Empêche l'interception/modification des requêtes DNS |

### 6. TCP pooling et keep-alive

```
Sans keep-alive :                  Avec keep-alive :

  Requete 1 :                        Requete 1 :
    TCP handshake (1 RTT)              TCP handshake (1 RTT)
    TLS handshake (1 RTT)             TLS handshake (1 RTT)
    GET /api/articles                  GET /api/articles
    Reponse                            Reponse
    TCP close                          [connexion reste ouverte]

  Requete 2 :                        Requete 2 :
    TCP handshake (1 RTT)              GET /api/comments
    TLS handshake (1 RTT)             Reponse
    GET /api/comments                  [pas de nouveau handshake !]
    Reponse
    TCP close

  Cout : 4 RTT + 2 requetes          Cout : 2 RTT + 2 requetes
```

| Paramètre pool | Valeur typique | Description |
|---|---|---|
| **maxSockets** | 10-25 par host | Nombre max de connexions TCP simultanées vers un host |
| **keepAliveTimeout** | 30s-60s | Temps avant de fermer une connexion inactive |
| **maxFreeSockets** | 5-10 | Connexions libres gardées en réserve |

### 7. WebSocket upgrade

```
WebSocket Upgrade Handshake

  Client                          Serveur
    │                                │
    │── GET /ws HTTP/1.1 ─────────>│
    │   Connection: Upgrade          │
    │   Upgrade: websocket           │
    │   Sec-WebSocket-Key: dGhlIH...│
    │   Sec-WebSocket-Version: 13    │
    │                                │
    │<── 101 Switching Protocols ───│
    │    Connection: Upgrade         │
    │    Upgrade: websocket          │
    │    Sec-WebSocket-Accept: s3p...│
    │                                │
    │══ Full-duplex bidirectionnel ═│  (frames binaires ou texte)
    │<═════════════════════════════>│
```

Le WebSocket commence comme une requête HTTP classique, puis "upgrade" vers un protocole full-duplex. La connexion TCP sous-jacente est réutilisée.

### 8. SSE vs long polling vs WebSocket

| Critère | Long Polling | SSE | WebSocket |
|---|---|---|---|
| **Direction** | Serveur → Client (simulée) | Serveur → Client | Bidirectionnel |
| **Transport** | HTTP standard (requêtes répétées) | HTTP stream (`text/event-stream`) | Protocole WS (upgrade HTTP) |
| **Reconnexion** | Client refait une requête à chaque réponse | Automatique (native `EventSource`) | Manuelle (code custom) |
| **Overhead** | Élevé (nouveau header à chaque requête) | Faible (connexion maintenue) | Très faible (frames légères) |
| **Proxy/CDN** | Passe partout | Passe partout (HTTP) | Problèmes avec certains proxies |
| **Cas d'usage** | Legacy, fallback | Notifications, flux RSS, logs | Chat, collaboration, gaming |

---

## Pratique

### HTTP/2 server push avec NestJS (Fastify)

```typescript
// main.ts — activer HTTP/2
import Fastify from 'fastify';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import * as fs from 'fs';

async function bootstrap() {
  const httpsOptions = {
    key: fs.readFileSync('./certs/server.key'),
    cert: fs.readFileSync('./certs/server.crt'),
  };

  const fastifyAdapter = new FastifyAdapter({
    http2: true,
    https: httpsOptions,
  });

  const app = await NestFactory.create(AppModule, fastifyAdapter);
  await app.listen(3000);
}
bootstrap();
```

### Agent HTTP avec connection pooling (Node.js)

```typescript
import { Agent } from 'https';

// Pool de connexions reutilisables vers l'API interne
const apiAgent = new Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,    // Garder les connexions 30s
  maxSockets: 25,             // Max 25 connexions simultanees par host
  maxFreeSockets: 10,         // Garder 10 connexions libres en reserve
  timeout: 10_000,            // Timeout par requete
});

// Service NestJS utilisant le pool
import { Injectable, HttpException } from '@nestjs/common';

@Injectable()
export class InternalApiService {
  private readonly baseUrl = process.env.INTERNAL_API_URL;

  async fetchResource<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      // @ts-expect-error -- Node.js fetch supporte l'agent via dispatcher
      dispatcher: apiAgent,
      headers: {
        'Accept': 'application/json',
        'Connection': 'keep-alive',
      },
    });

    if (!response.ok) {
      throw new HttpException(
        `Internal API error: ${response.status}`,
        response.status,
      );
    }

    return response.json() as Promise<T>;
  }
}
```

### SSE endpoint avec NestJS

```typescript
import { Controller, Sse, MessageEvent } from '@nestjs/common';
import { Observable, interval, map } from 'rxjs';

@Controller('events')
export class EventsController {
  // Endpoint SSE — le client recoit des events en continu
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    // Exemple : envoyer un heartbeat toutes les 30 secondes
    // + les vrais events du domaine
    return interval(30_000).pipe(
      map((tick) => ({
        type: 'heartbeat',
        data: JSON.stringify({ tick, timestamp: new Date().toISOString() }),
        retry: 5000, // Reconnecter apres 5s en cas de coupure
      })),
    );
  }
}

// Cote client React — consommer un SSE
function useSSE(url: string) {
  const [events, setEvents] = React.useState<any[]>([]);

  React.useEffect(() => {
    const source = new EventSource(url);

    source.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setEvents((prev) => [...prev.slice(-99), data]); // Garder les 100 derniers
    };

    source.onerror = () => {
      // EventSource reconnecte automatiquement
      console.warn('SSE connection lost, reconnecting...');
    };

    return () => source.close();
  }, [url]);

  return events;
}
```

### mTLS entre microservices

```typescript
import * as fs from 'fs';
import * as https from 'https';

// Service A appelle Service B avec mTLS
// Service A presente son certificat client
const mtlsAgent = new https.Agent({
  cert: fs.readFileSync('./certs/service-a.crt'),   // Certificat client
  key: fs.readFileSync('./certs/service-a.key'),     // Clef privee client
  ca: fs.readFileSync('./certs/internal-ca.crt'),    // CA interne
  rejectUnauthorized: true,                           // Verifier le certificat serveur
});

@Injectable()
export class ServiceBClient {
  async call(endpoint: string): Promise<any> {
    const response = await fetch(`https://service-b.internal${endpoint}`, {
      // @ts-expect-error
      dispatcher: mtlsAgent,
    });
    return response.json();
  }
}
```

---

## Résumé

1. **HTTP/1.1** souffre du head-of-line blocking — une requête lente bloque les suivantes, ce qui force l'ouverture de 6 connexions TCP parallèles
2. **HTTP/2** introduit le multiplexing (streams parallèles sur 1 connexion TCP) et HPACK (compression headers), mais reste vulnérable au HOL blocking TCP
3. **HTTP/3/QUIC** supprime le HOL blocking TCP en utilisant UDP avec des streams indépendants, permet le 0-RTT pour les reconnexions et la migration Wi-Fi/4G sans perte
4. **TLS 1.3** réduit le handshake à 1 RTT, et mTLS permet l'authentification mutuelle entre services internes
5. **SSE** pour les flux unidirectionnels (notifications, logs), **WebSocket** pour le bidirectionnel (chat, collaboration), **long polling** uniquement en fallback legacy

---

> **Prochain cours** : [Cours 44 — REST avancé](./02-rest-avance.md) — où comment maîtriser HATEOAS, le versioning d'API, la pagination cursor, et la content negotiation.

---

> **Lien fil rouge — ShopArch**
>
> - Vérifie que ShopArch utilise HTTP/2 (multiplexing des requêtes catalogue)
> - Mesure l'impact du multiplexing vs HTTP/1.1 sur le temps de chargement
> - Exercice(s) associé(s) : `exercices/28-http2-benchmark/`
> - Checkpoint : Module 06, critère 1
