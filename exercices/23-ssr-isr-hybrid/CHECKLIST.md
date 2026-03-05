# Checklist — Exercice 23 : SSR/ISR hybrid

- [ ] Chaque route a une stratégie justifiee
- [ ] Pages SEO → SSR ou ISR (server components)
- [ ] Pages privees → client-only ('use client')
- [ ] Pages statiques → SSG (defaut App Router)
- [ ] Configuration Next.js App Router par page
- [ ] Revalidation on-demand via API route + revalidateTag
- [ ] Stratégies de chargement choisies par composant
- [ ] Above the fold = import statique, reste = dynamic import

## Bonus
- [ ] Personalization Shell Pattern
- [ ] FOUC prevention dans le layout.tsx
