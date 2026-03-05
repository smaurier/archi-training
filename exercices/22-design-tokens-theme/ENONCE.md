# Exercice 22 — Design tokens + theme switcher dark/light

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h15 | **Ère** : 3 — Le Front
>
> **Prérequis** : Module 05 (cours 5)


## Objectif

Implémenter un système de design tokens avec génération de palettes OKLCH, theme switcher dark/light, et synchronisation cross-tab.

## Contexte

ShopArch doit supporter le theming dynamique : chaque site a sa propre couleur brand, et chaque site peut etre en mode light ou dark. Les tokens sont définis en JSON et générés en CSS custom properties.

## Temps estime

1h15

## Instructions

### Étape 1 — Définir les tokens JSON

Cree un fichier `tokens/global.json` avec les layers :
- **Global** : couleurs brutes (brand-50 a brand-950), spacing, radius, typography
- **Semantic** : surface, text, primary, secondary, border, error, success
- **Component** : button-bg, button-text, card-bg, input-border

### Étape 2 — Theme light/dark

Definis les tokens semantiques pour les deux themes :
```json
{
  "light": {
    "surface": "{color.gray.50}",
    "text": "{color.gray.900}",
    "primary": "{color.brand.600}"
  },
  "dark": {
    "surface": "{color.gray.900}",
    "text": "{color.gray.50}",
    "primary": "{color.brand.400}"
  }
}
```

### Étape 3 — Génération CSS

Implemente un script qui généré les CSS custom properties :
```css
:root {
  --color-surface: oklch(0.97 0.01 240);
  --color-text: oklch(0.15 0.02 240);
}
.dark {
  --color-surface: oklch(0.15 0.02 240);
  --color-text: oklch(0.97 0.01 240);
}
```

### Étape 4 — Theme switcher React

Implemente un custom hook `useTheme()` avec :
- Toggle dark/light
- Persistance en localStorage
- Respect de `prefers-color-scheme`
- Synchronisation cross-tab via BroadcastChannel

### Bonus

- Générer une palette OKLCH complete (50-950) depuis une seule couleur brand
- Ajouter `font-display: swap` pour les fonts custom

## Contraintes

- Zero couleur hardcodee dans les composants (tout via `var(--token)`)
- `color-scheme: light` / `color-scheme: dark` sur le root
- BroadcastChannel pour la sync cross-tab
- Maximum 5 familles de polices
