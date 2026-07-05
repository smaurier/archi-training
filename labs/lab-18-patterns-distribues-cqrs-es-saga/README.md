# Lab 18 — Patterns distribués : CQRS, Event Sourcing & Saga

> **Outcome :** à la fin, tu sais prendre trois besoins TribuZen et **décider** pour chacun si CQRS, Event Sourcing ou Saga s'applique — en **justifiant**, et surtout en sachant **refuser** un pattern et proposer la version la moins chère qui règle vraiment le besoin.
> **Vrai outil :** papier / tableau blanc / fichier `.md` — c'est un exercice de **décision d'architecture**, pas d'implémentation. Tu produis, par besoin : un verdict (pattern retenu ou refusé), une justification par les 3 questions, et la solution la plus simple. Aucun code à exécuter.
> **Feedback :** le coach valide le raisonnement en session (grille ci-dessous). Pas de test-runner.

---

## Énoncé

TribuZen est un **monolithe modulaire** NestJS avec **une** base PostgreSQL (rappel module 08). On te soumet **trois** besoins réels du backlog. Pour chacun, un contributeur propose un pattern « sérieux ». **Ton job : trancher.**

Tu n'implémentes rien. Tu décides, tu justifies, tu proposes le moins cher.

### Besoin A — Journal d'humeur de l'enfant

> « Chaque enfant note son humeur chaque jour (emoji + note courte). On veut afficher un calendrier rétrospectif et, plus tard, peut-être des statistiques d'évolution. Un contributeur propose : **Event Sourcing** sur l'agrégat `JournalHumeur`, pour ne rien perdre et pouvoir tout recalculer. »

### Besoin B — Tableau de bord parent

> « L'écran d'accueil parent agrège : routines complétées cette semaine (par enfant), dernières activités de la famille, badges gagnés, prochaines sorties. En prod, cet écran fait 6 requêtes lourdes avec des JOINs et des `COUNT`, et il rame quand une famille est active. Un contributeur propose : **CQRS**, avec un modèle de lecture séparé pour le dashboard. »

### Besoin C — Suppression de compte famille (RGPD)

> « Quand un parent supprime son compte famille, il faut : révoquer les accès des co-référents, supprimer les données côté serveur, **et** demander la suppression des médias stockés chez un prestataire externe de stockage d'images (service tiers, sa propre API). Un contributeur propose : une **Saga** avec compensations, parce que "c'est distribué et il ne faut pas laisser d'incohérence". »

**Ta mission, pour CHAQUE besoin (A, B, C) :**

1. **Applique les 3 questions de décision** (problème mesuré ? vraiment distribué ? version plus simple ?).
2. **Rends un verdict** : pattern **retenu** (et à quel niveau/forme) ou **refusé**.
3. **Propose la solution la moins chère** qui règle réellement le besoin (ce peut être « pas de pattern », une vue matérialisée, une table append-only, un outbox…).
4. **Écris un mini-ADR** (5–8 lignes) par besoin : contexte, décision, conséquence.

**Contrainte de portée :** on décide au niveau **architecture**. Ne descends PAS dans le SQL de la vue matérialisée (cours 10), ni dans la config d'un broker (cours 12/17), ni dans la théorie CAP / cohérence forte vs éventuelle (module 19). Reste sur : *quel pattern, ou non-pattern, et pourquoi*.

---

## Étapes (en friction)

