# Exercice 54 — Fitness functions

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 7 — L'Architecte
>
> **Prérequis** : Module 12 (cours 3)


## Objectif

Implémenter des fitness functions automatisees pour vérifier que l'architecture de ShopArch respecte ses invariants au fil du temps.

## Contexte

Les règles architecturales de ShopArch (pas de dépendance circulaire, isolation tenant, pas de logique métier dans les controllers) sont documentees mais pas verifiees automatiquement. Au fil du temps, elles se degradent.

## Temps estime

1h

## Instructions

### Étape 1 — Fitness functions structurelles
Implemente des tests qui verifient la structure du code :
- Pas de dépendance circulaire entre modules
- Les controllers n'importent pas directement les repositories
- Les entités ne dependent pas des services (sens de la dépendance)
- Les modules ne dependent pas de modules "freres" (seulement de modules parents)

### Étape 2 — Fitness functions de performance
Implemente des tests de performance automatises :
- Le build doit prendre < 60s
- Aucun bundle JS > 250 KB (gzip)
- Les 5 endpoints critiques repondent en < 200ms (benchmark automatise)
- Le startup time de l'app < 5s

### Étape 3 — Fitness functions de sécurité
Implemente des tests de sécurité automatises :
- npm audit ne retourne aucune vulnérabilité critique
- Pas de secret dans le code source (regex scan)
- Tous les endpoints ont un decorator d'autorisation
- CSP header present sur toutes les réponses

### Étape 4 — Intégration CI
Integre les fitness functions dans le pipeline CI :
- Executees a chaque PR
- Bloquent le merge si un invariant est viole
- Rapport lisible avec le detail de chaque violation

### Bonus
- Ajouter un fitness function pour la couverture de tests (> 80%)
- Implémenter un dependency drift detector (détecter les nouvelles dépendances)
- Créer un dashboard d'évolution des fitness functions dans le temps

## Contraintes
- Les fitness functions doivent etre executables en < 30s (rapide)
- Chaque violation doit avoir un message d'erreur clair
- Les fitness functions doivent etre documentees (pourquoi cette règle existe)
