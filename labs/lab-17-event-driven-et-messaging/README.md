# Lab 17 — Architecture événementielle & messaging

> **Outcome :** à la fin, tu sais **concevoir** un flux event-driven complet pour un scénario TribuZen — nommer les messages (événement vs commande), choisir queue vs topic, trancher choreography vs orchestration, poser la garantie de livraison + l'idempotence, et placer un BFF — puis **défendre** chaque choix.
> **Vrai outil :** ta tête, un schéma (papier, Excalidraw ou Mermaid) et un mini-ADR en Markdown. C'est un lab de **conception**, pas d'implémentation : aucun broker à brancher, aucun code à faire tourner.
> **Feedback :** le coach valide en session à la grille ci-dessous — pas de test-runner auto-correcteur.

---

## Énoncé

TribuZen ajoute une fonctionnalité : **« Journée famille »**. Quand un parent **publie une journée famille** (un ensemble de sorties + repas + rappels pour un jour donné), le système doit réagir sur plusieurs fronts :

1. **Notifier** chaque membre de la famille (push mobile).
2. **Alimenter le feed familial** avec une carte « Journée du samedi ».
3. **Recalculer les suggestions** de sorties pour cette famille.
4. **Exporter** chaque sortie de la journée vers **Google Calendar** (API externe, lente, parfois indisponible).
5. **Archiver une métrique** « journée publiée » pour un dashboard interne (best-effort, non critique).

Côté clients, l'app **mobile React Native** et le **web** consomment tout ça. Le mobile veut afficher son écran d'accueil (« journées à venir » + feed + routines du jour) sans multiplier les allers-retours réseau.

**Ta mission : produire le dossier de conception du flux.** Tu ne codes pas les services ; tu **décides et justifies l'architecture des messages**.

### Livrables attendus

1. **Un schéma de flux** : producteur(s), broker (avec queue**s** et/ou topic**s** explicitement nommés), consommateurs, et les flèches de messages étiquetées par le **nom du message**.
2. **Un tableau des messages** : pour chacun des 5 besoins → nom du message, **événement ou commande**, **queue ou topic**, garantie de livraison visée, stratégie d'idempotence.
3. **Un mini-ADR** (« Architecture Decision Record », 15-25 lignes) qui tranche **choreography vs orchestration** pour ce flux et **justifie**.
4. **Un paragraphe edge** : où places-tu un **BFF** et un **API Gateway**, et qu'est-ce que chacun résout ici ?

> Pas de gap-fill, pas de squelette à trous : tu produis le dossier à partir de la page blanche. Le corrigé plus bas est une **référence pour le débrief**, pas un modèle à recopier.

---

## Étapes (en friction)

Fais-le **dans cet ordre**, sans lire le corrigé, en écrivant chaque décision (pas juste « dans ta tête ») :