1. **Pose la grille des 3 questions AVANT de choisir.** Pour chaque besoin, réponds d'abord : (a) le problème est-il réel et **mesuré**, ou anticipé ? (b) l'opération est-elle **vraiment répartie** sur plusieurs bases/services, ou tient-elle dans la base unique de TribuZen ? (c) quelle est la version **la plus simple** qui règle le besoin ?
2. **Piège d'Event Sourcing (Besoin A).** Sépare « garder l'historique » de « Event Sourcing ». Le besoin d'affichage rétrospectif exige-t-il de reconstruire l'état par **rejeu** ? Ou une table append-only suffit-elle ? Pense aussi RGPD : TribuZen = données d'enfants, droit à l'oubli.
3. **Piège de CQRS (Besoin B).** Distingue les niveaux. Le besoin justifie-t-il une **seconde base** (niveaux 2-3) ou une **vue matérialisée même base** (niveau 1) ? Qu'est-ce qui est mesuré ? Que rafraîchit la projection, et via quoi ?
4. **Piège de Saga (Besoin C).** Compte les **bases** impliquées. Combien d'étapes sont dans la base TribuZen, combien chez un tiers ? Une saga se justifie-t-elle, ou un **outbox** (le tiers appelé de façon idempotente + retry) suffit-il ? La suppression a-t-elle un **pivot** ?
5. **Rédige les trois mini-ADR.** Un par besoin. Nomme explicitement le pattern **refusé** quand tu refuses (c'est le livrable clé).
6. **Auto-contrôle.** Repasse la grille ci-dessous avant de montrer au coach. Vérifie qu'au moins un verdict est un **refus argumenté** — si tu as accepté les trois patterns tels que proposés, tu es probablement passé à côté.

---

## Corrigé complet commenté

> Le corrigé porte sur la **décision** et sa justification, pas sur du code. Les rares extraits sont des squelettes pour montrer *la forme* de la solution la moins chère.

### Besoin A — Journal d'humeur → **Event Sourcing REFUSÉ**

**Les 3 questions :**
1. *Problème mesuré ?* Le besoin est d'**afficher le passé** (calendrier) et *peut-être* des stats plus tard. Aucun besoin d'**audit réglementaire** ni de **rejeu temporel arbitraire**. « Peut-être plus tard » ≠ problème mesuré.
2. *Vraiment distribué ?* Non, une seule base.
3. *Version plus simple ?* Oui, franche : une table `mood_entries` **append-only applicatif** (une ligne par jour et par enfant, jamais écrasée). L'historique complet est là, requêtable en SQL trivial pour le calendrier et les futures stats.

**Verdict : REFUSÉ.** On obtient 100 % du besoin avec une table append-only, sans event store, sans projections, sans versionnage d'events. Et surtout : ES rend l'event store **immuable**, ce qui entre en collision frontale avec le **droit à l'oubli RGPD** sur des données d'enfants (il faudrait du crypto-shredding). Le coût est massif, le bénéfice nul ici.

```
// Solution la moins chère — pas d'ES, juste de l'append-only
mood_entries (child_id, day, emoji, note, created_at)  ← jamais d'UPDATE/DELETE applicatif
// calendrier = SELECT ... WHERE child_id = ? ORDER BY day
// stats futures = agrégations SQL sur la même table
```

> Formule à savoir dire : « Tu veux *garder l'historique*, pas *reconstruire l'état par rejeu*. Une table append-only fait le premier. L'Event Sourcing n'apporte que du coût ici. »

### Besoin B — Tableau de bord → **CQRS ACCEPTÉ, niveau 1 seulement**

**Les 3 questions :**
1. *Problème mesuré ?* Oui : 6 requêtes lourdes avec JOINs/COUNT, lenteur constatée en prod sur familles actives. (On vérifie d'abord que ce n'est pas un simple index manquant — supposons la mesure faite : ce sont bien des agrégations coûteuses.)
2. *Vraiment distribué ?* Non, tout est dans la base TribuZen.
3. *Version plus simple ?* **CQRS niveau 1** : une **vue matérialisée** `dashboard_parent` dénormalisée (une ligne par parent, colonnes pré-agrégées), rafraîchie quand une activité/complétion/badge change — idéalement via l'**outbox** existant.

**Verdict : ACCEPTÉ — niveau 1.** On sépare bien lecture et écriture (le dashboard lit un modèle dédié), mais **dans la même base**, en **cohérence forte**. On **n'introduit ni read replica ni Elasticsearch** (niveaux 2-3) : non mesurés comme nécessaires. On montera d'un cran *si et seulement si* le niveau 1 est prouvé insuffisant.

```
// Solution la moins chère — CQRS niveau 1
// Read model : vue matérialisée (même DB)
dashboard_parent (parent_id, routines_semaine, dernieres_activites, badges, prochaines_sorties, refreshed_at)
// Écriture : inchangée (modèles normalisés)
// Projection : rafraîchie sur event (activité/complétion/badge) via l'outbox
```

> Le piège évité : croire que « CQRS » impose une seconde base et de la cohérence éventuelle. Ici, même base, cohérence forte, un seul artefact à maintenir (la vue).

### Besoin C — Suppression compte → **Saga REFUSÉE, outbox à la place**

**Les 3 questions :**
1. *Problème mesuré ?* Le risque d'incohérence est réel (données serveur supprimées mais médias tiers restants, ou l'inverse).
2. *Vraiment distribué ?* **Partiellement.** Deux des trois actions (révoquer les accès, supprimer les données serveur) sont dans **la même** base TribuZen → une **transaction locale** les rend atomiques. **Une seule** action est externe : demander la suppression des médias chez le prestataire de stockage.
3. *Version plus simple ?* Oui : **transaction locale + outbox**. Dans une transaction SQL : révoquer les accès, supprimer/anonymiser les données serveur, ET écrire un event `SuppressionMédiasDemandée` dans l'outbox. Un poller appelle ensuite l'API du prestataire, de façon **idempotente**, avec **retry** jusqu'à succès (l'API de suppression est naturellement idempotente : re-supprimer un média déjà supprimé = succès).

