# Lab 21 — Performance & scalabilité : trouver le goulot, décider le scaling

> **Outcome :** à la fin, tu sais lire les métriques d'un système sous charge, **localiser le goulot** (pas le deviner), et concevoir la **stratégie de scaling/caching** la moins chère qui le traite — le tout justifié dans un mini-ADR.
> **Vrai outil :** un tableau de métriques réel (trace + saturation ressources) + un document de décision (ADR au format Markdown). Pas de code à faire tourner : c'est un exercice de **décision d'architecture**.
> **Feedback :** le coach valide le raisonnement en session — il n'y a pas de « bonne réponse » auto-corrigée, il y a une décision **défendable** ou non.

---

## Énoncé

TribuZen tourne en production. Le backend est un **NestJS stateless** (auth JWT) devant **PostgreSQL** (un seul nœud) et **Redis**. Le nombre de familles est passé de 500 à **8 000** en trois mois. Le support remonte : « l'appli rame le matin ».

On te confie la décision d'architecture. **Interdit de coder une solution en aveugle** : tu dois d'abord **localiser le goulot** à partir des mesures, puis choisir le **levier le moins cher** qui le traite (rappel de l'ordre : mesurer → corriger → cacher → read replicas → scale-out → sharder).

### Les mesures qu'on te donne

**1. Latences par endpoint (percentiles, au pic 7h-9h) :**

| Endpoint | p50 | p95 | p99 | req/s au pic |
|----------|-----|-----|-----|--------------|
| `GET /families/:id/dashboard` | 210 ms | 1 400 ms | 3 200 ms | 180 |
| `POST /routines/:id/complete` | 40 ms | 90 ms | 260 ms | 25 |
| `GET /families/:id/members` | 15 ms | 30 ms | 45 ms | 60 |

**2. Trace d'une requête dashboard lente (p95) :**

```
GET /families/:id/dashboard             total 1 380 ms
├─ auth JWT + parsing .....................  6 ms
├─ SELECT routines WHERE familyId = ... ...  14 ms
├─ boucle "pour chaque enfant" ........... 1 300 ms
│    └─ SELECT count(*) FROM completions
│         WHERE childId = ? (scan complet)     ← répété N fois
├─ SELECT badges WHERE familyId = ... .....  20 ms
└─ sérialisation JSON .....................  40 ms
```

**3. Saturation des ressources au pic :**

| Ressource | Utilisation |
|-----------|-------------|
| CPU des 2 instances NestJS | 22 % |
| CPU PostgreSQL | 88 % |
| Écritures PostgreSQL | 12 % du total des requêtes DB |
| Mémoire Redis | 15 % |
| Bande passante réseau | 8 % |

**4. Contexte produit :**
- Le dashboard change surtout au moment où un enfant **complète** une routine (`POST .../complete`, ~25 req/s).
- Voir une complétion apparaître avec **jusqu'à 1 minute** de retard est **sans conséquence** pour les parents.
- Les familles ne partagent **aucune** donnée entre elles (isolation naturelle par `familyId`).

---

## Étapes (en friction)

Tu produis **un document** `adr-scaling-dashboard.md`. À chaque étape, **écris ta réponse** — ne la garde pas en tête.

1. **Localise le goulot.** À partir des mesures 1-2-3 : quel endpoint ? quel maillon (app CPU / lecture DB / écriture DB / réseau) ? **Cite le chiffre** qui le prouve. Nomme au passage l'anti-pattern visible dans la trace.
2. **Élimine les fausses pistes.** Explique en une phrase chacune pourquoi elle ne traite PAS le goulot : (a) « ajouter 4 instances NestJS », (b) « sharder PostgreSQL par familyId ». Appuie-toi sur les chiffres de saturation.
3. **Choisis les leviers, dans l'ordre de coût.** Descends la liste (corriger → cacher → read replicas → scale-out → sharder) et arrête-toi dès que le goulot est traité. Pour chaque levier retenu, dis ce qu'il corrige.
4. **Conçois la stratégie de cache** pour le dashboard : quoi cacher, à quel **niveau** (et pourquoi pas un autre), quel **TTL**, quelle **invalidation**. Justifie le TTL par la **staleness** tolérée (mesure 4).
5. **Anticipe la suite.** Si les familles passent à 100 000 et que les **écritures** commencent à saturer le primaire : quel serait le prochain levier, quel **shard key**, et quel piège surveiller ? (Tu ne l'implémentes pas — tu documentes le seuil de décision.)
6. **Écris le mini-ADR** : Contexte / Décision / Alternatives rejetées / Conséquences (dont ce que tu acceptes de sacrifier). 20-30 lignes, pas plus.

---

## Grille d'évaluation (le coach coche)

| Critère | Attendu | ✓/✗ |
|---------|---------|-----|
| Goulot localisé par la **mesure** | pointe `dashboard` + **lecture PostgreSQL (CPU 88 %)** + nomme le **N+1** dans la trace — pas une intuition | |
| Fausses pistes éliminées avec chiffres | scale-out inutile (CPU app 22 %) ; sharding inutile (écritures 12 %, un nœud pas plein) | |
| Ordre des leviers respecté | commence par **corriger le N+1 / précalculer**, PAS par ajouter des serveurs | |
| Stratégie de cache complète | quoi + **niveau Redis** (justifié vs in-memory multi-instance) + TTL + invalidation à la complétion | |
| TTL justifié par la **staleness produit** | relie le TTL (~60 s) à « 1 min de retard sans conséquence » | |
| Raisonne en **percentiles** | parle de p95/p99, pas de moyenne | |
| Sharding correctement **différé** | dernier recours ; shard key `familyId` ; piège scatter-gather / hotspot nommé | |
| ADR défendable | conséquences explicites, y compris le **compromis accepté** (ex. eventual consistency sur les lectures) | |

**Seuil de réussite :** 6/8, dont **obligatoirement** les deux premiers (localiser + éliminer les fausses pistes). Deviner le goulot = échec du lab, même si la solution finale est bonne.

---

## Corrigé de référence (à ne lire qu'après avoir produit ton ADR)

**1. Goulot.** L'endpoint `dashboard` (p95 1 400 ms, p99 3 200 ms). Maillon = **lecture PostgreSQL** : CPU PG à **88 %**, et la trace montre 1 300 ms sur une **boucle N+1** (un `SELECT count(*)` avec scan complet **par enfant**). Le CPU applicatif (22 %) et le réseau (8 %) ne sont pas saturés.

**2. Fausses pistes.**
- **+4 instances NestJS** : le CPU app est à 22 %, il n'est pas le goulot. Pire, plus d'instances = plus de connexions vers la base déjà à 88 % → aggrave.
- **Sharder PostgreSQL** : les écritures ne pèsent que 12 %, un seul nœud n'est ni plein ni saturé en écriture. Sharder ne rendrait pas la requête N+1 plus rapide (elle resterait lente sur chaque shard) et ajouterait une complexité massive pour rien.

**3. Leviers, dans l'ordre.**
- **Corriger (étape 1, le vrai fix)** : remplacer le N+1 par une agrégation unique (`GROUP BY childId`) et **précalculer la série** (colonne `currentStreak` mise à jour à la complétion, ou vue matérialisée). À lui seul, ça fait chuter le p95.
- **Cacher (étape 2)** : le dashboard est lu ~180 req/s et change peu dans la journée → cache. On s'arrête là : read replicas / scale-out / sharding ne sont pas nécessaires au niveau de charge actuel.

**4. Stratégie de cache.**
- **Quoi :** la réponse dashboard agrégée, par famille (clé `dashboard:family:<id>`).
- **Niveau :** **Redis** (partagé). Pas d'in-memory par instance : avec 2 instances NestJS, chaque cache local serait incohérent (une instance purge, l'autre sert du périmé).
- **TTL :** ~**60 s**. Justifié par la mesure 4 : 1 min de retard est sans conséquence produit.
- **Invalidation :** **explicite** à chaque `POST /routines/:id/complete` → purge `dashboard:family:<id>` de cette famille (en plus du TTL, pour éviter d'attendre 60 s après une complétion visible par le parent qui vient d'agir).

**5. Anticipation (100 k familles, écritures qui saturent).**
- Prochain levier après read replicas : **sharding**, `familyId` comme **shard key** (haute cardinalité, isolation naturelle par famille, présent dans quasiment toutes les requêtes → requêtes ciblées, pas de scatter-gather).
- Piège à surveiller : les rapports admin **cross-famille** (ex. « toutes les familles inactives ») deviendraient des scatter-gather — à sortir du chemin critique (job async / entrepôt de lecture).
- Seuil de décision documenté : ne sharder que si un single-node + read replicas + partitionnement natif PG sont **épuisés**.

**6. ADR** (forme attendue) :

```
# ADR 021 — Scaling du dashboard familial

## Contexte
8 000 familles. Dashboard p95 1 400 ms au pic. Mesure : PostgreSQL à 88 % CPU,
N+1 sur le calcul de série. App CPU 22 %, écritures 12 %.

## Décision
1. Corriger le N+1 (agrégation GROUP BY) + précalculer la série.
2. Cache Redis du dashboard par famille, TTL 60 s, purge à la complétion.

## Alternatives rejetées
- Scale-out NestJS : app CPU non saturé (22 %) — ne traite pas le goulot.
- Sharding PostgreSQL : écritures faibles (12 %), un nœud non plein — coût injustifié.

## Conséquences
- p95 attendu < 100 ms sans serveur ni shard ajouté.
- Compromis accepté : le dashboard peut être périmé jusqu'à 60 s (toléré par le produit).
- Read replicas et sharding restés en réserve, seuils de décision documentés.
```

**Pourquoi ce corrigé est correct :** il **mesure** avant de décider, élimine les fausses pistes **avec les chiffres**, prend le levier **le moins cher** qui traite le goulot, et documente ce qu'il **sacrifie** (staleness 60 s). Il ne saute aucune étape de l'échelle de coût.

---

## Variante J+30 (fading)

**Même exercice, un mois plus tard, contraintes ajoutées — sans rouvrir ce corrigé, en 30 minutes :**

On te donne un **nouveau** jeu de métriques (que le coach te remet) où cette fois :
- le CPU **applicatif** est à **90 %**, la base à 40 %, et
- un endpoint `POST /routines/bulk-import` a un p99 de **8 s**.

Produis un nouvel ADR qui :
1. Localise le goulot (différent de l'exercice initial — attention au piège de rejouer la réponse précédente).
2. Décide le levier (indice : le stateless devient central ici) **et** vérifie explicitement la condition qui le rend possible.
3. Traite `bulk-import` **hors** du chemin critique (rappelle le module 12).

**Critère de réussite :** tu ne rejoues pas mécaniquement « corriger + cacher » — tu re-mesures, et le goulot applicatif t'amène cette fois au **scale-out**, avec la vérification stateless comme préalable non négociable.

---

## Application TribuZen

Dans le repo `smaurier/tribuzen`, ce travail ne produit pas du code mais une **décision tracée** :

```
tribuzen/
  docs/
    adr/
      021-scaling-dashboard.md
```

**Différences par rapport au lab :**
- Les métriques viendront de l'**observabilité réelle** (module 22 / cours 12) — APM et dashboards, pas un tableau fourni.
- Le fix du N+1 et le précalcul de série seront de **vrais commits** (cours 10 pour le SQL, module 12 pour la mise à jour à la complétion).
- Le cache Redis sera implémenté avec le vrai client (détail cours 11 pour les en-têtes HTTP éventuels côté API).

**Commit cible :**
```
docs(adr): 021 scaling dashboard — goulot lecture DB, fix N+1 + cache Redis, sharding différé
```
