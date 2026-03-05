# Exercice 14b — Multi-site dans un tenant

> 🟠 **Difficulté** : Arbitrage | **Temps estimé** : 1h30 | **Ère** : 4 — L'Autre Côté
>
> **Prérequis** : Exercice 14


## Objectif

Implémenter la gestion multi-site au sein d'un meme tenant : un client peut avoir plusieurs sites web, chacun avec sa propre configuration.

## Contexte

Chez ShopArch, un tenant (ex: "Acme Corp") peut avoir plusieurs sites (acme-fr.com, acme-de.com, acme-shop.com). Chaque site a ses propres parametres (theme, langue par defaut, domaine) mais partage les memes données produits.

## Temps estime

45 min

## Instructions

### Étape 1 — Modèle Site

```typescript
interface Site {
  id: string;
  tenantId: string;
  slug: string;         // 'acme-fr', 'acme-de'
  domain: string;       // 'acme-fr.com'
  defaultLocale: string;
  theme: string;
  isActive: boolean;
}
```

### Étape 2 — Site extraction

Le siteId est extrait dans cet ordre :
1. Header `X-Site-Id` (pour les appels API directs)
2. Domaine de la requête (résolution domaine → site)
3. Fallback sur le site par defaut du tenant

### Étape 3 — Site-scoped queries

Certaines entités sont scopees par site (articles, pages, menus), d'autres par tenant (produits, utilisateurs).

| Entité | Scope |
|---|---|
| Product | Tenant (partage entre sites) |
| User | Tenant |
| Article | Site |
| Page | Site |
| Menu | Site |
| Theme | Site |
| Media | Tenant (partage) |

Implemente un filtre automatique qui ajoute `WHERE site_id = :siteId` aux entités scopees par site.

### Bonus

- Ajouter la résolution de domaine (map domain → siteId)
- Cache la résolution en Redis

## Contraintes

- Le site appartient TOUJOURS a un tenant (pas de site orphelin)
- L'isolation tenant reste active (un site d'un tenant A ne peut pas accéder aux données du tenant B)
- Le siteId est ajoute au contexte comme le tenantId
