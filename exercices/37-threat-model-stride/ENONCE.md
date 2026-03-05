# Exercice 37 — Threat model STRIDE

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 6 — La Défense
>
> **Prérequis** : Module 08 (cours 1)


## Objectif

Realiser un threat modeling complet de ShopArch en utilisant le framework STRIDE sur le flux de commande (checkout).

## Contexte

Le flux de checkout de ShopArch implique : le navigateur client, le BFF, le service de commande, le service de paiement (externe), la base de données, et Redis. Chaque frontiere entre composants est une surface d'attaque potentielle.

## Temps estime

1h

## Instructions

### Étape 1 — Data Flow Diagram (DFD)
Dessine le DFD du flux checkout avec :
- Acteurs externes (client, service paiement)
- Processus (BFF, OrderService, PaymentGateway)
- Data stores (PostgreSQL, Redis)
- Flux de données entre chaque composant
- Trust boundaries (frontiere navigateur/serveur, frontiere interne/externe)

### Étape 2 — Appliquer STRIDE
Pour chaque composant et flux, identifie les menaces :
- **S**poofing : usurpation d'identité
- **T**ampering : modification des données
- **R**epudiation : nier une action
- **I**nformation disclosure : fuite de données
- **D**enial of service : rendre le service indisponible
- **E**levation of privilege : escalade de privileges

### Étape 3 — Matrice de risques
Classe chaque menace avec :
- Probabilite (1-5)
- Impact (1-5)
- Score = Probabilite × Impact
- Priorite de mitigation (High/Medium/Low)

### Étape 4 — Mitigations
Pour chaque menace High/Medium, propose une mitigation concrete :
- Implémentation technique (code, config, infra)
- Defense in depth (plusieurs couches)
- Vérification (comment tester que la mitigation fonctionne)

### Bonus
- Utiliser DREAD comme méthode de scoring alternative
- Ajouter le flux d'administration (back-office) au threat model
- Documenter les menaces spécifiques au multi-tenant

## Contraintes
- Minimum 15 menaces identifiees
- Chaque menace doit avoir une mitigation proposee
- Les mitigations doivent etre testables (pas juste "ajouter de la sécurité")
