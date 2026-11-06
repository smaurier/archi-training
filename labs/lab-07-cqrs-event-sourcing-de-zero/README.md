# Lab 07 : CQRS et event sourcing, de zéro

> **Outcome :** à la fin, tu sais construire un agrégat dont l'état n'existe que comme
> conséquence de ses faits, le protéger d'une écriture concurrente par la version de son flux, et
> alimenter deux modèles de lecture rejouables depuis le même journal. Tu sais aussi dire où ces
> trois choses coûtent plus qu'elles ne rapportent, et répondre à la seule question qui compte en
> entretien : qu'est-ce que tu perds.
> **Vrai outil :** TypeScript pur, vitest. Aucun framework, aucune base, aucun broker. Le journal
> est un tableau en mémoire, et le contrat est exactement celui d'un vrai store.
> **Feedback :** `npm run lab:07` : RED tant que `src/` ne satisfait pas l'oracle.
> `npm run solution:07` prouve l'oracle.

## Prérequis technique

`npm install` depuis `13-architecture/labs`.

## Prérequis pédagogique

Le **lab 06** d'abord. Il t'a fait écrire un fait qui franchit une frontière, une compensation et
un consommateur idempotent. Ce lab-ci suppose ces trois gestes acquis et les déplace : le fait
n'est plus un message entre deux agrégats, il devient **le seul endroit où l'état existe**.

## Lire avant (une lecture bornée)

- Cours [`02-cqrs.md`](../../cours/07-patterns-distribues/02-cqrs.md), l'analogie du comptoir et
  la section **Théorie**. Arrête-toi avant « Pratique ».
- Cours [`03-event-sourcing-outbox.md`](../../cours/07-patterns-distribues/03-event-sourcing-outbox.md),
  l'analogie du grand livre et la section **Théorie**. Arrête-toi avant « Pratique ».
- Module [`18-patterns-distribues-cqrs-es-saga.md`](../../modules/18-patterns-distribues-cqrs-es-saga.md),
  §1 et §2, puis **§4 Pièges & misconceptions** : lis-le AVANT de coder, pas après.

⛔ Pas le §3 « Worked examples » du module 18, pas les sections « Pratique » des deux cours, et
surtout pas `exercices/33-cqrs-catalogue-commandes` : il contient sa propre correction.

## Énoncé

TribuZen, la **cagnotte partagée** d'une famille. Les membres contribuent, dépensent, et
annulent parfois une dépense.

La règle à tenir : **le solde d'une cagnotte n'est jamais négatif.**

Pourquoi ce cas mérite de l'event sourcing, alors que presque aucun autre écran de TribuZen ne
le mérite :

- une annulation n'est pas une correction, c'est un fait de plus. « Qui a payé quoi, et qu'est-ce
  qui a été défait » est une question que le métier pose réellement, et un état courant ne sait
  pas y répondre ;
- la même suite de faits doit alimenter des vues qui n'ont pas la même forme (un solde par
  membre, un relevé par catégorie), et aucune n'est « la » base ;
- les écritures sont rares et conflictuelles (deux personnes qui dépensent le même argent au même
  moment), les lectures sont fréquentes. C'est la seule configuration où CQRS paie.

Lis les commentaires en tête des fichiers de `src/` : ils décrivent le contrat exact. Les types
d'événements, le journal et les erreurs sont donnés. La logique est à toi.

### Les quatre pièges, et c'est le cœur du lab

1. **L'état rendu sans être appliqué.** Une commande qui retourne son fait sans mettre à jour
   l'instance laisse la commande suivante décider sur un solde périmé. Deux dépenses d'affilée
   passent, et le solde part en négatif sans que le journal y soit pour quoi que ce soit.
2. **La version oubliée.** L'invariant de l'agrégat peut être parfaitement juste et violé quand
   même : deux requêtes chargent le même état, décident toutes les deux légitimement, écrivent
   toutes les deux. Sans la version déclarée à l'écriture, la seconde écrase la décision de la
   première. C'est le trou que la plupart des tutoriels laissent ouvert.
3. **Le vieux fait.** Le journal contient une dépense écrite avant deux décisions prises depuis :
   son montant est en euros décimaux, et elle n'a pas de catégorie. Elle doit se relire
   aujourd'hui sans qu'on touche à ce qui est écrit. Le passé ne se réécrit pas, il se traduit.
4. **Le CQRS décoratif.** Si une projection importe l'agrégat, ou si l'agrégat consulte une
   projection pour décider, tout le comportement reste juste et l'architecture ne vaut plus rien.
   C'est pour ça que l'oracle relit tes imports (`test/frontieres.test.ts`).

## Étapes (en friction)

