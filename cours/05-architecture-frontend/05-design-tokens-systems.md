# Cours 37 — Design Tokens & Design Systems

> **Objectif** : Architecturer un pipeline de design tokens complet — de la source JSON à la génération CSS, avec palettes OKLCH, token layering, theming runtime, dark mode, et font management.

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce que le pattern Stale-While-Revalidate et quel est son avantage principal ?</summary>

SWR sert les données en cache immédiatement (même si potentiellement obsoletes), puis revalide en background. L'avantage : l'utilisateur voit les données en **0ms** au lieu d'attendre le serveur. Si les données ont change, l'UI se met a jour silencieusement.
</details>

<details>
<summary>2. Pourquoi ne faut-il jamais retrier les erreurs HTTP 4xx (sauf 429) ?</summary>

Les erreurs 4xx sont des erreurs **client** : requête malformee (400), non authentifie (401), interdit (403), ressource introuvable (404), validation échouée (422). Retrier ne changera rien — la requête est la même. Seul le 429 (rate limiting) merite un retry après le delai `Retry-After`.
</details>

---

## Analogie — Le code couleur d'une chaine de magasins

Imagine une chaine comme IKEA :

- **Design tokens** = le "brand book" central qui définit toutes les couleurs, typographies et espacements. Un seul document, source de vérité.
- **Token layering** = le brand book a 3 niveaux : global (jaune IKEA = `#FFDA1A`), semantique (bouton primaire = jaune IKEA), composant (bouton large = padding 16px)
- **OKLCH** = au lieu de définir 20 teintes de jaune à la main, on donne la teinte de base et un algorithme généré automatiquement les 10 nuances (50 a 950)
- **Theme** = chaque magasin peut avoir une ambiance legèrement différente (Noel, ete, soldes) sans redecorer — il suffit de changer les associations semantiques
- **CSS custom properties** = des etiquettes collees sur chaque élément. Changer l'etiquette change l'apparence sans toucher a l'élément

---

## Théorie

### 1. Architecture Design Tokens

```
┌──────────────────────────────────────────────────────────┐
│                    Pipeline Design Tokens                  │
│                                                            │
│  ┌──────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │  Source   │───>│  Build pipeline  │───>│   Output     │ │
│  │  JSON     │    │  (generate-      │    │   CSS vars   │ │
│  │  files    │    │   tokens.mjs)    │    │   + types    │ │
│  └──────────┘    └─────────────────┘    └──────────────┘ │
│                                                            │
│  tokens/                                                   │
│  ├── global.json      →  --color-blue-500, --space-4      │
│  ├── semantic.json    →  --color-primary, --color-surface  │
│  └── component.json   →  --button-padding, --card-radius  │
└──────────────────────────────────────────────────────────┘
```

### 2. Token layering (3 niveaux)

```
Niveau 1 — GLOBAL (valeurs brutes)
┌─────────────────────────────────┐
│ --color-blue-500: oklch(55% 0.15 240);
│ --color-blue-600: oklch(48% 0.15 240);
│ --space-4: 1rem;
│ --radius-md: 0.5rem;
│ --font-sans: 'Inter', sans-serif;
└───────────────┬─────────────────┘
                │
Niveau 2 — SEMANTIC (intention)
┌───────────────┴─────────────────┐
│ --color-primary: var(--color-blue-500);
│ --color-surface: var(--color-gray-50);
│ --color-on-surface: var(--color-gray-900);
│ --color-error: var(--color-red-500);
└───────────────┬─────────────────┘
                │
Niveau 3 — COMPONENT (specifique)
┌───────────────┴─────────────────┐
│ --button-bg: var(--color-primary);
│ --button-radius: var(--radius-md);
│ --card-bg: var(--color-surface);
│ --card-shadow: 0 1px 3px var(--color-shadow);
└─────────────────────────────────┘
```

**Regle absolue** : zero couleur hexadecimale dans le code. Toujours utiliser des tokens.

### 3. Génération de palettes OKLCH

OKLCH (Oklch Lightness Chroma Hue) est un espace couleur **perceptuellement uniforme** — contrairement a HSL, les couleurs de même lightness OKLCH ont la même luminosite percue par l'oeil humain.

```
OKLCH : oklch(L% C H)
  L = Lightness (0% noir → 100% blanc)
  C = Chroma (0 gris → 0.4 sature)
  H = Hue (0-360 degres)

Palette generee depuis une couleur brand :
  Brand = oklch(55% 0.15 240)  ← bleu

  50:  oklch(97% 0.02 240)    ← presque blanc
  100: oklch(93% 0.04 240)
  200: oklch(85% 0.08 240)
  300: oklch(75% 0.12 240)
  400: oklch(65% 0.14 240)
  500: oklch(55% 0.15 240)    ← brand color
  600: oklch(48% 0.15 240)
  700: oklch(40% 0.14 240)
  800: oklch(32% 0.12 240)
  900: oklch(24% 0.08 240)
  950: oklch(15% 0.04 240)    ← presque noir
```

### 4. Theme = token set + résolution cascade

```
Resolution cascade (du plus faible au plus fort) :
  1. Defaults (tokens de base)
  2. Variation overrides (theme "winter", "summer")
  3. Site settings (couleurs personnalisees par l'admin)
  4. Custom CSS (CSS libre avec guardrails)

Chaque niveau surcharge le precedent via CSS cascade.
```