**Verdict : REFUSÉ (saga).** Une saga avec compensations serait une machinerie distribuée pour un cas qui n'a **qu'un seul** appel réellement externe. Il n'y a pas de compensation à écrire : la suppression n'a **pas de pivot à compenser en arrière** (on ne « dé-supprime » pas un compte — la suppression avance, on retry jusqu'à ce que le tiers confirme). L'outbox garantit qu'aucun média n'est oublié, sans orchestrateur ni compensation.

```
// Solution la moins chère — transaction locale + outbox
BEGIN
  UPDATE co_referents SET revoked = true WHERE family_id = ?
  DELETE/ANONYMISE données serveur de la famille
  INSERT INTO outbox (event = 'SuppressionMédiasDemandée', payload = { familyId, mediaIds })
COMMIT
// poller → API prestataire (idempotent) → retry jusqu'à succès → marque publié
```

> Le piège évité : « c'est distribué donc saga ». Compter les bases révèle qu'**une seule** étape est distribuée. Une saga répond à *plusieurs* transactions locales réparties, pas à un unique appel externe.

### Bilan attendu

Sur trois propositions « patterns distribués » : **une acceptée dans sa version minimale** (CQRS niveau 1), **deux refusées** (ES → table append-only, Saga → outbox). C'est le **résultat normal** d'une revue d'architecture lucide. Si un candidat accepte les trois patterns tels quels, il n'a pas fait son travail d'architecte.

---

## Grille d'évaluation (coach)

| Critère | Attendu | ✅ / ❌ |
|---|---|---|
| Grille des 3 questions appliquée | Pour chaque besoin : problème mesuré ? distribué ? version simple ? — explicitement | |
| Besoin A — ES refusé | Distingue « garder l'historique » (table append-only) de « Event Sourcing » ; cite le blocage RGPD | |
| Besoin B — CQRS niveau 1 | Accepte CQRS mais **niveau 1** (vue matérialisée, même base, cohérence forte), pas deux bases | |
| Besoin C — Saga refusée | Compte les bases : une seule étape externe → outbox + idempotence, pas de saga ni de compensation | |
| Solution la moins chère | Chaque verdict propose la forme la plus simple qui règle vraiment le besoin | |
| Au moins un refus argumenté | Nomme explicitement le(s) pattern(s) refusé(s) avec la raison | |
| Trois mini-ADR | Contexte / décision / conséquence, 5–8 lignes chacun | |
| Portée respectée | Ne descend pas dans le SQL, la config broker, ni la théorie CAP (module 19) | |

Seuil : **6/8** pour valider. En dessous, reprends la grille des 3 questions (étape 1) avant de rédiger les ADR — le plus souvent, l'erreur est d'avoir accepté un pattern sans avoir posé « ai-je vraiment ce problème ? ».

---

## Variante J+30 (fading)

**Même exercice, contraintes ajoutées :**

1. **En 20 minutes, de mémoire**, sans relire ce corrigé ni le module 18.
2. **Nouveau besoin unique** à trancher : *« TribuZen veut lancer une place de marché d'activités : réserver une place chez un partenaire (API externe), débiter le parent via Stripe, confirmer la réservation en base. On propose une saga. »* Décide : saga justifiée ou non ? Si oui, orchestration ou choreography, et où est le **pivot** ? Si non, quelle alternative ?
3. **Contrainte supplémentaire :** cette fois, argumente **pourquoi ce cas est différent** du Besoin C (suppression). Indice : combien de systèmes externes indépendants, avec quel besoin de compensation réelle (un débit Stripe se **rembourse**, une réservation partenaire s'**annule**) ?

**Critère de réussite :** verdict + justification par les 3 questions + identification du pivot (la confirmation en base = point de non-retour), produits en 20 min, avec la distinction claire entre « un seul appel externe idempotent » (Besoin C → outbox) et « plusieurs actions externes à compenser » (place de marché → saga potentiellement justifiée, orchestration car ≥ 3 étapes).

---

## Application TribuZen

Ce lab prépare les vraies revues d'architecture du backend TribuZen (repo `smaurier/tribuzen-api`).

- Le backend reste un **monolithe modulaire** à base unique : la plupart des besoins se règlent en **transactions locales + outbox**, sans CQRS lourd ni saga. C'est un **choix assumé**, pas un retard.
- La **vue matérialisée dashboard** (Besoin B) est la seule dette « patterns distribués » réellement candidate à court terme ; elle attend une **mesure** de lenteur avant d'être créée.
- Le jour où un module serait **extrait** en service autonome avec sa propre base (ex. facturation), le besoin de saga deviendrait réel — et ce serait une conséquence à **peser**, pas un objectif (module 08 : le coût caché des microservices).

**Commit cible (quand la mesure justifiera le niveau 1) :**
```
perf(dashboard): read model dédié (vue matérialisée) rafraîchi via outbox — CQRS niveau 1
```
