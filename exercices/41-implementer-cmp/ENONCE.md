# Exercice 41 — Implémenter une CMP (Consent Management Platform)

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h | **Ère** : 6 — La Défense
>
> **Prérequis** : Module 08 (cours 6)


## Objectif

Implémenter une CMP RGPD-compliant pour ShopArch : banniere de consentement, stockage des préférences, et intégration avec les scripts tiers (analytics, marketing).

## Contexte

ShopArch utilise Google Analytics, un pixel marketing, et des cookies de personnalisation. Le RGPD impose le consentement explicite AVANT le chargement de ces scripts. La CMP doit etre accessible et ne pas impacter les performances.

## Temps estime

1h

## Instructions

### Étape 1 — Banniere de consentement
Cree une banniere de consentement avec :
- 3 categories : Nécessaire (toujours actif), Analytique, Marketing
- Boutons : "Tout accepter", "Tout refuser", "Personnaliser"
- Accessible (ARIA roles, focus trap, keyboard navigation)
- Ne bloque PAS le rendu de la page (overlay non-bloquant)

### Étape 2 — Stockage du consentement
Stocke les préférences :
- Cookie first-party `consent` (pas localStorage — doit etre envoye au serveur)
- Format : `{ analytics: true, marketing: false, timestamp: "...", version: 2 }`
- Duree : 13 mois max (RGPD)
- Versioning : si la politique change, re-demander le consentement

### Étape 3 — Script gating
Conditionne le chargement des scripts au consentement :
- Google Analytics : charge seulement si `analytics: true`
- Pixel marketing : charge seulement si `marketing: true`
- Les scripts nécessaires (auth, panier) sont toujours charges
- Implémentation via un tag manager maison (pas de GTM pre-consentement)

### Étape 4 — Proof of consent
Enregistre la preuve de consentement côté serveur :
- Qui (user ID ou session ID)
- Quand (timestamp)
- Quoi (categories acceptees/refusees)
- Comment (banniere, bouton clique)
- Version de la politique

### Bonus
- Implémenter le TCF v2.2 (Transparency & Consent Framework) format
- Ajouter un lien "Gérer mes cookies" dans le footer (re-ouvrir la banniere)
- Intégrer avec Google Consent Mode v2

## Contraintes
- Aucun cookie non-nécessaire AVANT le consentement explicite
- Le consentement doit etre aussi facile a refuser qu'a accepter
- Les préférences doivent survivre à la fermeture du navigateur (cookie, pas sessionStorage)
