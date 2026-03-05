# Exercice 59 — Anti-corruption layer

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 7 — L'Architecte
>
> **Prérequis** : Module 13 (cours 6)


## Objectif

Implémenter un Anti-Corruption Layer (ACL) pour intégrer ShopArch avec un ERP legacy (SAP-like) sans contaminer le domaine métier par les modèles du système externe.

## Contexte

ShopArch doit synchroniser les produits et commandes avec un ERP legacy. L'ERP a un modèle de données tres différent : codes cryptiques (MATL_GRP au lieu de category), formats proprietaires (dates en YYYYMMDD string), et une API SOAP. Sans ACL, le domaine de ShopArch serait pollue par ces formats.

## Temps estime

1h

## Instructions

### Étape 1 — Mapper le modèle ERP vers le domaine
Identifie les différences de modèle entre l'ERP et ShopArch :
- ERP `MATERIAL` → ShopArch `Product` (champs différents, types différents)
- ERP `SALES_ORDER` → ShopArch `Order`
- ERP date `"20260315"` → ShopArch `Date` (ISO 8601)
- ERP prix `"2999"` (centimes string) → ShopArch `number` (29.99)

### Étape 2 — Adaptateur d'interface
Cree un adaptateur qui traduit les appels :
- Interface `ERPPort` avec les méthodes du domaine (getProduct, createOrder)
- Implémentation `SAPAdapter` qui traduit vers l'API SOAP de l'ERP
- Les types du domaine ne connaissent PAS les types ERP

### Étape 3 — Traducteur de modèle
Implemente les traducteurs :
- `ERPProductTranslator.toDomain(erpMaterial): Product`
- `ERPProductTranslator.toERP(product): ERPMaterial`
- Gestion des valeurs manquantes (defaults)
- Validation des données apres traduction

### Étape 4 — Résilience
Ajoute la résilience a l'ACL :
- Circuit breaker sur les appels ERP
- Cache des données ERP (TTL 5 min pour les produits, 0 pour les commandes)
- Queue pour les mutations (si l'ERP est down, on queue et on retry)
- Logging des traductions echouees (données invalides de l'ERP)

### Bonus
- Implémenter un mode dual-write (écrire dans ShopArch ET l'ERP pendant la migration)
- Ajouter un health check qui vérifié la connectivite avec l'ERP
- Planifier la stratégie de decommissioning de l'ERP (Strangler Fig)

## Contraintes
- Le domaine ShopArch ne doit avoir AUCUNE référence aux types ERP
- L'ACL est le SEUL point de contact avec l'ERP
- Les erreurs de l'ERP ne doivent pas propager dans le domaine (isolation)
