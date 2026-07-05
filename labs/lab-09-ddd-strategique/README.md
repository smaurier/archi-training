# Lab 09 — DDD stratégique : cartographier le domaine de TribuZen

> **Outcome :** à la fin, tu sais partir d'un pêle-mêle de concepts métier, en déduire les **bounded contexts**, dessiner une **context map** en nommant chaque relation, classer les sous-domaines **core/supporting/generic** et rédiger le **langage ubiquitaire** local de chaque contexte.
> **Vrai outil :** un éditeur de diagramme (papier, Excalidraw, tldraw ou Mermaid) + un fichier Markdown `context-map.md`. Aucun code à exécuter, aucun harnais — c'est un exercice de **conception**.
> **Feedback :** le coach valide ta carte en session avec la grille ci-dessous. Pas de test-runner auto-correcteur.

---

## Énoncé

L'équipe TribuZen te livre un **vrac de concepts** collectés en atelier (post-its Event Storming à peine triés). Tout est mélangé, certains mots sont ambigus, personne ne sait encore où passent les frontières. **Ta mission : mettre de l'ordre en DDD stratégique — sans écrire une ligne de modèle tactique.**

Voici le vrac exact (ne cherche pas à le « coder », c'est du métier brut) :

```
Compte, mot de passe, connexion OAuth Google, consentement RGPD,
Foyer, Membre, enfant, parent, rôle admin, avatar,
Routine du matin, tâche récurrente, compléter une routine, série (streak),
badge "7 jours d'affilée", points, niveau, récompense débloquée,
rappel push "n'oublie pas ta routine", fuseau horaire, canal e-mail,
token Firebase, conseil bien-être basé sur la science, article,
un "utilisateur" (mot employé partout par tout le monde),
"valider" (employé tantôt pour compléter une routine, tantôt pour approuver un enfant),
synchronisation offline des complétions.
```

**Contraintes de conception :**

- Tu dois produire **entre 4 et 6 bounded contexts** (ni un fourre-tout unique, ni un contexte par concept).
- Chaque terme **polysémique** (« utilisateur », « valider ») doit être **désambiguïsé** : donne le nom précis qu'il prend dans **chaque** contexte concerné.
- Chaque relation de ta context map doit porter **un type nommé** parmi : Shared Kernel, Customer/Supplier, Conformist, Anti-Corruption Layer, Open Host Service, Published Language.
- **Interdit** : entités, value objects, agrégats, repositories, schéma de base, code NestJS. Tout ça, c'est le **module 10 (tactique)** et les **cours 09/10**. Ici on reste au niveau **frontières + vocabulaire + relations**.

**Pas de gap-fill** — tu produis les trois livrables à partir de la structure vide ci-dessous.

### Starter minimal

Crée `context-map.md` avec ce squelette (à remplir intégralement) :

```markdown
# TribuZen — carte stratégique DDD

## 1. Bounded contexts (4 à 6)
| Contexte | Sous-domaine (core/supporting/generic) | Concepts qui y vivent |
|----------|----------------------------------------|-----------------------|
| ...      | ...                                    | ...                   |

## 2. Langage ubiquitaire — désambiguïsation
| Terme du vrac | Contexte | Nom précis dans ce contexte | Définition en une phrase |
|---------------|----------|-----------------------------|--------------------------|
| utilisateur   | ...      | ...                         | ...                      |
| valider       | ...      | ...                         | ...                      |

## 3. Context map (diagramme + relations nommées)
(colle ici le diagramme — ASCII/Mermaid/lien image — puis liste chaque arête)
- Contexte A --> Contexte B : <type de relation> — <pourquoi>
```

---

## Étapes (en friction)

1. **Chasse aux termes polysémiques d'abord.** Souligne dans le vrac chaque mot qui change de sens selon l'interlocuteur. Il y en a au moins deux explicites (« utilisateur », « valider ») — cherche-en un troisième caché (« routine » ? « membre » ?).
2. **Regroupe par « qui fait changer ce concept ».** Pour chaque concept, demande-toi : *quelle raison métier le ferait évoluer ?* Les concepts qui changent pour la même raison vont dans le même contexte (c'est le signal de frontière n°3 du module).
3. **Nomme tes 4 à 6 contextes** et remplis le tableau §1. Résiste à la tentation du contexte « Divers ».
4. **Classe chaque contexte en core / supporting / generic** et justifie en une phrase : est-ce l'avantage concurrentiel de TribuZen, du nécessaire banal, ou un problème déjà résolu par l'industrie ?
5. **Désambiguïse le vocabulaire** (§2) : donne à « utilisateur » et « valider » leur nom précis dans **chaque** contexte où ils apparaissent.
6. **Dessine la context map** (§3) : trace une flèche entre deux contextes **seulement** s'ils ont besoin de s'échanger quelque chose, et **nomme le type** de chaque flèche.
7. **Test de cohérence.** Pour chaque flèche, réponds : *qui se marche dessus si ce concept change ?* Si un Shared Kernel implique de coordonner 3 équipes, il est probablement trop gros — réduis-le.
8. **Décision de déploiement.** En une phrase : combien de tes contextes justifient **aujourd'hui** un microservice séparé, et pourquoi la réponse est probablement « zéro, on reste en monolithe modulaire ».

---

## Corrigé complet commenté

> Ce corrigé est **une** solution défendable, pas la seule. Le coach évalue la **cohérence** de tes choix, pas la conformité pixel à pixel. Un découpage différent mais justifié peut valoir autant.

```markdown
# TribuZen — carte stratégique DDD

## 1. Bounded contexts

| Contexte        | Sous-domaine | Concepts qui y vivent |
|-----------------|--------------|-----------------------|
| Identité & Accès| generic      | Compte, mot de passe, OAuth Google, consentement RGPD |
| Famille         | supporting   | Foyer, Membre, enfant, parent, rôle admin, avatar |
| Routines        | core         | Routine, tâche récurrente, compléter, série (streak), sync offline des complétions |
| Récompenses     | core         | Joueur, badge, points, niveau, récompense débloquée |
| Notifications   | generic      | Destinataire, rappel push, fuseau horaire, canal e-mail, token Firebase |
| Bien-être       | supporting   | Conseil basé science, article |

## 2. Langage ubiquitaire — désambiguïsation

| Terme du vrac | Contexte      | Nom précis            | Définition |
|---------------|---------------|-----------------------|------------|
| utilisateur   | Identité      | Compte                | a un e-mail + credentials, peut se connecter |
| utilisateur   | Famille       | Membre                | appartient à un Foyer ; un enfant est un Membre SANS Compte |
| utilisateur   | Récompenses   | Joueur                | porte points, série, badges |
| utilisateur   | Notifications | Destinataire          | a un token push + un fuseau |
| valider       | Routines      | compléterRoutine      | marquer une routine faite pour aujourd'hui |
| valider       | Famille       | approuverMembre       | un parent admin valide l'ajout d'un enfant au foyer |
| routine       | Routines      | Routine               | modèle récurrent de tâches (sens plein) |
| routine       | Récompenses   | (n'existe pas)        | Récompenses ne connaît qu'un événement "RoutineComplétée", pas la Routine |

## 3. Context map

    ┌────────────┐  OHS / Published Language   ┌──────────────┐
    │  ROUTINES  │ ───"RoutineComplétée"──────▶ │ RÉCOMPENSES  │
    │   (core)   │                              │    (core)    │
    └─────┬──────┘                              └──────────────┘
          │ Customer/Supplier (idMembre + nom)
          ▼
    ┌────────────┐        Shared Kernel (idMembre)    ┌──────────────┐
    │  FAMILLE   │ ◀───────────────────────────────── │ NOTIFICATIONS│
    │(supporting)│                                     │  (generic)   │
    └─────┬──────┘                                     └──────┬───────┘
          │ Customer/Supplier                                │ ACL
          ▼                                                  ▼
    ┌────────────┐                                    ┌──────────────┐
    │  IDENTITÉ  │ ──Conformist + ACL──▶ OAuth Google │ SDK Firebase │
    │ (generic)  │                                    │  (externe)   │
    └────────────┘                                    └──────────────┘

- Routines --> Récompenses : **Open Host Service / Published Language**.
  Routines publie un événement "RoutineComplétée" versionné ; Récompenses le
  consomme sans connaître les entrailles de Routines. Changer la règle de série
  ne casse pas les récompenses.
- Routines --> Famille : **Customer/Supplier**. Routines a juste besoin de
  l'idMembre + displayName ; l'équipe Routines négocie ce contrat avec Famille.
- Notifications --> Famille : **Shared Kernel** minimal sur `idMembre` (juste
  l'identifiant, rien d'autre — sinon le couplage explose).
- Identité --> OAuth Google : **Conformist** (on subit le modèle Google) protégé
  par un **ACL** qui traduit le token Google en `Compte` interne.
- Notifications --> Firebase : **ACL** pour ne pas laisser `messaging.Message`
  envahir le vocabulaire du contexte.

## Décision de déploiement
Zéro microservice aujourd'hui : monolithe modulaire, 1 contexte = 1 module NestJS.
Aucun contexte n'a de besoin prouvé de scaling/isolation qui justifie le coût
distribué. On extraira Notifications en premier SI le volume de push l'impose.
```

**Pourquoi ce corrigé est correct :**

- **Aucun tactique.** On n'a écrit ni entité, ni agrégat, ni repository : uniquement des frontières, du vocabulaire et des relations. C'est exactement le périmètre stratégique du module 09.
- **Le mot « utilisateur » a disparu** au profit de 4 noms précis, un par contexte — la marque d'un langage ubiquitaire local réussi.
- **Chaque flèche porte un type** et une justification de couplage. Le Shared Kernel est réduit à l'identifiant, ce qui limite la coordination inter-équipes.
- **Core bien placé :** Routines + Récompenses (la valeur du produit) sont en core ; Identité et Notifications, problèmes résolus, sont en generic → on achète.
- **Bien-être** est isolé en supporting : il pourrait fusionner avec Routines, mais son rythme de changement (contenu éditorial) diffère → frontière défendable.

---

## Variante J+30 (fading)

**Même exercice, contraintes ajoutées, de mémoire, en 30 minutes, sans rouvrir ce corrigé ni le module 09 :**

1. TribuZen ajoute une fonctionnalité : **abonnement premium payant** (paiement via Stripe, factures, essai gratuit 14 jours). Introduis le ou les nouveaux contextes nécessaires et **place-les** dans ta context map.
2. Le paiement Stripe **doit** passer par un pattern précis à la frontière — nomme-le et justifie en une phrase.
3. Reclasse : le contexte « Facturation/Abonnement » est-il core, supporting ou generic pour TribuZen ? Défends ton choix (indice : est-ce l'avantage concurrentiel de TribuZen ?).
4. **Contrainte de discipline :** ne fais toujours **aucun** tactique. Si tu te surprends à écrire « l'agrégat Abonnement contient… », arrête — ce n'est pas ce module.

**Critère de réussite :** le nouveau contexte est isolé par un **Anti-Corruption Layer** face à Stripe, classé **generic** (le paiement est un problème résolu — on n'invente pas de moteur de paiement), et relié aux autres contextes par des relations nommées.

---

## Application TribuZen

Dans le repo `smaurier/tribuzen`, cette carte n'est pas du code : c'est le **document d'architecture** qui guide le découpage en modules du backend.

```
tribuzen/
  docs/
    architecture/
      context-map.md          ← le livrable de ce lab
  apps/
    api/
      src/
        identite/             ← 1 bounded context = 1 module
        famille/
        routines/
        recompenses/
        notifications/
        bien-etre/
```

**Comment porter ça dans le vrai produit :**

- Chaque bounded context devient un **module NestJS** isolé (l'implémentation NestJS = **cours 09**). La frontière du contexte = la frontière du module.
- Les contextes ne s'importent **pas** mutuellement leurs entités : ils communiquent par **événements** (`RoutineComplétée`) ou via un **ACL** — la mécanique de messaging est le **cours 17**.
- La désambiguïsation du langage devient les **noms réels** dans le code : plus jamais de classe `User` fourre-tout, mais `Compte`, `Membre`, `Joueur`, `Destinataire` chacun dans son module.
- La modélisation *interne* de chaque contexte (agrégats, value objects, invariants) est le sujet du **lab 10**.

**Commit cible :**
```
docs(architecture): context map TribuZen — 6 bounded contexts, langage ubiquitaire, relations nommées
```
