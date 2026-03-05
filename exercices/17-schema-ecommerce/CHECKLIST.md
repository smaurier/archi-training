# Checklist — Exercice 17 : Schema e-commerce

## Conventions

- [ ] Toutes les PKs sont UUID (pas SERIAL)
- [ ] Chaque table a : id, created_at, updated_at, version, status
- [ ] Les entités site-scoped ont site_id
- [ ] Soft delete via status (pas DELETE)

## Tables

- [ ] products avec name/description/slug en JSONB
- [ ] categories avec self-référence (parent_id)
- [ ] orders avec shipping_address en JSONB et status FSM
- [ ] order_lines avec prix fige (product_name, unit_price copies)
- [ ] users avec email unique par tenant

## Index

- [ ] Index sur status pour les requêtes filtrees
- [ ] Index GIN sur les colonnes JSONB
- [ ] Index unique sur slug par site+locale
- [ ] Index sur les FK

## Contraintes

- [ ] FK ON DELETE RESTRICT
- [ ] CHECK price >= 0
- [ ] CHECK stock >= 0
- [ ] UNIQUE email par tenant

## Bonus

- [ ] Table content_versions
- [ ] Vue materialisee stats