1. `npm run lab:07` : 29 rouges sur 42. Les 13 verts sont `test/frontieres.test.ts`, et c'est
   normal : le squelette a déjà les bons imports. Ce fichier n'est pas un objectif, c'est un
   garde-fou. S'il passe au rouge pendant que tu codes, c'est que tu viens de faire parler un
   côté à l'autre.
2. `shared/evenements.ts`, `materialiser`. Rien ne tourne avant lui : c'est la porte d'entrée de
   tout fait relu. Commence par la forme actuelle, laisse la v1 rouge.
3. `ecriture/Cagnotte.ts`. `rejouer`, le solde, puis les trois commandes dans l'ordre du contrat.
   Une seule fonction privée applique un événement à l'état, et le rejeu comme les commandes
   passent par elle.
4. `ecriture/CagnotteRepository.ts`. `charger` rend l'état ET la version. `enregistrer` déclare
   cette version et ne rattrape pas `ConcurrenceError`.
5. `lecture/SoldeParMembre.ts`. Le point de reprise d'abord, la ventilation ensuite. Le test
   d'idempotence est le seul qui compte vraiment ici.
6. `lecture/ReleveDepenses.ts`. Même mécanique de reprise, autre question posée au même journal.
7. Reviens sur la v1 dans `materialiser`. Si tu vois `NaN` quelque part, c'est ici.

## Vérifier

```bash
cd 13-architecture/labs
npm install
npm run lab:07
npm run solution:07
```

**Ce que l'oracle vérifie**

Écriture : un flux vide est un état à zéro, chaque commande produit exactement son fait et bouge
le solde, les montants non entiers ou nuls sont refusés sans effet, une seconde dépense voit le
solde déjà entamé, un identifiant de dépense ne sert qu'une fois, une annulation recrédite le
montant d'origine et ne se répète pas, une cagnotte rechargée depuis ses seuls faits prend
exactement les mêmes décisions, et un `kind` inconnu ne casse pas le rejeu.

Concurrence : la version rendue est celle du flux, une décision sans fait n'écrit pas, deux
décisions sur le même état ne passent pas toutes les deux, et après le refus la décision rejouée
donne le bon verdict sans que le solde soit jamais passé sous zéro.

Lecture : la ventilation par membre tient compte des annulations, le point de reprise avance,
rejouer tout le journal une seconde fois ne double rien, consommer en deux lots équivaut à un
seul, le relevé marque l'annulée sans la supprimer, les totaux par catégorie ignorent les
dépenses annulées mais gardent la catégorie vidée, une dépense v1 remonte en centimes dans la
catégorie par défaut, et un `kind` inconnu est ignoré sans bloquer le point de reprise.

Cohérence : le décalage entre écriture et lecture existe puis se résorbe, un modèle de lecture
reconstruit de zéro dit la même chose que l'incrémental et retombe sur le solde de l'agrégat, et
un agrégat ne voit que son flux là où la projection voit le journal entier.

Frontières (relecture statique des imports) : la lecture ignore l'agrégat et son dépôt,
l'écriture n'importe aucune projection, l'agrégat ne tient pas de référence au journal, le dépôt
est le seul à connaître les deux, le langage publié n'importe rien hors de `shared/`, et aucun
fichier de domaine n'importe de paquet externe.

## Variante J+30 (fading)

Deux questions, et la seconde est la plus importante.

1. **Le snapshot.** La cagnotte d'une famille active a 40 000 faits, et chaque chargement les
   rejoue tous. Introduis un instantané périodique sans toucher au journal : où le ranges-tu, que
   devient la version, et qu'est-ce qui casse le jour où tu corriges un bug dans `materialiser`
   alors que des snapshots en portent déjà le résultat ?
2. **Le procès de l'event sourcing.** Reprends la même cagnotte en table classique
   (`solde`, `depenses`) avec une transaction SQL et un `SELECT ... FOR UPDATE`. Écris en cinq
   lignes ce que tu perds et ce que tu gagnes, puis dis honnêtement laquelle des deux tu
   livrerais pour TribuZen. Si ta réponse n'est pas « la table », relis ta liste : l'event
   sourcing se paie en migrations de projections, en débogage par rejeu, et en nouveaux venus
   dans l'équipe. Savoir refuser ce pattern fait partie du geste, et c'est ce qu'un lead teste
   quand il te demande d'en parler.

## Application TribuZen

La cagnotte partagée est une fonctionnalité réelle du produit, et c'est le seul endroit où ce
pattern se défend : de l'argent, des annulations qui doivent rester visibles, et plusieurs vues
sur la même histoire. Partout ailleurs dans TribuZen (les posts, les membres, les sorties), la
bonne réponse reste une table et un `UPDATE`. Ce lab t'apprend autant à placer la frontière qu'à
écrire ce qui est derrière.
