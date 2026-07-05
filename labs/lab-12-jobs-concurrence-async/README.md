# Lab 12 — Jobs, concurrence et asynchronisme

> **Outcome :** à la fin, tu sais **concevoir** le système de jobs d'une feature TribuZen : décider ce qui est synchrone vs déporté en background, dessiner l'anatomie producteur/file/worker avec retry, backoff et dead letter queue, écrire des clés d'idempotence déterministes, et choisir + justifier une stratégie de concurrence sur un état partagé.
> **Vrai outil :** un document de conception (Markdown + un schéma ASCII/Mermaid) — **pas** de code de framework, **pas** de harnais. On raisonne archi. L'implémentation BullMQ/NestJS est le cours 09 ; le SQL des verrous, le cours 10.
> **Feedback :** le coach valide la conception en session avec la grille ci-dessous. Aucun test-runner auto-correcteur.

---

## Énoncé

TribuZen ajoute une feature : **le défi hebdomadaire de famille**.

> Chaque lundi, une famille se fixe un défi (« compléter sa routine 5 jours cette semaine »). Le système doit :
>
> 1. **Rappeler** chaque soir à 19h aux enfants qui n'ont pas encore complété leur routine du jour (push + email de secours).
> 2. **Incrémenter un compteur de progression partagé par la famille** à chaque routine complétée (l'objectif : atteindre le seuil du défi).
> 3. **Relancer** à J+2 les membres à 0 complétion (« Rejoins le défi ! »).
> 4. **Générer le récap** dimanche soir : qui a tenu le défi, badge débloqué, PDF envoyé aux parents.
> 5. **Absorber la sync offline** : l'app mobile, coupée du réseau, pousse au retour un **batch** de complétions déjà faites localement.

Ton travail : **concevoir l'architecture asynchrone de cette feature**. Tu ne codes pas l'implémentation — tu produis les **décisions**, le **schéma** et les **justifications** qu'un dev pourra ensuite implémenter (au cours 09).

Contexte technique donné (contraintes) :
- Le backend NestJS tourne sur **plusieurs workers** (scaling horizontal) → concurrence réelle.
- Les files sont **at-least-once** (un job peut être rejoué).
- Le serveur d'envoi (email/push) est un **tiers faillible** (peut être momentanément down).
- TribuZen est **multi-tenant** : une famille = un tenant, jamais de fuite entre familles.

**Pas de gap-fill, pas de starter à compléter.** Tu produis un document `conception-jobs-defi.md` à partir de la trame ci-dessous.

### Trame à remplir (le livrable)

```md
# Conception — jobs du défi hebdomadaire

## 1. Tableau sync vs async
| Opération | Sync ou job ? | Type de job | Justification (1 ligne) |
|-----------|---------------|-------------|--------------------------|
| ...       | ...           | ...         | ...                      |

## 2. Schéma producteur / file / worker
(ASCII ou Mermaid — placer producteur, file(s), worker(s), scheduler, retry, DLQ)

## 3. Clés d'idempotence
| Job | Clé d'idempotence (déterministe) | Pourquoi cette clé |
|-----|----------------------------------|--------------------|

## 4. Retry / backoff / DLQ
| Job | attempts | backoff | Que fait-on à l'épuisement ? |
|-----|----------|---------|------------------------------|

## 5. Concurrence sur le compteur de défi
- Stratégie choisie : ...
- Alternatives écartées + pourquoi : ...
- Contexte multi-worker pris en compte : ...

## 6. Multi-tenant
- Comment chaque job connaît-il sa famille ? ...

## 7. ADR (5-8 lignes) : la décision la plus contestable
Contexte / Décision / Conséquences.
```

---

## Étapes (en friction)

1. **Classe chaque opération (1 à 5 de l'énoncé) sync vs job.** Pour chaque job, donne son **type** (immédiat, différé, planifié, récurrent, prioritaire). Piège volontaire : l'incrément du compteur (op. 2) — est-ce vraiment un job de fond, ou une écriture synchrone concurrente ? Tranche et justifie.
2. **Dessine le schéma.** Une file suffit-elle, ou faut-il séparer (ex. `reminders` vs `recap`) ? Place le **scheduler** (qui porte le 19h et le dimanche), les **retry**, la **DLQ**. Montre que producteur et workers sont **découplés** par la file.
3. **Écris une clé d'idempotence par job à effet de bord.** Vérifie qu'elle est **déterministe** : un rejeu du **même** travail produit la **même** clé. Chasse tout `uuid()` généré à l'exécution.
4. **Paramètre retry/backoff/DLQ.** Le rappel du soir (tiers faillible, volume) et le récap PDF n'ont pas la même criticité ni le même profil d'échec → des `attempts`/`backoff` différents. Décide ce qu'on fait à l'épuisement (alerte ? réenfiler manuellement ?).
5. **Résous la concurrence du compteur.** Deux enfants complètent à la même seconde → race condition. Choisis optimiste / pessimiste / distribué, **écarte** explicitement les deux autres, et **tiens compte** du multi-worker (une machine ne suffit pas à arbitrer si le verrou est en mémoire process).
6. **Fais voyager le tenant.** Montre où `familyId` apparaît dans le payload de chaque job, et pourquoi il ne peut **pas** être implicite.
7. **Écris l'ADR** de ta décision la plus discutable (souvent : la stratégie de concurrence, ou « une file ou plusieurs »). Contexte → Décision → Conséquences.

---

## Corrigé complet commenté

> Un corrigé **de référence** — pas la seule bonne réponse. Le coach évalue la **cohérence des décisions**, pas la conformité mot à mot.

```md
# Conception — jobs du défi hebdomadaire

## 1. Tableau sync vs async
| Opération | Sync ou job ? | Type de job | Justification |
|-----------|---------------|-------------|---------------|
| 1. Rappel du soir 19h | JOB | récurrent (cron 19h) qui produit N jobs immédiats | volume + tiers faillible + horaire ; l'utilisateur n'attend rien |
| 2. Incrément compteur défi | SYNC (écriture concurrente protégée) | — | résultat immédiat attendu (progression affichée) ; le vrai enjeu n'est pas "fond" mais "concurrence" |
| 3. Relance J+2 | JOB | différé (delay 48h) ou récurrent qui scanne | différé dans le temps par nature |
| 4. Récap dimanche + PDF | JOB | planifié (dimanche 20h) | long (agrégat + PDF), aucune interactivité |
| 5. Sync offline batch | JOB | immédiat, par lot (backpressure) | volume au retour réseau ; doublons possibles -> idempotence |

# Piège assumé : l'op. 2 n'est PAS un background job. Le compteur doit être à jour
# tout de suite (l'enfant voit sa progression). C'est une écriture SYNCHRONE dont le
# problème est la CONCURRENCE, pas le déport en fond. Confondre les deux est l'erreur type.

## 2. Schéma producteur / file / worker

  ┌─────────────┐  enqueue   ┌──────────────┐  pull   ┌───────────────┐
  │  API NestJS  │ ─────────▶ │ file "reminders" │ ────▶ │ worker reminders │
  │ (producteur) │            └──────────────┘         └───────┬────────┘
  └─────────────┘                                  succès? non → retry (backoff+jitter)
        ▲                                                       │ épuisé
        │ produit à 19h                                          ▼
  ┌─────────────┐                                        ┌──────────────┐
  │  SCHEDULER   │  cron 19h  → 1 job/membre à rappeler   │  DLQ + alerte │
  │  cron dim.20h│ ─────────▶ file "recap" → worker recap  └──────────────┘
  └─────────────┘
# Deux files séparées (reminders vs recap) : profils différents (volume vs lourdeur),
# on ne veut pas qu'un récap PDF de 5s retienne 10 000 rappels. Producteur et workers
# sont découplés : l'API peut planter, les jobs survivent dans la file.

## 3. Clés d'idempotence
| Job | Clé | Pourquoi |
|-----|-----|----------|
| Rappel soir | reminder:{familyId}:{routineId}:{memberId}:{jour} | un seul rappel par membre/routine/jour, même si rejoué |
| Relance J+2 | relance:{familyId}:{memberId}:{semaine} | une relance par membre par semaine |
| Récap | recap:{familyId}:{semaine} | un seul récap par famille par semaine |
| Sync offline | complete:{familyId}:{routineId}:{memberId}:{jour} | le serveur absorbe un doublon de complétion sans erreur |
# Toutes déterministes : encodent l'INTENTION. Aucun uuid() généré dans le worker.

## 4. Retry / backoff / DLQ
| Job | attempts | backoff | À l'épuisement |
|-----|----------|---------|----------------|
| Rappel soir | 4 | exponentiel + jitter | DLQ + alerte "push famille X échoue" (token invalide probable) |
| Récap PDF | 3 | exponentiel | DLQ + alerte ; réenfilable manuellement (pas de perte de donnée) |
| Sync offline | 5 | exponentiel + jitter | DLQ ; log par complétion pour rejeu ciblé |
# Jitter sur les jobs à VOLUME (rappels du soir : 10 000 d'un coup) pour éviter le
# thundering herd sur le serveur push.

## 5. Concurrence sur le compteur de défi
- Choisi : VERROU OPTIMISTE (champ version) + retry (max 3).
- Écarté — pessimiste : sérialiserait les complétions ; conflits trop rares pour payer
  le goulot (deux complétions à la même seconde = exception, pas la norme).
- Écarté — distribué : la base de données arbitre déjà l'écriture ; un verrou Redis
  serait redondant ici. On le garderait pour "un seul job d'import/famille" (unicité
  inter-workers), pas pour un compteur.
- Multi-worker pris en compte : un verrou en mémoire process ne protégerait que 1 worker.
  L'optimiste s'appuie sur la version EN BASE, partagée par tous les workers -> correct
  en scaling horizontal.

## 6. Multi-tenant
- Chaque payload de job porte familyId (le tenant). Le worker s'exécute hors de la
  requête HTTP qui connaissait la famille : le contexte NE PEUT PAS être implicite.
- Files partagées mais données scopées par familyId ; à volume, on pourrait prioriser
  pour éviter qu'une famille très active affame les autres (noisy neighbor).

## 7. ADR — Stratégie de concurrence du compteur de défi
Contexte : compteur partagé famille, backend multi-worker, complétions parfois
simultanées, conflits rares.
Décision : verrou optimiste (version) + retry (3) plutôt que pessimiste.
Conséquences : pas de blocage, scalable ; nécessite une logique de retry sur conflit ;
à réévaluer vers pessimiste si un compteur devient global et fortement contendu.
```

**Pourquoi ce corrigé est correct :**
- Il **ne déporte pas** l'incrément du compteur en background (piège n°1) : le problème y est la **concurrence**, pas l'asynchronisme.
- Il **sépare les files** par profil de charge, ce qui isole un job lourd d'un flot de petits jobs.
- Toutes les clés d'idempotence sont **déterministes** et incluent le **tenant**.
- Le choix de concurrence est **justifié par le contexte** (conflits rares + multi-worker → optimiste sur version en base), avec les alternatives **explicitement écartées**.
- L'ADR nomme la décision la plus contestable et prévoit la **condition de réévaluation**.

---

## Variante J+30 (fading)

**Même exercice, contraintes ajoutées, en 30 minutes, sans rouvrir ce corrigé ni le module 12 :**

1. **Nouvelle exigence :** le récap PDF doit être généré **une seule fois** même si le scheduler dysfonctionne et enfile le job **deux fois** dimanche soir — et la génération dure 8s. Comment garantis-tu l'unicité **et** évites-tu que deux workers génèrent le même PDF **en parallèle** (pas seulement en séquence) ? *(Indice : idempotence seule ne suffit pas contre le parallélisme simultané — il faut aussi un verrou distribué « un récap/famille/semaine à la fois ».)*
2. **Nouvelle exigence :** un enfant peut appartenir à **deux familles** (parents séparés). Vérifie que tes clés d'idempotence et ton scoping tenant tiennent toujours (indice : `memberId` seul ne suffit plus à identifier « dans quelle famille »).

**Critère de réussite :** ton document traite explicitement le **parallélisme simultané** (verrou distribué TTL+token) en plus de l'idempotence, et tes clés restent correctes avec un membre multi-familles.

---

## Application TribuZen

Dans le repo `smaurier/tribuzen`, cette conception précède le code du module `challenges` :

```
tribuzen-api/
  src/
    challenges/
      application/
        challenge-reminder.producer.ts   ← enqueue (module 05 : couche application)
      jobs/
        reminder.worker.ts               ← idempotence + garde métier
        recap.worker.ts                  ← planifié, lecture seule
      domain/
        challenge-counter.ts             ← invariant + version (optimistic lock)
    docs/adr/
      0012-concurrence-compteur-defi.md  ← l'ADR du §7
```

**Différences par rapport au lab :**
- Ici tu produis un **document de conception** ; dans le repo, il devient un **ADR versionné** (`docs/adr/`) + le squelette des workers.
- L'implémentation réelle (BullMQ, Redis, `@Processor`) est faite **au cours 09**, en s'appuyant sur ces décisions.
- Le verrou optimiste concret (`@VersionColumn`, retry sur `OptimisticLockVersionMismatchError`) est écrit **au cours 10**.

**Commit cible :**
```
docs(challenges): ADR jobs du défi — sync/async, idempotence, concurrence compteur
```
