# Correction — Exercice 22 : Design tokens + theme

## Tokens JSON

```json
{
  "color": {
    "brand": {
      "50":  "oklch(0.97 0.02 250)",
      "100": "oklch(0.93 0.04 250)",
      "200": "oklch(0.87 0.08 250)",
      "300": "oklch(0.78 0.12 250)",
      "400": "oklch(0.68 0.16 250)",
      "500": "oklch(0.58 0.18 250)",
      "600": "oklch(0.48 0.18 250)",
      "700": "oklch(0.40 0.16 250)",
      "800": "oklch(0.32 0.12 250)",
      "900": "oklch(0.24 0.08 250)",
      "950": "oklch(0.16 0.04 250)"
    }
  },
  "spacing": {
    "xs": "0.25rem",
    "sm": "0.5rem",
    "md": "1rem",
    "lg": "1.5rem",
    "xl": "2rem"
  },
  "radius": {
    "sm": "0.25rem",
    "md": "0.5rem",
    "lg": "1rem",
    "full": "9999px"
  }
}
```

## Themes

```json
{
  "light": {
    "surface": "oklch(0.98 0.005 250)",
    "surface-secondary": "oklch(0.95 0.01 250)",
    "text": "oklch(0.15 0.02 250)",
    "text-secondary": "oklch(0.40 0.02 250)",
    "primary": "oklch(0.48 0.18 250)",
    "primary-text": "oklch(0.98 0.005 250)",
    "border": "oklch(0.85 0.01 250)",
    "error": "oklch(0.55 0.22 25)",
    "success": "oklch(0.60 0.18 145)"
  },
  "dark": {
    "surface": "oklch(0.15 0.02 250)",
    "surface-secondary": "oklch(0.20 0.02 250)",
    "text": "oklch(0.93 0.01 250)",
    "text-secondary": "oklch(0.70 0.01 250)",
    "primary": "oklch(0.68 0.16 250)",
    "primary-text": "oklch(0.15 0.02 250)",
    "border": "oklch(0.30 0.02 250)",
    "error": "oklch(0.65 0.20 25)",
    "success": "oklch(0.70 0.16 145)"
  }
}
```

## Génération CSS

```javascript
// scripts/generate-design-tokens.mjs
import fs from 'fs';

const tokens = JSON.parse(fs.readFileSync('tokens/global.json', 'utf-8'));
const themes = JSON.parse(fs.readFileSync('tokens/themes.json', 'utf-8'));

let css = '/* Auto-generated — do not edit */\n\n';

// Global tokens
css += ':root {\n';
for (const [category, values] of Object.entries(tokens)) {
  for (const [name, value] of Object.entries(values)) {
    if (typeof value === 'object') {
      for (const [shade, colorValue] of Object.entries(value)) {
        css += `  --${category}-${name}-${shade}: ${colorValue};\n`;
      }
    } else {
      css += `  --${category}-${name}: ${value};\n`;
    }
  }
}

// Light theme (default)
for (const [name, value] of Object.entries(themes.light)) {
  css += `  --${name}: ${value};\n`;
}
css += '  color-scheme: light;\n';
css += '}\n\n';

// Dark theme
css += '.dark {\n';
for (const [name, value] of Object.entries(themes.dark)) {
  css += `  --${name}: ${value};\n`;
}
css += '  color-scheme: dark;\n';
css += '}\n';

fs.writeFileSync('assets/css/tokens.css', css);
console.log('Design tokens generated.');
```

## Hook useTheme

```typescript
// hooks/useTheme.ts
import { useState, useEffect, useMemo, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'shoparch-theme';
const BC_CHANNEL = 'shoparch-theme-sync';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  return stored ?? 'system';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // Resoudre 'system' vers 'light' ou 'dark'
  const resolvedTheme = useMemo<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return theme;
  }, [theme]);

  // Appliquer le theme au DOM
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  // Ecouter les changements prefers-color-scheme
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setThemeState('system'); // force re-render
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  // Sync cross-tab via BroadcastChannel
  useEffect(() => {
    const bc = new BroadcastChannel(BC_CHANNEL);
    bc.onmessage = (e) => {
      setThemeState(e.data.theme);
    };
    return () => bc.close();
  }, []);

  // Setter avec persistance + broadcast
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    const bc = new BroadcastChannel(BC_CHANNEL);
    bc.postMessage({ theme: t });
    bc.close();
  }, []);

  const toggle = useCallback(() => {
    setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
  }, [resolvedTheme, setTheme]);

  return { theme, resolvedTheme, toggle, setTheme };
}
```

## Usage dans les composants

```css
/* Aucune couleur hardcodee */
.card {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.btn-primary {
  background: var(--primary);
  color: var(--primary-text);
}
```

## Ce que tu aurais pu oublier

### 1. Couleur hardcodee dans un composant

```css
/* FAUX */
.card { background: #ffffff; color: #333333; }

/* CORRECT */
.card { background: var(--surface); color: var(--text); }
```

### 2. Oublier color-scheme

```css
/* FAUX — les scrollbars et inputs natifs restent en light */
.dark { --surface: oklch(0.15 0.02 250); }

/* CORRECT — indique au navigateur le scheme actif */
.dark { color-scheme: dark; }
/* Les scrollbars, selects, inputs natifs s'adaptent */
```

### 3. Pas de sync cross-tab

```
FAUX — changer le theme dans un onglet ne change pas les autres
  → L'utilisateur voit light dans un onglet et dark dans l'autre

CORRECT — BroadcastChannel propage le changement
  → Tous les onglets switchent en meme temps
```

### 4. Oublier prefers-color-scheme au premier load

```typescript
// FAUX — toujours light par defaut
const theme = localStorage.getItem('theme') || 'light';

// CORRECT — respecter la preference systeme
const theme = localStorage.getItem('theme') || 'system';
// 'system' resout via matchMedia
```
