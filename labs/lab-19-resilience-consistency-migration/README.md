# Lab 19 — Résilience, cohérence et migration

> **Outcome :** à la fin, tu sais **concevoir** la résilience d'un flux TribuZen (budget de timeout décroissant, retry + jitter, circuit breaker, bulkhead), **choisir** le modèle de cohérence de chaque donnée, et **planifier** une migration en strangler fig — puis **défendre** chaque décision.
> **Vrai outil :** ta tête, un schéma (papier, Excalidraw ou Mermaid) et deux courts documents Markdown (une fiche de résilience + un mini-plan de migration). C'est un lab de **conception et de décision**, pas d'implémentation : aucun broker à brancher, aucun code à faire tourner, aucun harnais.
> **Feedback :** le coach valide en session à la grille ci-dessous — pas de test-runner auto-correcteur.

---

## Énoncé

TribuZen est **offline-first**. Une famille coche les routines des enfants sans réseau ; l'app **React Native** (stockage local MMKV) accumule les complétions et les **pousse en batch** au retour du réseau, vers l'API. Trois faits te sont donnés :

1. **Le chemin des complétions est critique** : c'est le cœur du produit (les séries, les récompenses). Une complétion perdue = un enfant frustré.
2. **L'export vers Google Calendar** (quand un parent publie une sortie) passe par une **API externe lente, parfois indisponible** (jusqu'à 20 min de coupure observée). Il est **secondaire** : mieux vaut un export en retard qu'une synchro de routines bloquée.
3. **Un vieux module de notifications « maison »** doit être remplacé par un service propre. Il est **en production**, utilisé tous les jours ; on ne peut pas l'arrêter.

Par ailleurs, **deux téléphones** de la même famille peuvent cocher **la même routine** le même jour, chacun hors ligne, et se resynchroniser plus tard.

**Ta mission : produire le dossier de conception « résilience + cohérence + migration » de ce flux.** Tu ne codes pas les services ; tu **décides et justifies l'architecture**.

### Livrables attendus