### 5. Dark mode

```css
/* Light mode (defaut) */
:root {
  --color-surface: oklch(98% 0.01 240);
  --color-on-surface: oklch(15% 0.02 240);
  --color-primary: oklch(55% 0.15 240);
  color-scheme: light;
}

/* Dark mode via classe .dark + media query */
:root.dark,
@media (prefers-color-scheme: dark) {
  --color-surface: oklch(15% 0.02 240);
  --color-on-surface: oklch(93% 0.01 240);
  --color-primary: oklch(65% 0.15 240); /* Plus clair en dark */
  color-scheme: dark;
}
```

On change les tokens **semantiques**, pas les globaux. `--color-blue-500` reste le même — c'est `--color-surface` qui pointe vers une nuance différente.

### 6. Font management

| Regle | Pourquoi |
|---|---|
| `font-display: swap` obligatoire | Éviter le FOIT (Flash Of Invisible Text) |
| Maximum 5 familles | Chaque font = une requête HTTP |
| Preconnect au CDN font | `<link rel="preconnect" href="https://fonts.gstatic.com">` |
| Subset les glyphes | `unicode-range` pour ne charger que les caracteres utilises |
| Variable fonts si possible | 1 fichier au lieu de 4 (regular, bold, italic, bold italic) |

---

## Pratique

### Structure JSON des tokens

```json
{
  "color": {
    "brand": {
      "hue": 240,
      "chroma": 0.15,
      "lightness": 55
    },
    "accent": {
      "hue": 160,
      "chroma": 0.12,
      "lightness": 50
    }
  },
  "space": {
    "1": "0.25rem",
    "2": "0.5rem",
    "4": "1rem",
    "6": "1.5rem",
    "8": "2rem"
  },
  "radius": {
    "sm": "0.25rem",
    "md": "0.5rem",
    "lg": "1rem",
    "full": "9999px"
  },
  "font": {
    "sans": "'Inter', system-ui, sans-serif",
    "mono": "'JetBrains Mono', monospace"
  }
}
```

### Generateur de palette OKLCH

```typescript
// generate-design-tokens.mjs

interface ColorConfig {
  hue: number;
  chroma: number;
  lightness: number;
}

function generatePalette(config: ColorConfig): Record<string, string> {
  const stops = [
    { name: '50',  l: 97, cFactor: 0.13 },
    { name: '100', l: 93, cFactor: 0.27 },
    { name: '200', l: 85, cFactor: 0.53 },
    { name: '300', l: 75, cFactor: 0.80 },
    { name: '400', l: 65, cFactor: 0.93 },
    { name: '500', l: config.lightness, cFactor: 1.0 },  // Brand
    { name: '600', l: 48, cFactor: 1.0 },
    { name: '700', l: 40, cFactor: 0.93 },
    { name: '800', l: 32, cFactor: 0.80 },
    { name: '900', l: 24, cFactor: 0.53 },
    { name: '950', l: 15, cFactor: 0.27 },
  ];

  const palette: Record<string, string> = {};
  for (const stop of stops) {
    const chroma = (config.chroma * stop.cFactor).toFixed(3);
    palette[stop.name] = `oklch(${stop.l}% ${chroma} ${config.hue})`;
  }
  return palette;
}

// Generer le CSS
function generateCSS(tokens: Record<string, any>): string {
  const lines: string[] = [':root {'];

  // Couleurs
  for (const [name, config] of Object.entries(tokens.color)) {
    const palette = generatePalette(config as ColorConfig);
    for (const [shade, value] of Object.entries(palette)) {
      lines.push(`  --color-${name}-${shade}: ${value};`);
    }
  }

  // Espacements
  for (const [key, value] of Object.entries(tokens.space)) {
    lines.push(`  --space-${key}: ${value};`);
  }

  // Rayons
  for (const [key, value] of Object.entries(tokens.radius)) {
    lines.push(`  --radius-${key}: ${value};`);
  }

  lines.push('}');
  return lines.join('\n');
}
```

### Theme switcher component

```tsx
import { useThemeStore } from '../stores/theme';

function ThemeSwitcher() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}

// Dans le layout — appliquer le theme au montage
function useApplyTheme() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.setAttribute('data-theme', theme);
  }, [theme]);
}
```

---

## Résumé

1. **Token layering** en 3 niveaux : global (valeurs) → semantique (intentions) → composant (spécifique)
2. **OKLCH** généré des palettes perceptuellement uniformes depuis une seule couleur brand (50-950 shades)
3. **Zero couleur hexadecimale** dans le code — toujours passer par des tokens CSS custom properties
4. **Dark mode** = changer les tokens semantiques (`--color-surface`), pas les globaux (`--color-blue-500`)
5. **`font-display: swap`** obligatoire, max 5 familles, preconnect au CDN — éviter le FOIT

---

> **Prochain cours** : [Cours 38 — Stratégies de rendu (SSR, SSG, ISR, Hybride)](./06-stratégies-de-rendu.md) — ou comment choisir la bonne stratégie de rendu pour chaque type de page.

---

> **Lien fil rouge — ShopArch**
>
> - Crée les design tokens JSON pour ShopArch (couleurs, espacements, typographie)
> - Implémente le theme switcher dark/light avec CSS custom properties
> - Exercice(s) associé(s) : `exercices/22-design-tokens-theme/`
> - Checkpoint : Module 05, critère 2-3