1. **Nomme les 5 messages.** Pour chacun, tranche : **fait passé** (événement, nommé au participe passé) ou **intention visant un destinataire précis** (commande, nommée à l'impératif) ? Écris le nom exact.
2. **Choisis la primitive de chaque message.** Un seul acteur doit agir → **queue**. Plusieurs, indépendants, doivent savoir → **topic** (fan-out). Justifie en une phrase par message.
3. **Pose la garantie de livraison** de chaque message. Lequel tolère la perte (at-most-once) ? Lesquels exigent at-least-once ? Pour ces derniers, **écris la stratégie d'idempotence** (clé de dédup ? opération rejouable ?).
4. **Traite le cas faillible.** L'export Google Calendar peut échouer/retenter : ajoute retries + **DLQ**. Sémantiquement, événement ou commande ? Justifie.
5. **Tranche choreography vs orchestration** pour l'ensemble, et écris le mini-ADR (contexte / décision / conséquences / alternative rejetée).
6. **Place l'edge** : dessine où vit le BFF (combien ? pour qui ?) et l'API Gateway, et ce que chacun résout dans CE scénario.
7. **Anticipe le changement :** en 2 lignes, montre ce qu'il faut toucher pour ajouter demain un 6ᵉ consommateur « prévenir les grands-parents ». Si ta réponse touche le producteur, reviens à l'étape 2.

---

## Grille d'évaluation (coach)

Le coach coche. Objectif : **autonomie page blanche**, pas la perfection cosmétique du schéma.

| # | Critère | Vert | Rouge |
|---|---------|------|-------|
| 1 | **Événement vs commande** | Notif/Feed/Suggestions/Métrique = événements au passé ; Export Calendar = commande à l'impératif, justifié | Tout nommé « événement » ; ou une commande déguisée émise par le producteur (recouplage) |
| 2 | **Queue vs topic** | Fan-out (notif+feed+suggestions) sur **topic** ; travail unique (export, métrique) sur **queue**/topic léger, justifié par « un seul agit / plusieurs savent » | Fan-out sur une queue (2 consommateurs ne verraient jamais le message) ; ou aucun critère explicite |
| 3 | **Garanties + idempotence** | at-least-once assumé sur les messages critiques **avec** stratégie d'idempotence concrète (dédup `eventId` / opération `SET`) ; at-most-once assumé sur la métrique | « exactly-once » exigé du broker ; ou idempotence absente/vague |
| 4 | **DLQ / poison** | Export Calendar avec retries + DLQ après N échecs | Retries infinis, ou échec silencieux, ou export qui bloque tout le flux |
| 5 | **Choreography vs orchestration** | Choix tranché **et** justifié par la nature du flux (indépendant → choreography) ; ADR lisible | Choix par slogan (« plus découplé donc mieux ») sans lien au besoin |
| 6 | **Découplage du producteur** | Ajouter un 6ᵉ consommateur = 0 ligne dans le producteur | Ajouter un consommateur oblige à rouvrir le service qui publie |
| 7 | **API Gateway vs BFF** | Gateway = infra unique (routing/auth/rate limit) ; BFF **par client**, agrège la home mobile + garde le token ; rôles non confondus | Gateway et BFF confondus ; ou logique métier mise dans le Gateway ; ou un seul BFF « pour tous » |

**Seuil de réussite :** 6/7 critères au vert, dont **obligatoirement** #2 (queue/topic) et #3 (idempotence) — ce sont les deux pièges qui coûtent le plus cher en prod.

---

## Débrief coach — seeds de relance

Le coach ne laisse pas passer un dossier « qui a l'air bon ». Il **sonde** (à lâcher au fil, pas en rafale) :

- « Ton message Export Calendar : événement ou commande ? Pourquoi ce n'est **pas** un événement comme les autres ? »
- « Le broker te livre le même message deux fois — ça arrive vraiment en at-least-once. Que se passe-t-il côté Notifications si tu n'as rien prévu ? Montre-moi la ligne qui l'empêche. »
- « Tu as mis le fan-out sur une queue. Combien de tes trois consommateurs reçoivent le message ? Dessine-le. »
- « Google Calendar est down 20 minutes. Où sont les messages pendant ce temps ? Et après 10 échecs sur le même, il va où ? »
- « Pourquoi choreography ici et pas un orchestrateur ? Qu'est-ce qui changerait ta réponse ? » (réponse attendue : un processus long, ordonné, avec compensation → saga, module 18)
- « Un stagiaire veut ajouter “prévenir les grands-parents”. Quel(s) fichier(s) il touche ? Si c'est le producteur, ton découplage est cosmétique. »
- « BFF et API Gateway : lequel garde le token JWT, lequel fait le rate limiting ? Pourquoi pas l'inverse ? »

---

## Corrigé de référence (pour le débrief — ne pas ouvrir avant d'avoir produit ton dossier)

**Tableau des messages :**

| Besoin | Message | Type | Primitive | Garantie | Idempotence |
|--------|---------|------|-----------|----------|-------------|
| Notifier les membres | `JournéeFamillePubliée` | événement | **topic** (fan-out) | at-least-once | dédup sur `eventId` (table des IDs vus) |
| Alimenter le feed | ↳ même événement | événement | topic (même abonnement) | at-least-once | `upsert` de la carte feed par `eventId` (rejouable) |
| Recalculer suggestions | ↳ même événement | événement | topic | at-least-once | recalcul = opération naturellement idempotente (`SET` du résultat) |
| Exporter vers Calendar | `ExporterSortieCalendrier` | **commande** | **queue** dédiée + retries + **DLQ** | at-least-once | clé d'idempotence côté API (sortieId) pour éviter le double événement calendrier |
| Métrique dashboard | `JournéeVue` (mesure) | événement | topic léger | **at-most-once** | inutile (perte tolérée) |

**Pourquoi c'est correct :**
- **Un seul événement `JournéeFamillePubliée`** est publié par le producteur en **fan-out (topic)** ; Notifications, Feed et Suggestions s'y abonnent **indépendamment**. Le producteur ne les cite pas → ajouter les grands-parents = **un nouvel abonné, zéro ligne au producteur** (critère #6).
- **L'export est une commande, pas un événement** : on **veut délibérément** que le module Sync exporte vers Calendar (destinataire unique, action précise, faillible). Il vit sur sa **propre queue** avec retries exponentiels et **DLQ** après N échecs, pour ne bloquer ni le fan-out ni la publication.
- **at-least-once partout où la perte coûte**, avec **idempotence explicite** : dédup par `eventId` (notif), `upsert` (feed), `SET`/recalcul (suggestions), clé d'idempotence côté API externe (export). La métrique, jetable, reste en **at-most-once** — inutile de payer l'idempotence.
- **Choreography** : les réactions sont **indépendantes et sans ordre imposé**. Pas d'orchestrateur — ce serait du couplage gratuit. Un orchestrateur (saga) ne se justifierait que pour un processus **long, ordonné, avec compensation** (ex. inviter une autre famille avec validation multi-étapes) → module 18.
- **Edge** : un **BFF mobile** agrège « home famille » (journées à venir + feed + routines) en **une** requête et garde le JWT côté serveur (cookie `httpOnly`) ; un **BFF web** compose différemment. Les deux passent par un **API Gateway** unique (routing `/journees`, auth, rate limiting). Le Gateway ne porte **aucune** logique métier ; l'agrégation vit dans le BFF.

**ADR minimal (extrait) :**
```
# ADR-017 — Fan-out event-driven pour « Journée famille »
Contexte : la publication d'une journée doit déclencher 5 réactions hétérogènes,
dont une lente/faillible (Calendar) et une jetable (métrique).
Décision : le producteur émet UN événement JournéeFamillePubliée sur un topic (fan-out,
choreography). Consommateurs indépendants, at-least-once + idempotence. Export = commande
sur queue dédiée + DLQ. Métrique = at-most-once.
Conséquences : + découplage total du producteur ; + résilience (message attend si down).
              − cohérence différée (feed pas à jour à la ms près) — acceptable ici.
Alternative rejetée : orchestrateur central — couplage gratuit, aucun processus ordonné ici.
```

---

## Variante J+30 (fading)

**Même exercice, contrainte ajoutée — de mémoire, en 25 minutes, sans rouvrir le module ni ce corrigé :**

TribuZen ajoute **« Inviter une famille voisine à la journée »**, qui devient un **vrai processus long** : (1) envoyer l'invitation → (2) attendre l'acceptation → (3) si acceptée, fusionner les calendriers → (4) **si l'étape 3 échoue, annuler l'invitation (compensation)**.

Reconçois le flux pour CE cas. Attendu :
1. Tu détectes que le pur fan-event ne suffit plus (étapes **ordonnées** + **compensation**).
2. Tu bascules sur un **orchestrateur** et nommes le pattern : **saga** (que tu approfondiras au module 18).
3. Tu montres **où** l'orchestrateur émet des **commandes** et **écoute** des événements de retour, et **comment** l'étape de compensation annule l'étape 3.

**Critère de réussite :** tu justifies le passage choreography → orchestration **par la nature du processus** (ordre + compensation), pas par préférence, et tu places la compensation au bon endroit.

---

## Application TribuZen

Dans le repo `smaurier/tribuzen`, ce dossier de conception se matérialise **d'abord en documentation d'archi**, avant toute ligne de code :

```
tribuzen/
  docs/
    adr/
      ADR-017-event-driven-journee-famille.md   ← ton ADR
    diagrams/
      journee-famille-fanout.excalidraw          ← ton schéma de flux
```

**Ce qui sera ensuite implémenté (hors de ce lab) :**
- Le **broker concret** (SQS/SNS ou RabbitMQ) et sa config → relève du **cours 12**, pas de la conception.
- Les **workers/consommateurs** avec retries et backoff → **module 12** (jobs/concurrence).
- La dédup `eventId` sera une petite table `processed_events(event_id, consumer, processed_at)`.

**Commit cible (doc d'archi) :**
```
docs(archi): ADR-017 flux event-driven « Journée famille » (fan-out topic, export=commande+DLQ, choreography)
```
