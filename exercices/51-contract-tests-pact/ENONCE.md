# Exercice 51 — Contract tests avec Pact

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 6 — La Défense
>
> **Prérequis** : Module 11 (cours 3)


## Objectif

Implémenter des tests de contrat entre le BFF (consumer) et l'API Catalogue (provider) avec Pact pour garantir la compatibilite des interfaces.

## Contexte

Le BFF de ShopArch consomme l'API Catalogue. Quand l'équipe API modifie la structure de réponse (renomme un champ, change un type), le BFF casse en production. Les tests de contrat detectent ces incompatibilites AVANT le déploiement.

## Temps estime

1h

## Instructions

### Étape 1 — Consumer test (BFF)
Ecris le test côté consumer (BFF) :
- Declare les interactions attendues (GET /products → structure attendue)
- Le test généré un fichier Pact (contrat JSON)
- Verifie que le BFF parse correctement la réponse attendue

### Étape 2 — Provider vérification (API Catalogue)
Ecris le test côté provider (API) :
- Charge le contrat Pact généré par le consumer
- Verifie que l'API réelle retourne des réponses conformes au contrat
- Configure les provider states (ex: "un produit existe")

### Étape 3 — Pact Broker
Configure le workflow :
- Le consumer publie son contrat sur le Pact Broker
- Le provider vérifié les contrats à chaque CI
- Le deploy est bloque si un contrat n'est pas vérifié ("can-i-deploy")

### Étape 4 — Évolution du contrat
Gere l'évolution :
- Ajouter un champ (backward compatible → pas de breaking change)
- Supprimer un champ (breaking change → le consumer test échoué)
- Modifier un type (breaking change → le provider test échoué)

### Bonus
- Ajouter un contrat pour les webhooks (async)
- Implémenter le Bi-Directional Contract Testing (OpenAPI spec)
- Ajouter le "pending pacts" workflow (nouveau consumer sans bloquer le provider)

## Contraintes
- Le consumer ne doit JAMAIS tester contre le provider réel (seulement le mock Pact)
- Le provider doit vérifier TOUS les contrats de ses consumers
- Le contrat doit couvrir au moins 3 endpoints critiques
