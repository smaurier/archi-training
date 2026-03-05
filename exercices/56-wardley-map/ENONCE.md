# Exercice 56 — Wardley Map

> 🟠 **Difficulté** : Arbitrage | **Temps estimé** : 1h30 | **Ère** : 7 — L'Architecte
>
> **Prérequis** : Module 12 (cours 7)


## Objectif

Créer une Wardley Map pour ShopArch afin d'identifier les composants a développer en interne vs acheter/utiliser en SaaS, et anticiper les évolutions stratégiques.

## Contexte

ShopArch développé en interne son moteur de recherche, son système de paiement, et son pipeline CI/CD. Certains de ces composants pourraient etre remplaces par des solutions SaaS plus matures. La Wardley Map aide a prendre ces decisions stratégiques.

## Temps estime

45 min

## Instructions

### Étape 1 — Identifier la chaine de valeur
Liste les composants de ShopArch de haut en bas :
- Besoins utilisateur (acheter un produit)
- Capabilities (recherche, panier, paiement, livraison)
- Composants techniques (API, DB, cache, search engine, CDN)
- Infrastructure (compute, storage, network)

### Étape 2 — Positionner sur l'axe d'évolution
Place chaque composant sur l'axe horizontal (Genesis → Custom → Product → Commodity) :
- Genesis : nouveau, incertain (ex: recommandation IA personalisee)
- Custom : spécifique a ShopArch (ex: logique métier commande)
- Product : solutions disponibles, differenciantes (ex: Elasticsearch)
- Commodity : utilitaire, interchangeable (ex: stockage S3, CDN)

### Étape 3 — Decisions stratégiques
Pour chaque composant, decide :
- Build (develop en interne) : composants Genesis et Custom differenciants
- Buy (acheter un produit) : composants Product matures
- Rent (SaaS) : composants Commodity standardises

### Étape 4 — Anticiper les mouvements
Identifie les mouvements stratégiques :
- Quels composants vont évoluer vers Commodity ? (ex: auth → Keycloak)
- Quels composants Custom deviennent des avantages competitifs ?
- Quels investissements arreter ? (ex: search engine maison → Algolia)

### Bonus
- Dessiner la Wardley Map avec l'outil Online Wardley Maps
- Comparer avec un concurrent (qui a fait des choix différents)
- Planifier les mouvements sur 6 mois, 12 mois, 24 mois

## Contraintes
- Minimum 15 composants positionnes sur la map
- Chaque decision Build/Buy/Rent doit etre justifiee
- Les mouvements anticipes doivent etre realistes (pas de sci-fi)
