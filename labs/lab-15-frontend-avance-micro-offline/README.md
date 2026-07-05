# Lab 15 — Frontend avancé : micro-frontend & offline-first (décisions d'archi)

> **Outcome :** à la fin, tu sais (1) **trancher et documenter** si une feature TribuZen justifie un micro-frontend, et (2) **concevoir la stratégie offline/sync** d'une feature — source de vérité locale, file d'actions (outbox), et **résolution de conflits par type de donnée**.
> **Vrai outil :** papier / tableau blanc / fichier `.md`. C'est un exercice de **conception et de décision**, pas d'implémentation. Tu produis deux ADR + un schéma de flux offline. Aucun code à exécuter, **zéro harnais**.
> **Feedback :** le coach valide le raisonnement en session (grille ci-dessous). Pas de test-runner.

---

## Énoncé

TribuZen est une app mobile **React Native Expo, offline-first**, avec un web admin Next.js. Équipe : **3 devs, un domaine famille, une stack unifiée** (Expo + Tamagui, tokens partagés). Deux décisions arrivent en même temps.

### Partie A — Micro-frontend : oui ou non ?

Un nouveau venu propose, en réunion :

> « On introduit un module **Coaching** (conseils personnalisés, contenu éditorial riche, mis à jour souvent). Faisons-en un **micro-frontend** avec Module Federation : il pourra être déployé indépendamment du reste de l'app, et plus tard une autre équipe pourra le reprendre. »

**Ta mission :** trancher **avec une grille de décision**, pas au feeling. Puis rédiger un **ADR** (8-12 lignes) qui acte la décision, sa raison, et le **critère qui la rouvrirait**.

### Partie B — Stratégie offline/sync d'une feature

TribuZen veut fiabiliser le **journal familial** offline. Le journal contient **deux types d'entrées** très différents :

1. **Un « humeur du jour »** par enfant : une valeur parmi `{😀, 😐, 😟}` posée en un tap (état simple, un par enfant par jour).
2. **Une « note libre »** : un texte long (souvenir, observation) — donnée **Level 1** (sensible), potentiellement co-écrite par les deux parents depuis deux téléphones.

Scénario réseau : le parent A édite offline dans le train à `08:12`. Le parent B a modifié les **mêmes** entrées depuis son téléphone à `08:30`. À `08:40`, le téléphone de A retrouve la 4G et synchronise.

**Ta mission :** concevoir, au **niveau architecture**, comment cette feature marche offline puis se synchronise **sans perdre de donnée importante**.

**Contrainte de portée :** on reste au **niveau décision d'architecture**. Ne descends PAS dans l'API (service worker, code du stockage local, requêtes réseau) — c'est déféré (cours React Native / cours 11). Tu décides **où vit la vérité**, **quoi est mis en file**, et **quelle stratégie de conflit** pour **chaque** type de donnée.

---

## Étapes (en friction)

### Partie A

