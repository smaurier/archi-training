# Lab 06 — Architecture hexagonale (Ports & Adapters)

> **Outcome :** à la fin, tu sais concevoir l'hexagone d'un domaine réel : identifier les ports primaires et secondaires, les attribuer au bon côté, placer les adapters, et tracer le sens des dépendances de code de façon à ce que **tout pointe vers le domaine**.
> **Vrai outil :** un diagramme (papier, Excalidraw ou ASCII dans un `.md`) + un mini-ADR écrit. Pas de code à exécuter, pas de harnais — c'est un exercice de **conception d'architecture**.
> **Feedback :** le coach valide le diagramme et l'ADR en session, grille à l'appui. Pas de test-runner auto-correcteur.

---

## Énoncé

TribuZen ajoute un domaine **Notifications** : envoyer aux parents un rappel quand une routine n'a pas été complétée à l'heure prévue. Le comportement attendu du cœur métier :

- **Règle 1** — on ne notifie que si la routine est `active` (pas archivée) et que l'enfant a des rappels activés.
- **Règle 2** — pas plus d'un rappel par routine et par jour (anti-spam).
- **Règle 3** — le canal dépend des préférences du parent : push mobile, ou email en repli si le push a échoué.

Contraintes produit connues :

- Le déclenchement vient **soit** d'un job planifié (cron interne), **soit**, plus tard, d'un événement temps réel « fin de créneau » poussé par un autre module.
- L'envoi passe **soit** par un service push (Expo/FCM), **soit** par email (le repli).
- Les préférences parent et l'état des routines sont **lus** depuis la base (Prisma aujourd'hui, potentiellement du stockage local chiffré demain pour les données Level 1).
- Les tests du cœur doivent tourner **sans** base ni réseau.

**Ta mission : concevoir l'hexagone de ce domaine.** Tu ne codes pas l'implémentation — tu produis le **plan d'architecture** qu'un dev suivrait pour l'implémenter correctement.

### Livrables

1. **Un diagramme hexagonal** de `Notifications` (ASCII, Excalidraw ou papier photographié) montrant : le cœur au centre, chaque **port** (nommé + typé primaire/secondaire), chaque **adapter** branché sur son port, et **une flèche de dépendance de code par relation** (sens explicite).
2. **Un tableau des ports** : pour chaque port → nom, primaire/secondaire, « ce que le cœur offre / ce dont le cœur a besoin », et **qui le définit**.
3. **Un mini-ADR** (~10-15 lignes) : « Pourquoi hexagonal ici plutôt que couches simples ? » — justifie avec les contraintes produit ci-dessus, ou argumente que c'est du sur-engineering si tu penses que ça l'est.

**Pas de gap-fill, pas de squelette fourni.** Tu pars de la feuille blanche : c'est l'objectif du lab (concevoir, pas remplir).

### Amorce (juste le format attendu, à toi de remplir)

Tableau des ports — remplace les lignes d'exemple :

```
| Port                    | Type       | Le cœur…            | Défini par |
|-------------------------|------------|---------------------|------------|
| ...                     | primaire   | offre : ...         | domaine    |
| ...                     | secondaire | a besoin de : ...   | domaine    |
```

---

## Étapes (en friction)

1. **Isole le cœur.** Écris en une phrase ce que le domaine `Notifications` sait faire, sans mentionner cron, Prisma, push ni email. Si un mot technique apparaît, il n'est pas dans le cœur.
2. **Trouve les ports primaires.** Qui *pilote* le cœur ? Liste les entrées (déclencheurs). Nomme le(s) port(s) primaire(s) par l'intention métier, pas par la techno (pas `CronPort`, mais p. ex. `EnvoyerRappelDeRoutine`).
3. **Trouve les ports secondaires.** De quoi le cœur *a-t-il besoin* du monde ? Lister : lecture routines/préférences, envoi push, envoi email, marquage « déjà notifié aujourd'hui ». Nomme chaque port par le besoin, pas par la techno.
4. **Attribue les adapters.** Pour chaque port, liste le ou les adapters concrets. Marque bien primaire (job, event consumer, test) vs secondaire (Prisma, push service, email, InMemory).
5. **Trace les flèches de dépendance de code.** Pour chaque relation adapter↔port, dessine la flèche `import` et vérifie qu'elle **entre** dans le cœur. Toute flèche qui **sort** du cœur est un bug de conception : corrige-la.
6. **Place les 3 règles.** Indique où vit chaque règle (1, 2, 3). Elles doivent être dans le cœur, jamais dans un adapter. Attention à la règle 3 (repli push→email) : est-ce une décision **métier** du cœur, ou de l'adapter d'envoi ? Tranche et justifie.
7. **Vérifie la testabilité.** Montre quel adapter secondaire tu remplaces par un `InMemory`/fake pour tester les règles 1-2-3 sans base ni réseau. Si tu ne peux pas, une dépendance sort du cœur → reviens à l'étape 5.
8. **Écris l'ADR.** Décision, contexte (contraintes produit), conséquences. Ose la conclusion « couches auraient suffi » si les faits la soutiennent.

---

## Grille d'évaluation (le coach note sur ces points)

