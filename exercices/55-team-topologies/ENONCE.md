# Exercice 55 — Team Topologies

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 7 — L'Architecte
>
> **Prérequis** : Module 12 (cours 6)


## Objectif

Appliquer les concepts de Team Topologies pour organiser les équipes de ShopArch et optimiser le flow de livraison.

## Contexte

ShopArch a 18 développeurs organises par specialite (équipe front, équipe back, équipe infra). Les handoffs entre équipes ralentissent la livraison. Une feature traverse 3 équipes avant d'etre déployée.

## Temps estime

45 min

## Instructions

### Étape 1 — Identifier les types d'équipes
Classifie les équipes de ShopArch selon les 4 types de Team Topologies :
- **Stream-aligned** : livrent de la valeur utilisateur bout-en-bout
- **Platform** : fournissent des outils/services aux stream-aligned
- **Enabling** : aident les autres équipes a monter en competence
- **Complicated-subsystem** : gerent un sous-système complexe spécifique

### Étape 2 — Reorganiser les équipes
Propose une reorganisation des 18 développeurs en équipes stream-aligned :
- Équipe Catalogue (produits, recherche, categories)
- Équipe Commerce (panier, checkout, paiement, commandes)
- Équipe Platform (CI/CD, monitoring, infrastructure, SDK internes)
- Chaque stream-aligned peut déployer independamment

### Étape 3 — Modes d'interaction
Definis les modes d'interaction entre équipes :
- **Collaboration** : travail conjoint temporaire (ex: Platform aide Commerce a mettre en place le monitoring)
- **X-as-a-Service** : une équipe fournit un service (ex: Platform fournit le CI/CD)
- **Facilitating** : une équipe aide une autre a monter en competence

### Étape 4 — Cognitive load
Evalue la charge cognitive de chaque équipe :
- Lister les domaines de responsabilité
- Identifier si la charge est trop élevée (> 3 domaines différents)
- Proposer des ajustements (split team, transferer des responsabilités)

### Bonus
- Mapper les équipes sur l'architecture C4 (loi de Conway inverse)
- Définir les Team APIs (interface de chaque équipe)
- Planifier la transition de l'organisation actuelle vers la nouvelle

## Contraintes
- Maximum 8 personnes par équipe (Dunbar's number réduit)
- Chaque stream-aligned doit pouvoir déployer independamment
- Les équipes doivent etre stables (pas de reorganisation tous les sprints)
