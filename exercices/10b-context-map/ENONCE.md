# Exercice 10b — Context Map entre 4 bounded contexts

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h | **Ère** : 2 — Le Domaine
>
> **Prérequis** : Exercice 10


## Objectif

Dessiner un Context Map complet pour ShopArch et choisir les patterns de relation DDD entre les contexts.

## Contexte

Suite a l'exercice 10, tu as identifie tes bounded contexts. Maintenant tu dois formaliser leurs relations et choisir les patterns d'intégration.

## Temps estime

45 min

## Instructions

### Étape 1 — Dessiner le Context Map

Dessine un diagramme (ASCII ou papier) avec :
- Les 4 contexts principaux : Catalog, Order, Payment, Identity
- Les fleches de dépendance (upstream → downstream)
- Le type de relation sur chaque fleche

### Étape 2 — Choisir le pattern de relation

Pour chaque paire, choisis UN pattern et justifie :

| Pattern | Description | Quand l'utiliser |
|---|---|---|
| **Shared Kernel** | Code partage entre deux contextes | Types fondamentaux (Money, UUID) |
| **Customer/Supplier** | L'upstream evolue en fonction des besoins du downstream | Equipes collaboratives |
| **Conformist** | Le downstream accepte le modèle de l'upstream tel quel | L'upstream est externe ou impose |
| **Anti-Corruption Layer** | Le downstream traduit le modèle de l'upstream | Modèles tres différents |
| **Open Host Service** | L'upstream expose un protocole standard | API publique |
| **Published Language** | Langage partage (JSON Schema, Protobuf) | Communication inter-services |

### Étape 3 — Définir les events

Liste les domain events echanges entre contexts :
- Nom de l'event
- Context emetteur
- Context(s) consommateur(s)
- Payload

### Bonus

- Identifier un Conformist inevitable (ex: gateway de paiement externe)
- Proposer un fallback si un context est indisponible

## Contraintes

- Chaque relation doit etre nommee avec un pattern DDD
- Pas de dépendance circulaire entre contexts
- Les events sont immutables (pas de modification apres publication)