| Critère | Réussi si… |
|---|---|
| **Cœur isolé** | la phrase du cœur ne contient aucun terme technique (cron, Prisma, push, email, HTTP). |
| **Ports primaires** | le(s) déclencheur(s) sont des ports primaires, nommés par l'intention métier, définis par le domaine. |
| **Ports secondaires** | lecture données, envoi push, envoi email, anti-spam du jour = ports secondaires distincts, définis par le domaine. |
| **Adapters bien placés** | cron/event/test = primaires ; Prisma/push/email/InMemory = secondaires ; aucun mélange. |
| **Sens des dépendances** | **toutes** les flèches de code entrent dans le cœur ; aucune ne sort. C'est le critère éliminatoire. |
| **Ports définis par le cœur** | aucun port n'est placé « dans l'infra » ; l'infra fait `implements`. |
| **Règles dans le cœur** | les 3 règles vivent dans le domaine ; la décision de repli (règle 3) est tranchée et argumentée. |
| **Testabilité démontrée** | un adapter secondaire InMemory/fake permet de tester les règles sans infra, explicitement identifié. |
| **ADR** | décision justifiée par les contraintes produit (multi-déclencheurs, multi-canaux, tests sans infra) — ou sur-engineering assumé avec preuve. |
| **Portée respectée** | pas de dérive vers clean architecture (cercles concentriques) ni DDD tactique (agrégats) : on reste hexagonal. |

**Piège classique à débusquer (le coach vérifie) :** as-tu placé le port `Repository` (lecture routines/préférences) dans le cœur, ou l'as-tu collé à l'infra Prisma ? S'il est côté infra, le domaine en dépend → tu as reconstruit le modèle en couches sans le voir.

---

## Coach — conduite de séance (seeds de relance)

Le coach **drive** la séance et relance sans attendre que Sylvain demande. Seeds :

- « Montre-moi **une** flèche qui sort du cœur. Il y en a forcément une au premier jet — trouve-la ensemble. »
- « Ton port `push`, qui le définit — le domaine ou l'adapter Expo ? Prouve-le en me disant qui `import` qui. »
- « La règle 3 (repli email si push échoue) : est-ce le cœur qui décide, ou l'adapter d'envoi ? Défends ton choix. Les deux se tiennent — mais tranche et assume. »
- « Si demain le déclencheur devient un event temps réel au lieu du cron, **quels fichiers** changent dans ton plan ? Si la réponse touche le use case, ton primaire fuit. »
- « Écris à voix haute le test des règles 1-2-3 : quel objet tu instancies, quel fake tu injectes ? Si tu as besoin d'une base, on n'y est pas encore. »
- « Distinguo pièges : c'est bien de l'hexagonale que tu me décris, ou tu es en train de glisser vers les cercles de la clean ? Reste sur un seul anneau. »
- Si Sylvain reste silencieux > 30 s sur le diagramme : proposer de démarrer par le **cœur** (étape 1) plutôt que par les adapters — c'est l'ordre qui débloque.

---

## Variante J+30 (fading)

**Même type de problème, nouveau domaine, contraintes ajoutées — sans rouvrir ce lab ni le module 06 :**

Conçois l'hexagone du domaine **Invitations** de TribuZen (inviter un membre dans une famille) :

- **En 20 minutes**, diagramme + tableau des ports uniquement (pas d'ADR).
- Contraintes : le déclencheur est une requête REST **ou** un lien magique cliqué (2 adapters primaires) ; l'invitation part par email **ou** SMS ; l'état des familles/quotas est lu en base ; règle métier = « une famille gratuite est limitée à 4 membres ».
- **Contrainte de friction :** nomme tes ports **avant** de penser aux technos, et vérifie en fin d'exercice qu'aucun nom de port ne contient de terme technique (REST, email, SMS, SQL).

**Critère de réussite :** toutes les flèches entrent dans le cœur, la règle des 4 membres est dans le domaine, et l'ajout du canal SMS ne touche aucun fichier du cœur dans ton plan.

---

## Application TribuZen

Le résultat de ce lab **pilote directement** l'implémentation dans `smaurier/tribuzen` :

```
tribuzen-api/
  src/
    notifications/
      domain/
        ports/
          envoyer-rappel-routine.port.ts   ← port primaire (issu de ton diagramme)
          routine-reader.port.ts           ← port secondaire (lecture)
          reminder-sender.port.ts          ← port secondaire (push/email)
          reminder-log.port.ts             ← port secondaire (anti-spam du jour)
      application/
        envoyer-rappel-routine.use-case.ts
      adapters/
        primary/    (cron-scheduler, event-consumer, tests)
        secondary/  (prisma-*, expo-push, email, in-memory-*)
```

**Ce que tu portes du lab au produit :**

- Le **tableau des ports** devient l'arborescence `domain/ports/` — un fichier par port, tous côté cœur.
- Ta décision sur la **règle 3** (repli push→email) devient soit une logique du use case (si tu as tranché « décision métier »), soit un unique adapter `reminder-sender` qui compose push+email en interne (si tu as tranché « détail d'envoi »).
- Le câblage concret NestJS (providers, tokens `@Inject`) est **déféré au cours 09** ; le schéma Prisma des logs de rappel, au **cours 10**. Ici on ne livre que le **plan** — mais un plan implémentable tel quel.

**Commit cible (quand l'implémentation suivra, hors de ce lab) :**
```
feat(notifications): domaine hexagonal — ports rappel-routine + adapters cron/prisma/push
```