1. **Un schéma du flux de synchronisation** : mobile → (BFF ?) → API → dépendances (base, Calendar externe). Sur chaque saut, annote le **budget de timeout**. Marque visuellement où vivent le **circuit breaker** et le **bulkhead**.
2. **Une fiche de résilience** (tableau) : pour le chemin **complétions** et le chemin **export Calendar** → timeout, politique de retry (nb d'essais, backoff, jitter, plafond), circuit breaker (seuil + comportement open), isolation bulkhead (oui/non + pourquoi), comportement en mode dégradé.
3. **Un tableau de cohérence** : pour au moins **4 données** (ta complétion à l'instant, la série vue par les autres, le feed familial, la révocation d'un rôle admin) → modèle de cohérence choisi (forte / causale / session / éventuelle) **et** la phrase « ce qui se passe si l'utilisateur voit une donnée périmée ».
4. **La règle de dédup / conflit** : comment traites-tu les deux téléphones qui cochent la même routine ? (clé d'idempotence ? LWW ? merge ?) Écris la clé exacte.
5. **Un mini-plan de migration** (10-20 lignes) du module notifications en **strangler fig** : proxy, ordre de bascule des features, anti-corruption layer, shadow traffic, réversibilité. Nomme aussi un **RPO** et un **RTO** pour la donnée « complétions serveur » et justifie les chiffres.

> Pas de gap-fill, pas de squelette à trous : tu produis le dossier à partir de la page blanche. Le corrigé plus bas est une **référence pour le débrief**, pas un modèle à recopier.

---

## Étapes (en friction)

Fais-le **dans cet ordre**, sans lire le corrigé, en **écrivant** chaque décision (pas juste « dans ta tête ») :

1. **Dessine le flux et pose les budgets de timeout.** Mobile, BFF, API, base, Calendar. Écris un nombre de secondes sur chaque saut. Vérifie qu'ils **décroissent** vers l'aval. Si un budget aval dépasse l'amont, corrige et note pourquoi c'était un bug.
2. **Rends le chemin complétions idempotent AVANT tout retry.** Écris la clé d'idempotence exacte. Sans elle, interdis-toi d'ajouter un retry (explique pourquoi en une phrase).
3. **Écris la politique de retry** du chemin complétions : nb d'essais, backoff, jitter, plafond. Puis demande-toi : *pourquoi pas de retry infini ?*
4. **Place un circuit breaker** sur chaque dépendance externe. Donne le seuil et décris le comportement en **open** (fail fast + quoi ?). Décris le **mode dégradé** de l'export Calendar.
5. **Isole l'export Calendar dans un bulkhead.** Montre, sur le schéma, que Calendar down 20 min **ne bloque pas** la synchro des routines. Si ta conception fait planter les routines quand Calendar tombe, reviens à l'étape 4.
6. **Choisis le modèle de cohérence de chaque donnée** (≥ 4). Pour chacune, écris d'abord *le coût d'une lecture périmée*, **puis** le modèle. Pas l'inverse.
7. **Tranche le conflit des deux téléphones.** Est-ce un vrai conflit ? Quelle clé le déduplique ? Dans quel cas LWW serait-il nécessaire ?
8. **Planifie la migration notifications en strangler fig** : ordre de bascule, ACL, shadow traffic, réversibilité. Puis fixe **RPO** et **RTO** pour les complétions serveur et justifie.
9. **Anticipe le changement :** en 2 lignes, que faut-il toucher pour ajouter demain un export vers **Apple Calendar** (2ᵉ API externe faillible) ? Si ta réponse touche le chemin critique des routines, ton bulkhead est cosmétique — reviens à l'étape 5.

---

## Grille d'évaluation (coach)

Le coach coche. Objectif : **autonomie page blanche**, pas la perfection cosmétique du schéma.

| # | Critère | Vert | Rouge |
|---|---------|------|-------|
| 1 | **Budget de timeout décroissant** | timeouts annotés, strictement décroissants vers l'aval (mobile > BFF > API > Calendar) | pas de timeout, ou budget aval ≥ amont (cascade non coupée) |
| 2 | **Idempotence avant retry** | clé d'idempotence explicite `(routineId, childId, day)` ; retry justifié *parce que* c'est idempotent | retry ajouté sur une opération qui `INSERT` aveuglément (doublons) ; ou aucune clé |
| 3 | **Retry maîtrisé** | backoff exponentiel + **jitter** + plafond + nb max d'essais | retry immédiat / infini, ou sans jitter (thundering herd) |
| 4 | **Circuit breaker + mode dégradé** | breaker par dépendance, comportement open (fail fast), export Calendar en **attente** plutôt que blocage | pas de breaker, ou timeouts en série jusqu'à épuisement |
| 5 | **Bulkhead** | export Calendar isolé (file/budget propres) ; Calendar down ≠ routines bloquées, montré sur le schéma | export et routines partagent tout ; une panne Calendar fait tomber les routines |
| 6 | **Cohérence par donnée** | chaque donnée a son modèle justifié par le **coût du périmé** ; session pour « ma complétion », éventuelle pour les autres, forte pour la révocation admin | un seul modèle global (« forte partout ») ; ou modèle choisi sans lien au coût |
| 7 | **Conflit / dédup** | reconnaît que la clé métier déduplique (pas un vrai conflit) ; LWW réservé aux champs éditables | LWW dégainé partout ; ou conflit ignoré → doublons de séries |
| 8 | **Strangler fig + RPO/RTO** | migration feature par feature, proxy + ACL + shadow traffic + réversible ; RPO/RTO chiffrés et justifiés | big bang (« on réécrit tout ») ; ou RPO/RTO absents / mis à 0 sans justification |

**Seuil de réussite :** 7/8 critères au vert, dont **obligatoirement** #2 (idempotence) et #5 (bulkhead) — ce sont les deux décisions qui, absentes, coûtent le plus cher en prod (doublons de séries, et panne Calendar qui gèle tout le produit).

---

## Débrief coach — seeds de relance

Le coach ne laisse pas passer un dossier « qui a l'air bon ». Il **sonde** (à lâcher au fil, pas en rafale) :

- « Tu as mis un timeout de 8 s sur l'API et 10 s sur le Calendar en aval. Que fait l'API quand elle a déjà abandonné mais que Calendar répond enfin ? Montre-moi le budget qui décroît. »
- « Le sync rejoue le batch parce que l'utilisateur a relancé l'app. Combien de complétions en double l'API crée-t-elle ? Montre-moi la clé qui l'empêche. »
- « Tu retentes 3 fois. Les 5000 téléphones de la famille… pardon, de tes familles, retentent tous à la même seconde après la coupure. Qu'est-ce qui étale ça ? »
- « Google Calendar est down 20 minutes. Pendant ce temps, un parent peut-il encore cocher les routines de ses enfants ? Trace le chemin sur ton schéma. »
- « “Cohérence forte partout”, tu as dit. Explique-moi comment on coche une routine hors réseau avec de la cohérence forte. » (réponse attendue : on ne peut pas → offline-first = éventuelle/session, pas forte)
- « Deux téléphones cochent la routine du matin le même jour. Qui gagne ? Est-ce que “qui gagne” est même la bonne question ? »
- « Tu proposes de réécrire tout le module notifs en un week-end. Quelles règles métier non documentées vas-tu découvrir en prod le lundi ? Comment le strangler fig étale ce risque ? »
- « RPO de 0 pour les complétions serveur : tu es sûr ? Le mobile a déjà la donnée en local. Est-ce que 1 h de RPO ne suffit pas, et combien ça t'économise ? »

---

## Corrigé de référence (pour le débrief — ne pas ouvrir avant d'avoir produit ton dossier)

**Fiche de résilience :**

| Chemin | Timeout | Retry | Circuit breaker | Bulkhead | Mode dégradé |
|--------|---------|-------|-----------------|----------|--------------|
| **Complétions** (critique) | mobile 10 s → BFF 8 s → API 5 s → base 2 s | 4 essais, backoff exponentiel, **jitter**, cap 30 s | seuil 5 échecs → **open** (fail fast) | non isolé du reste du critique | erreur claire + re-sync au prochain réseau |
| **Export Calendar** (secondaire) | 2 s | 3 essais, backoff, jitter | seuil 5 → open, **DLQ** après N | **oui** : file + budget propres | **mise en attente** (n'impacte pas les routines) |

**Tableau de cohérence :**

| Donnée | Coût d'une lecture périmée | Modèle |
|--------|---------------------------|--------|
| Ma complétion que je viens de cocher | l'app paraît cassée (perte de confiance) | **session** (read-your-own-writes) |
| Série vue par les autres membres | « 6 » au lieu de « 7 » 2 s : rien de grave | **éventuelle** |
| Feed familial | carte en retard d'une seconde : négligeable | **éventuelle** |
| Révocation d'un rôle admin | un ex-admin supprime une famille : **irréversible** | **forte** (linéarisable) sur le check de droit |

**Dédup / conflit :** deux téléphones qui cochent la même routine le même jour ne sont **pas** un vrai conflit. La clé métier `(routineId, childId, day)` est **unique** → l'API fait un `upsert` (`INSERT ... ON CONFLICT DO NOTHING`) : rejouer 10 fois = 1 ligne. C'est un **merge naturel par idempotence**. LWW ne servirait que pour un champ **éditable** modifié sur deux appareils (ex. le *nom* d'une routine), où l'on garderait la version au timestamp le plus récent.

**Pourquoi c'est correct :**
- **Idempotence d'abord** : la clé `(routineId, childId, day)` autorise retry ET rejeu sans doublon de série. C'est le socle — sans elle, les patterns de retry créent le bug qu'ils prétendent corriger. **at-least-once (le mobile réémet) + idempotence = exactly-once semantics.**
- **Budgets décroissants** : 10 → 8 → 5 → 2 s. L'utilisateur voit une erreur en ~3 s au lieu de 40 s, et aucun étage ne travaille pour un demandeur déjà parti.
- **Bulkhead sur Calendar** : file et budget séparés → Calendar down 20 min laisse les **routines** se synchroniser normalement. Le breaker Calendar ouvre et met en **attente** (mode dégradé), il ne bloque pas.
- **Cohérence par donnée** : session là où je dois revoir mon action, éventuelle là où le périmé est indolore et où la dispo prime (offline-first l'exige), forte seulement sur le droit destructeur.

**Mini-plan de migration (strangler fig) :**
```
# Migration module Notifications (legacy -> service propre)
1. Proxy /notifications/* en entrée, route legacy|nouveau par feature flag.
2. Anti-corruption layer : traduit l'ancien payload (types pourris) vers le modèle propre.
3. Ordre de bascule (du moins risqué au plus critique) :
   push "routine du jour"  ->  rappel de sortie  ->  invitation famille.
4. Pour chaque type : shadow traffic (envoi aux deux, comparaison en background),
   puis bascule du flag, réversible en 1 commande si régression.
5. Legacy vidé -> ACL et legacy décommissionnés.

RPO complétions serveur = 1 h : le mobile garde la donnée en local et re-sync,
  reperdre 1 h côté serveur est indolore -> backups horaires suffisent (pas de streaming coûteux).
RTO = 4 h : l'app tolère un serveur down quelques heures (les complétions s'accumulent
  en local et repartent au retour) -> failover simple, pas de multi-région coûteux.
```

---

## Variante J+30 (fading)

**Même exercice, contrainte ajoutée — de mémoire, en 30 minutes, sans rouvrir le module ni ce corrigé :**

TribuZen ajoute un **2ᵉ export externe** : **Apple Calendar** (aussi lent et faillible que Google), et une nouvelle donnée : le **« badge premium »** d'une famille (débloque des fonctions payantes), lu à chaque ouverture d'écran.

Reconçois pour CE cas. Attendu :
1. Tu ajoutes Apple Calendar **dans son propre bulkhead** — 0 ligne touchée sur le chemin critique des routines (sinon ton isolation était cosmétique).
2. Tu tranches le modèle de cohérence du **badge premium** en partant du coût du périmé : si un ex-premium garde l'accès payant 30 s, est-ce grave ? (indice : ni « série vue par les autres » ni « révocation admin » — trouve le bon curseur et justifie).
3. Tu montres que ta **migration** notifications n'est pas impactée par l'ajout des exports (les deux chantiers sont indépendants).

**Critère de réussite :** ajouter Apple Calendar ne touche **aucun** budget ni pattern du chemin complétions, et le choix de cohérence du badge premium est justifié **par le coût du périmé**, pas par analogie.

---

## Application TribuZen

Dans le repo `smaurier/tribuzen`, ce dossier de conception se matérialise **d'abord en documentation d'archi**, avant toute ligne de code :

```
tribuzen/
  docs/
    adr/
      ADR-019-resilience-sync-offline.md      ← fiche de résilience + cohérence
      ADR-020-migration-notifications.md       ← plan strangler fig + RPO/RTO
    diagrams/
      sync-flow-resilience.excalidraw          ← schéma avec budgets + breaker + bulkhead
```

**Ce qui sera ensuite implémenté (hors de ce lab) :**
- Le code concret des **workers, retries, backoff, DLQ** → **module 12** (jobs / concurrence / async).
- La **clé d'idempotence** deviendra une contrainte d'unicité `(routine_id, child_id, day)` + `upsert` côté API → **cours 10** (SQL/Prisma).
- Le **circuit breaker** / **bulkhead** concrets (lib de résilience ou implémentation maison) → **module 12** ; leur théorie distribuée sous-jacente → **cours 17**.
- Le **proxy de migration** et l'**anti-corruption layer** → code applicatif, guidé par ce plan.

**Commits cibles (docs d'archi) :**
```
docs(archi): ADR-019 résilience sync offline (timeouts décroissants, retry+jitter, breaker, bulkhead Calendar)
docs(archi): ADR-020 migration notifications strangler fig (proxy, ACL, shadow traffic) + RPO 1h / RTO 4h
```
