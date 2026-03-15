# Correction — Exercice 07b : Quand NE PAS decomposer

## Résultat attendu

Un raisonnement pragmatique qui montre que la réponse n'est pas toujours "microservices" ni toujours "monolithe" — ça dépend du contexte.

## Cas A — Startup MVP → NON aux microservices

**Decision** : Rester en monolithe modulaire.

| Critère | Évaluation |
|---|---|
| > 1 équipe ? | Non (3 devs) |
| Deploy > 15min ? | Non (probable < 5min) |
| Equipes se bloquent ? | Non (1 équipe) |
| Scaling différent ? | Non (500 users) |
| Expertise DevOps ? | Probablement non (3 devs) |
| Cout justifie ? | Non |

**Justification** :
1. **3 devs pour N services** = chaque dev maintient N/3 services (CI/CD, monitoring, DB, deploys)
2. **500 utilisateurs** = un seul serveur suffit largement, pas de problème de scale
3. **MVP** = le produit va pivoter — les boundaries vont changer
4. **Cout** : Kubernetes, message queues, service mesh, observabilité distribuee — budget x3 minimum
5. **Vitesse** : le monolithe est plus rapide a développer pour une petite équipe

**Alternative** :
```
Monolithe modulaire NestJS :
  src/
    modules/
      catalog/    → module NestJS isole
      cart/       → module NestJS isole
      order/      → module NestJS isole
    shared/       → types partages

Regle : les modules communiquent par INTERFACES, pas par acces direct.
→ Quand l'equipe grandit, extraire un module = creer un service.
```

## Cas B — Scale-up en croissance → OUI, decomposition progressive

**Decision** : Decomposition progressive, pas Big Bang.

| Critère | Évaluation |
|---|---|
| > 1 équipe ? | Oui (4 squads, 25 devs) |
| Deploy > 15min ? | Oui (45min) |
| Equipes se bloquent ? | Oui (conflits quotidiens) |
| Scaling différent ? | Probable |
| Expertise DevOps ? | A vérifier |
| Cout justifie ? | Oui (productivite perdue > cout migration) |

**Plan de migration** :
```
Phase 0 : Modulariser le monolithe PHP (6 mois)
  → Separer les modules, interfaces claires
  → Reduire le temps de deploy (CI parallelise)

Phase 1 : Extraire Notification Service (async, zero risque)
Phase 2 : Extraire Catalog Service (lectures, search)
Phase 3 : Extraire Order + Payment (coeur metier, en dernier)

Duree totale estimee : 12-18 mois
Le monolithe continue a fonctionner pendant toute la migration (Strangler Fig)
```

## Cas C — Feature isolee → EXTRAIRE LE SEARCH UNIQUEMENT

**Decision** : Extraire le search en service dédié, garder le reste en monolithe.

| Critère | Évaluation |
|---|---|
| > 1 équipe ? | Non (1 squad) |
| Deploy > 15min ? | Non |
| Equipes se bloquent ? | Non |
| Scaling différent ? | OUI (search CPU-intensive) |
| Expertise DevOps ? | Pour 1 service : oui |
| Cout justifie ? | Oui (pour 1 service) |

```
Architecture cible : Monolithe + 1 service

┌──────────────┐        ┌──────────────┐
│  CMS         │──HTTP──│ Search       │
│  Monolithe   │        │ Service      │
│  (NestJS)    │        │ (Elasticsearch│
│              │        │  + API)      │
│  ┌────────┐  │        └──────────────┘
│  │Postgres│  │
│  └────────┘  │
└──────────────┘

Pas besoin de Kubernetes, pas besoin de message queue.
Juste 2 containers docker-compose.
```

## Ce que tu aurais pu oublier

### 1. Recommander des microservices pour 3 devs

```
FAUX — "Les microservices c'est mieux, il faut commencer tout de suite"
  → 3 devs ne peuvent pas gerer 5+ services
  → Le temps passe en ops est pris sur le temps de dev feature

CORRECT — Attendre d'avoir les symptomes avant de traiter
  → Monolithe modulaire = meme code, meme structure, sans le cout operationnel
```

### 2. Proposer un Big Bang pour le Cas B

```
FAUX — "On arrete tout pendant 6 mois et on migre"
  → Le business s'arrete pendant 6 mois
  → Le Big Bang echoue 70-80% du temps

CORRECT — Strangler Fig progressif
  → Un service a la fois, le monolithe continue
  → Chaque service est mis en production separement
```

### 3. Decomposer tout le CMS pour un problème de search

```
FAUX — "Le search est lent → on passe en microservices"
  → Over-engineering : on traite un symptome local par une solution globale

CORRECT — Extraire uniquement le search
  → Le probleme est isole, la solution est isolee
  → Le reste du monolithe n'a pas besoin de changer
```

### 4. Ignorer le cout operationnel

```
FAUX — Comparer uniquement les benefices techniques
  → Kubernetes, monitoring distribue, CI/CD par service, observabilite

CORRECT — Chiffrer le cout total
  → Infra : ~500€/mois monolithe vs ~2000€/mois microservices
  → Devops : 0.5 ETP monolithe vs 1-2 ETP microservices
  → Le gain doit depasser le cout
```
