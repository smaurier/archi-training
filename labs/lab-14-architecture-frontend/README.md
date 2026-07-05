# Lab 14 — Architecture frontend d'un écran TribuZen

> **Outcome :** à la fin, tu sais **concevoir l'architecture front d'un écran réel** — découpage en composants (frontières), placement de chaque morceau d'état, plan de data fetching, stratégie de rendu — et **justifier** chaque décision.
> **Vrai livrable :** un **document d'architecture** (arbre de composants + table d'état + plan de fetching + décision de rendu), pas du code d'implémentation. L'archi se dessine et se défend, elle ne se compile pas.
> **Feedback :** le coach valide en session avec la grille ci-dessous — pas de test-runner auto-correcteur.

---

## Énoncé

Tu es l'architecte front de TribuZen. Le PO te confie un nouvel écran : **« Semaine de la famille »** (`WeeklyPlanner`). Cahier des charges fonctionnel :

1. L'écran affiche les **7 jours de la semaine** en colonnes. Chaque jour liste les **routines planifiées** pour chaque enfant.
2. Un **sélecteur d'enfant** en haut permet de filtrer : « tous » ou un enfant précis.
3. Un **bouton par routine** permet de la marquer « faite » (mutation vers l'API).
4. Un **widget latéral** montre la **série (streak) globale de la famille** cette semaine + des **suggestions IA** (« proposer une nouvelle routine ») — la partie suggestions appelle un service tiers **réputé instable**.
5. On peut **naviguer** semaine précédente / suivante (l'écran doit refléter la semaine visée).
6. L'écran est **privé** (derrière login). Mais il existe aussi une page publique **`/famille/:invite/semaine`** : un **aperçu en lecture seule** de la semaine, partageable par lien à un proche (grand-parent) sans compte.

Les données viennent de l'API TribuZen : `GET /families/:id`, `GET /families/:id/routines?week=YYYY-Wnn`, `GET /families/:id/streak?week=YYYY-Wnn`, `GET /suggestions?familyId=:id` (service tiers), et la mutation `POST /routines/:id/complete`.

**Ta mission : produire le document d'architecture de cet écran.** Pas d'implémentation React/Vue (c'est le rôle des cours 02/03/04). Tu décides *où* vivent les choses et *pourquoi*.

### Format du livrable

Un document (Markdown, papier, ou tableau blanc photographié) contenant **quatre sections** :

1. **Arbre de composants** — hiérarchie, avec pour chaque nœud son **rôle** (container / presentational / headless) et l'emplacement des **error boundaries**.
2. **Table d'état** — chaque morceau d'état → son **emplacement** (local / lifté / URL / serveur / global) + **justification** en une ligne.
3. **Plan de data fetching** — *où* on déclenche (loader de route / composant), ce qui part **en parallèle** vs **en séquence** (et pourquoi), ce qui est servi en **SWR**.
4. **Stratégie de rendu** — pour `/dashboard/semaine` (privé) **et** pour `/famille/:invite/semaine` (public), avec la justification (public ? SEO ? stable ?).

---

## Étapes (en friction)

Fais-le **dans cet ordre**, sans sauter — chaque étape prépare la suivante.

1. **Liste tous les morceaux d'état** de l'écran, en vrac, avant de décider quoi que ce soit. (Indice : il y en a plus que tu crois — enfant sélectionné, semaine visée, menus ouverts, données famille/routines/streak/suggestions, utilisateur, thème…)
2. **Classe chaque morceau** dans un des 5 emplacements. Pour chacun, écris **la** raison. Piège tendu : au moins deux morceaux doivent finir dans **l'URL** — trouve lesquels et pourquoi.
3. **Sépare état serveur et état client.** Entoure ce qui vient de l'API : ça ne va **pas** dans le store global. Où va-t-il ?
4. **Dessine l'arbre de composants.** Marque containers vs presentational. Place les **error boundaries** — souviens-toi du widget « suggestions » réputé instable.
5. **Trace le plan de fetching.** Quelles requêtes dépendent réellement l'une de l'autre ? Lesquelles peuvent partir ensemble ? Dessine-le comme un graphe (flèches = dépendance réelle).
6. **Tranche le rendu** des deux routes. Applique les 3 questions (public ? SEO ? stable ?) à chacune. Justifie pourquoi elles peuvent différer.
7. **Défends** ton document face au coach : il va attaquer chaque décision (« pourquoi pas tout en global ? », « pourquoi CSR ici et SSR là ? »). Tu dois tenir la ligne **avec la raison**, pas « parce que c'est mieux ».

---

## Grille d'évaluation (le coach coche)

| Critère | Attendu | ✅ / ❌ |
|---------|---------|--------|
| **Frontières composants** | Container vs presentational distingués ; au moins un headless réutilisable identifié | |
| **Error boundaries** | Une boundary **par section autonome** ; le widget suggestions est **isolé** (son crash ne tue pas le planning) | |
| **Scope minimal** | Aucun état local (menu ouvert, etc.) placé en global sans raison | |
| **URL comme état** | Enfant sélectionné **et** semaine visée sont dans l'**URL** (partageable, historique, refresh) | |
| **État serveur isolé** | family / routines / streak / suggestions en **server-state**, pas recopiés à la main dans le store client | |
| **Pas de waterfall** | Les requêtes indépendantes (routines, streak, suggestions) partent **en parallèle** ; seule la dépendance réelle (id famille) est séquentielle | |
| **SWR justifié** | Au moins une donnée servie du cache puis revalidée, avec la raison (tolère le périmé) | |
| **Rendu par route** | `/dashboard/semaine` en **CSR** (privé, pas de SEO) ; `/famille/:invite/semaine` en **SSR/ISR** (public, partageable) — et la différence est **justifiée** | |
| **Défère correctement** | Ne part pas dans l'impl React/Vue, ni le cache HTTP protocole, ni les tokens design — reste au niveau décision | |

**Seuil de réussite :** 8 / 9 critères, **et** capacité à justifier chaque décision à l'oral.

---

## Coach — conduite de session

- **Ne donne pas l'arbre.** Fais produire la liste d'état d'abord (étape 1) ; c'est là que Sylvain doit générer, pas reconnaître.
- **Relances si silence :** « Où mets-tu le fait qu'on regarde la semaine 12 plutôt que la 11 ? » (réponse attendue : URL). « Si l'API suggestions plante, qu'affiche l'écran ? » (réponse : fallback local, grâce à sa boundary).
- **Piège à tendre :** propose exprès « mettons toutes les données API dans Zustand, c'est plus simple » et vois s'il refuse en nommant l'état serveur.
- **Piège rendu :** demande « et si on faisait tout en SSR pour être cohérent ? » — la bonne réponse rejette le SSR sur l'écran privé (coût sans bénéfice SEO).
- **Ne valide pas un document qui compile mentalement du JSX** : recentre sur *où / pourquoi*, pas *comment*.
- **Signal d'acquis :** il justifie l'URL et l'état serveur **spontanément**, sans qu'on ait à demander.

---

## Variante J+30 (fading)

**Même exercice, contraintes ajoutées, en 30 minutes, sans relire le module 14 :**

1. Écran différent : **« Historique mensuel »** (`MonthlyHistory`) — grille de 30 jours en lecture seule, avec un **filtre par type de routine** (query string), un **export PDF** (bouton qui déclenche une génération serveur longue), et un **graphe de progression** (widget lourd, rarement regardé, en bas de page).
2. **Contrainte nouvelle :** l'export PDF est **long** (5-10 s) — où vit son état d'avancement, et comment évites-tu de bloquer l'écran ? (piste : état local + server-state pour le job, pas de global).
3. **Contrainte nouvelle :** le graphe lourd est **sous la ligne de flottaison** — quelle décision d'archi pour ne pas pénaliser le premier affichage ? (piste : frontière de code splitting / chargement différé — **décidée**, pas saupoudrée).
4. Produis le même document en 4 sections, et **auto-évalue-toi avec la grille** avant de montrer au coach.

**Critère de réussite :** les 9 lignes de la grille sont adressées de mémoire, et les deux contraintes nouvelles reçoivent une décision **justifiée** (pas « je mettrais ça en global »).

---

## Application TribuZen

Dans le vrai produit `smaurier/tribuzen`, ce document d'architecture devient un **ADR** (Architecture Decision Record — vu au module 23) versionné :

```
tribuzen/
  docs/
    adr/
      0012-architecture-ecran-weekly-planner.md   ← ton document, formalisé
```

**Comment le porter :**

- Transforme les 4 sections en un ADR : *Contexte* (l'écran), *Décision* (les 5 choix), *Conséquences* (ce que ça achète / coûte).
- L'implémentation qui suivra vivra dans `tribuzen/src/screens/WeeklyPlanner/` (RN) et `tribuzen-web/pages/famille/[invite]/semaine.vue` (Nuxt) — mais **l'archi est figée avant** d'écrire une ligne de composant.
- Les décisions **état serveur** (React Query + persistance) et **rendu hybride** (Nuxt SSG/SSR vs app CSR) alimentent directement le module **15** (offline / sync) qui prolonge cet écran.

**Commit cible (le document, pas le code) :**
```
docs(adr): architecture front écran WeeklyPlanner — composants, état, fetching, rendu
```
