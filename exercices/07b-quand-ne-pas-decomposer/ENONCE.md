# Exercice 07b — Quand NE PAS decomposer

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h | **Ère** : 2 — Le Domaine
>
> **Prérequis** : Exercice 07


## Objectif

Analyser des scénarios réels et déterminer quand les microservices sont un mauvais choix. Apprendre a dire "non" à la decomposition.

## Contexte

Tu es architecte et trois équipes viennent te voir avec des propositions de migration vers les microservices. Pour chaque cas, tu dois évaluer si la decomposition est justifiee.

## Temps estime

45 min

## Instructions

### Étape 1 — Évaluer chaque cas

Pour chacun des 3 cas ci-dessous, reponds :
1. Microservices : oui ou non ?
2. Justification (3-5 arguments)
3. Alternative recommandee si non

**Cas A — Startup MVP**
- Équipe : 3 développeurs full-stack
- Produit : marketplace de services entre particuliers
- Stack : NestJS monolithe, PostgreSQL, 500 utilisateurs
- Demande : "On veut passer en microservices pour scaler"

**Cas B — Scale-up en croissance**
- Équipe : 25 développeurs, 4 squads
- Produit : SaaS e-commerce multi-tenant, 50K utilisateurs actifs
- Stack : monolithe PHP, MySQL, temps de deploy 45min, conflits de merge quotidiens
- Demande : "Les deploys sont trop lents et les équipes se marchent dessus"

**Cas C — Feature isolee haute performance**
- Équipe : 8 développeurs, 1 squad
- Produit : CMS avec editeur de contenu + moteur de recherche
- Stack : NestJS monolithe, PostgreSQL + Elasticsearch
- Demande : "Le search ralentit le reste de l'app, on veut l'extraire en microservice"

### Étape 2 — Decision framework

Pour chaque cas, utilise ce framework de decision :

```
□ As-tu > 1 equipe qui travaille sur le meme codebase ?
□ Le deploy prend-il > 15 minutes ?
□ Les equipes se bloquent-elles mutuellement ?
□ Une partie du systeme a-t-elle des besoins de scaling tres differents ?
□ As-tu l'expertise DevOps pour gerer N services ?
□ Le cout operationnel est-il justifie par le gain ?
```

### Bonus

- Proposer une solution intermédiaire pour le Cas A (monolithe modulaire)
- Dessiner l'architecture cible pour le Cas B (decomposition progressive)

## Contraintes

- Pas de dogmatisme : "microservices = moderne" n'est PAS un argument
- Chaque decision doit etre justifiee par des critères techniques et organisationnels
- Le cout operationnel doit etre pris en compte