1. **Nomme le problème que résout un micro-frontend.** En une phrase : à quel problème d'**organisation** répond-il ? (Indice : ce n'est ni la performance ni la modernité.)
2. **Passe la grille de décision** sur le module Coaching : nombre d'équipes ? domaines distincts ? stacks à isoler ? besoin réel de déploiement indépendant **aujourd'hui** ?
3. **Chiffre le coût** qu'introduirait le micro-frontend ici (cite au moins 3 coûts permanents).
4. **Tranche** et écris l'**ADR** : décision, raison (par le problème résolu ou non), **alternative retenue**, **critère de réévaluation**.
5. **Piège à éviter :** ne confonds pas « déployer le contenu Coaching souvent » (un problème de **contenu/CMS**, pas d'archi front) avec « déployer le **code** du module indépendamment ». Sépare les deux.

### Partie B

6. **Où va l'écriture ?** Décide la **source de vérité** (local d'abord ?) et ce que voit l'UI offline.
7. **Décris la file (outbox)** : quelle **action** est mise en file pour une « humeur » et pour une « note » ? Quels champs (dont un **horodatage** et une **clé d'idempotence**) ?
8. **Choisis la stratégie de conflit pour CHAQUE type de donnée** — et **justifie** par « que se passe-t-il si on perd une des deux écritures ? ».
9. **Dessine le flux** : action offline → local → outbox → retour réseau → rejeu → résolution de conflit. Marque **où** le conflit est tranché.
10. **Idempotence :** explique en une phrase pourquoi une action rejouée deux fois ne doit pas créer de doublon, et comment tu l'évites.
11. **Auto-contrôle :** repasse la grille ci-dessous avant de montrer au coach.

---

## Corrigé complet commenté

> Le corrigé porte sur les **décisions et les flux**, pas sur du code exécutable.

### Partie A — Décision micro-frontend

**Grille de décision appliquée au module Coaching :**

| Question filtre | Réponse TribuZen | Implication |
|---|---|---|
| Plusieurs équipes qui se bloquent ? | Non — 1 équipe de 3 | Pas le problème que ça résout |
| Domaines métier distincts et autonomes ? | Non — Coaching est dans le domaine famille | Pas de frontière naturelle |
| Stacks hétérogènes à isoler ? | Non — Expo + Tamagui partout | Rien à isoler |
| Besoin de déploiement **du code** indépendant **aujourd'hui** ? | Non — « plus tard une autre équipe » = hypothétique | Optimisation prématurée |
| « Contenu mis à jour souvent » = besoin d'archi front ? | Non — c'est un besoin **CMS/contenu**, réglé côté données | Faux argument (piège) |

**Le piège central :** « le contenu Coaching change souvent » ne justifie **pas** un micro-frontend. Mettre à jour du **contenu** est un problème de **CMS / livraison de données** (le contenu vient d'une API/base, sans redéployer le code). Le micro-frontend, lui, sert à déployer le **code** indépendamment — besoin qu'on n'a pas.

**Verdict : NON.** Coaching devient un **module interne** du monolithe frontend modulaire ; son contenu éditorial est servi par données (CMS/API), pas par un déploiement de code séparé.

```
ADR-15A — Pas de micro-frontend pour le module Coaching (2026-07)
Contexte : proposition de faire du module Coaching un micro-frontend (Module
  Federation) au motif "contenu mis à jour souvent" et "reprise future par une
  autre équipe".
Décision : REJETÉE. Coaching = module interne du monolithe frontend modulaire.
Raison :
  - Le micro-frontend résout le déploiement indépendant de N équipes ; nous avons
    1 équipe, 1 domaine, 1 stack -> le problème n'existe pas.
  - "Contenu mis à jour souvent" est un besoin CMS/données (contenu servi par API),
    pas un besoin de déploiement de code -> ne justifie pas un micro-frontend.
  - Coût évité : shell d'orchestration, versions shared compatibles, communication
    inter-apps, observabilité éclatée, sur-poids runtime (anti-perf).
Alternative retenue : module interne + contenu éditorial via CMS/API.
Réévaluation : si une équipe DISTINCTE et autonome prend Coaching en propre ET a
  besoin de déployer son code indépendamment (≈ >15 devs en squads par domaine).
```

**Pourquoi c'est correct :** la décision est fondée sur **le problème résolu (ou non)**, pas sur « c'est compliqué ». Elle sépare le besoin **contenu** du besoin **déploiement de code**. Elle garde une **porte de sortie** (critère de réévaluation) au lieu d'un « non » définitif.

### Partie B — Stratégie offline/sync du journal

**1. Source de vérité = local d'abord.** L'écriture (humeur ou note) va **d'abord** dans le store local de l'appareil ; l'UI lit le local → affichage instantané et fonctionnel offline. Le réseau ne bloque **jamais** la saisie.

**2. File d'actions (outbox)** — une action horodatée par écriture :

```
// Humeur du jour (état simple)
{
  type: "journal.mood.set",
  childId: "c-7",
  day: "2026-07-05",
  value: "neutral",
  clientUpdatedAt: "2026-07-05T08:12:03Z",
  idempotencyKey: "mood:c-7:2026-07-05"        // stable : 1 humeur / enfant / jour
}

// Note libre (Level 1, texte long)
{
  type: "journal.note.edit",
  noteId: "n-33",
  childId: "c-7",
  bodyPatch: "...",                             // le changement, pas un écrasement brut
  baseVersion: 4,                               // version sur laquelle A a édité
  clientUpdatedAt: "2026-07-05T08:12:20Z",
  idempotencyKey: "note-edit:n-33:<uuid-action>"
}
```

**3. Stratégie de conflit — PAR TYPE DE DONNÉE (le cœur du lab) :**

| Donnée | Stratégie | Justification (« si on perd une écriture ? ») |
|---|---|---|
| **Humeur du jour** | **Last-Write-Wins** sur `clientUpdatedAt` | Perte anodine : c'est un état par tap ; la valeur de `08:30` (B) écrase `08:12` (A), acceptable. LWW simple suffit. |
| **Note libre (texte)** | **Merge** si possible, sinon **user-decides** | Perte **inacceptable** : LWW effacerait silencieusement le texte de l'un. On fusionne (baseVersion) ; en cas de fusion ambiguë, on présente le conflit au parent. |

> Le point qui piège : appliquer **une seule** stratégie au « journal » entier. Faux — le journal contient deux natures de données. On tranche **par entrée** : LWW pour l'humeur, merge/user-decides pour la note.

**4. Flux de synchronisation :**

```
Parent A, offline (08:12)
   │  écrit humeur + note en LOCAL (UI instantanée)
   ▼
┌─────────────────────────────┐
│ Store local (source vérité) │
│ + outbox : [mood.set,       │
│            note.edit]       │
└─────────────────────────────┘
   │  4G revient (08:40)
   ▼
Rejeu de l'outbox vers le serveur (dans l'ordre)
   │
   ├─ mood.set  → serveur applique LWW (08:30 de B > 08:12 de A) → valeur de B gagne
   │                                              ▲ conflit tranché ICI (règle LWW)
   └─ note.edit → serveur compare baseVersion 4 vs version courante (modifiée par B)
                  → MERGE ; si ambigu → renvoie un conflit → l'app propose "garder/fusionner"
                                                  ▲ conflit tranché ICI (merge / user-decides)
   │
   ▼
Récupère l'état distant réconcilié, met à jour le local
```

**5. Idempotence.** Une action peut être rejouée (crash entre l'envoi et l'accusé de réception). Chaque action porte une **`idempotencyKey`** stable : le serveur qui revoit la même clé traite le rejeu comme un **no-op** (pas de double humeur, pas de double application du patch). Sans clé stable, la sync fabrique des doublons.

**Pourquoi ce corrigé est correct :** la vérité est **locale** (utilisable offline) ; rien n'est perdu (**outbox** persistée) ; le conflit est tranché par une **règle explicite adaptée à chaque donnée** (LWW pour l'humeur, merge/user-decides pour la note) ; et le rejeu est **idempotent**. Aucune de ces décisions n'exige d'écrire un service worker ou une requête — elles sont **architecturales**.

---

## Grille d'évaluation (coach)

| Critère | Attendu | ✅ / ❌ |
|---|---|---|
| Problème résolu par micro-frontend | Nommé correctement : déploiement indépendant de N équipes (organisationnel), pas perf/mode | |
| Grille de décision (A) | Passe les filtres (équipes / domaines / stacks / déploiement indépendant réel) | |
| Piège contenu vs code (A) | Distingue « mettre à jour du contenu (CMS) » de « déployer du code indépendamment » | |
| ADR micro-frontend | Décision + raison par le problème + alternative + **critère de réévaluation** | |
| Source de vérité offline (B) | Local d'abord ; l'UI ne dépend pas du réseau | |
| Outbox | Action horodatée en file, avec horodatage **et** clé d'idempotence | |
| Conflits par type de donnée | LWW pour l'humeur **et** merge/user-decides pour la note — pas une stratégie unique | |
| Justification des conflits | Argumentée par « que perd-on si une écriture saute ? » | |
| Idempotence | Explique pourquoi + comment (clé stable → rejeu = no-op) | |
| Portée respectée | Reste au niveau décision ; ne descend pas dans service worker / code réseau | |

Seuil : **7/10** pour valider. En dessous, reprends la distinction « problème d'organisation vs de code » (A) et « stratégie par type de donnée » (B) avant de refaire les ADR.

---

## Variante J+30 (fading)

**Même exercice, contraintes ajoutées :**

1. **En 25 minutes, de mémoire**, sans relire ce corrigé ni le module 15.
2. **Nouveau cas A :** on te propose de sortir le **web admin Next.js** en micro-frontend séparé de l'app mobile. Tranche (piège : web et mobile sont déjà **deux déploiements distincts** — le micro-frontend n'a de sens qu'**à l'intérieur** d'une même app assemblée à l'exécution ; ce n'en est pas un).
3. **Nouveau cas B :** conçois la sync offline d'un **compteur de points de récompense** partagé par les deux parents (chacun peut en ajouter offline). **Contrainte :** choisis la stratégie de conflit qui **n'oublie aucun ajout** — et justifie pourquoi LWW serait ici un mauvais choix (indice : additif → **merge** par somme des deltas, pas écrasement).

**Critère de réussite :** deux décisions tranchées avec une raison correcte + une stratégie de conflit **adaptée à la nature de la donnée** (merge additif pour le compteur), produites en 25 min sans support.

---

## Application TribuZen

Ces décisions alimentent directement l'architecture du repo `smaurier/tribuzen`.

- **ADR-15A (pas de micro-frontend)** rejoint le dossier d'ADR du projet : le front reste **modulaire monolithique**, Coaching = module interne, contenu via CMS/API.
- **La stratégie offline du journal** cadre l'implémentation mobile réelle (store local + file d'actions + sync au retour réseau). Le **choix des briques** (stockage local rapide, détection réseau, tâche de fond, cache de requêtes) se fera pendant le **cours React Native** ; la partie caching HTTP au **cours 11**. Ce lab fixe **la posture et les règles de conflit** en amont.
- La **résolution de conflits par type de donnée** (LWW humeur / merge note Level 1) est une décision qui devra être **documentée** avant d'écrire la sync — sinon elle se décide « par accident » dans le code.

**Commit cible :**
```
docs(adr): pas de micro-frontend + stratégie offline/sync du journal (LWW vs merge)
```
