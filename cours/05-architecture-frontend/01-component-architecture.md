# Cours 33 — Component Architecture

**Objectif :** Comprendre comment structurer une application front-end en composants réutilisables, maîtriser les patterns headless, atomic design, component registry, et implémenter des frontieres d'erreur robustes.

---

## Rappel du cours précédent

> Module 04 — Search Architecture (Cours 32). Ces questions couvrent la recherche full-text et les abstractions de recherche.

**Question 1 — Pourquoi utiliser une abstraction SearchProvider plutot que coupler directement son code a Elasticsearch ?**

<details>
<summary>Réponse</summary>

Une interface `SearchProvider` permet de swapper le moteur de recherche (Elasticsearch vers Meilisearch, par exemple) sans modifier le code appelant. Cela respecte le Dependency Inversion Principle : le code métier dépend d'une abstraction, pas d'une implémentation concrete. En pratique, cela facilite aussi les tests (mock du provider) et les migrations progressives.

</details>

**Question 2 — Quelle est la différence entre le full-text search (BM25) et le vector search (embeddings) ?**

<details>
<summary>Réponse</summary>

Le full-text search (BM25) cherche des correspondances lexicales exactes — il compare les mots du query aux mots indexes (via `tsvector` en PostgreSQL ou l'index inverse en Elasticsearch). Le vector search encode le sens semantique dans un vecteur a N dimensions et cherche les vecteurs les plus proches (ANN — Approximate Nearest Neighbor). BM25 est precis pour les termes exacts, le vector search comprend les synonymes et le sens. La fusion (reciprocal rank fusion) combine les deux pour le meilleur des deux mondes.

</details>

---

## Analogie — Les LEGO

Imagine une boite de LEGO :

- Chaque **piece** (brique 2x4, roue, fenetre) est un **composant** : autonome, standardisee, réutilisable
- Les **instructions** définissent comment assembler les pieces : c'est la **composition** de composants
- Une piece ne sait pas dans quel modèle elle sera utilisee — elle expose des **connecteurs standardises** (les tenons)
- Si une piece est defectueuse, tu la remplaces sans reconstruire tout le modèle — c'est l'**isolation**
- Les pieces sont organisees par **taille et type** dans le bac de rangement — c'est l'**atomic design**

En architecture front-end, chaque composant est une piece de LEGO : autonome, testable, et combinable a l'infini.

---

## Théorie

### 1. Headless Components — la logique sans le style

Un composant **headless** encapsule la logique (état, interactions, accessibilite) sans imposer de rendu visuel. Le consommateur fournit le JSX/template.

```
+----------------------------------+
|         Headless Hook            |
|  (useToggle, useDropdown...)     |
|  - state management              |
|  - keyboard navigation           |
|  - ARIA attributes               |
|  - NO JSX / NO CSS               |
+----------------------------------+
          |  fournit props/state
          v
+----------------------------------+
|      Visual Component            |
|  - JSX/template                  |
|  - CSS/Tailwind                  |
|  - utilise le hook headless      |
+----------------------------------+
```

**Pourquoi ?** Un meme hook `useDropdown` peut produire un dropdown classique, un mega-menu, ou un select mobile — seul le rendu change.

---

### 2. Atomic Design — les 5 niveaux

Brad Frost a formalise une hierarchie en 5 niveaux :

```
Atoms          →  Button, Input, Icon, Badge, Avatar
                   (27 primitives UI typees)
                         |
Molecules      →  SearchBar (Input + Button + Icon)
                   FormField (Label + Input + ErrorMsg)
                         |
Organisms      →  Header (Logo + Nav + SearchBar + UserMenu)
                   ArticleCard (Image + Title + Excerpt + Badge)
                         |
Templates      →  PageLayout (Header + Sidebar + MainContent + Footer)
                   DashboardLayout (NavRail + TopBar + ContentArea)
                         |
Pages          →  HomePage, ArticlePage, DashboardPage
                   (instances reelles avec donnees)
```

| Niveau | Connait le métier ? | Reutilisable ? | Exemple |
|---|---|---|---|
| Atom | Non | Partout | `<Button variant="primary">` |
| Molecule | Non | Partout | `<SearchBar onSearch={fn}>` |
| Organism | Leger | Par domaine | `<ArticleCard article={data}>` |
| Template | Structure seule | Par section | `<DashboardLayout>` |
| Page | Oui | Non | `<ArticleListPage>` |

**Regle des 27 primitives** : dans un design system mature, on identifie ~27 atomes de base (Button, Input, Select, Checkbox, Radio, Toggle, Textarea, Badge, Avatar, Icon, Tooltip, Popover, Modal, Drawer, Tabs, Accordion, Breadcrumb, Pagination, Skeleton, Spinner, Alert, Toast, Card, Divider, Link, Heading, Text). Tout le reste est une composition.

> **Default recommande pour ShopArch** : Atomic Design (5 niveaux). Cette hierarchie fournit un vocabulaire commun a toute l'equipe et scale naturellement d'un design system de 10 composants a 200+. Tu pourras changer plus tard si ton contexte l'exige.

---

### 3. Component Registry — blockType vers component

Dans un CMS, le contenu est structure en **blocks** (texte, image, hero, formulaire...). Un registre mappe chaque type de block au composant React qui le rend.

```
+------------------+      lookup       +-------------------+
|  Block Data      | ───────────────>  |  Component        |
|  { type: "hero", |                   |  Registry         |
|    props: {...} } |                   |  hero → HeroBlock |
+------------------+                   |  text → TextBlock |
                                       |  form → FormBlock |
                                       +-------------------+
                                              |
                                              v
                                       +-------------------+
                                       |  <HeroBlock       |
                                       |    title="..."    |
                                       |    image="..." /> |
                                       +-------------------+
```

**Avantages :** ajouter un nouveau type de block ne modifie PAS le code de rendu existant (Open/Closed Principle). Les plugins tiers s'enregistrent dans le registry sans toucher au core.

---

### 4. Adapter Pattern — la frontiere avec les tiers

Quand on intégré un editeur tiers (Unlayer, TinyMCE, CKEditor), on cree un **adapter** qui isole le composant tiers derriere une interface stable.

```
+--------------------+     Interface stable     +--------------------+
|  Application       | ──────────────────────>  |  EditorAdapter     |
|  (nos composants)  |   onSave(html: string)   |  (contrat interne) |
|                    |   onChange(delta)          |                    |
+--------------------+   getContent(): string    +--------------------+
                                                         |
                                                         | implementation
                                                         v
                                                 +--------------------+
                                                 |  UnlayerAdapter    |
                                                 |  (ou TinyMCE, etc) |
                                                 |  - charge le SDK   |
                                                 |  - traduit events  |
                                                 +--------------------+
```

**Pourquoi ?** Si demain on remplace Unlayer par un autre editeur, seul l'adapter change. L'application ne connait que l'interface.

---

### 5. Error Boundaries — degradation gracieuse

Une Error Boundary capture les erreurs de rendu dans son sous-arbre et affiche un fallback au lieu de crasher toute la page.

```
+-------------------------------------------+
|  Page                                     |
|  +-------------+  +-------------------+   |
|  | Sidebar     |  | ErrorBoundary     |   |
|  | (OK)        |  |  +-------------+  |   |
|  |             |  |  | Widget      |  |   |
|  |             |  |  | (CRASH!)    |  |   |
|  |             |  |  +-------------+  |   |
|  |             |  |  → Fallback UI    |   |
|  +-------------+  +-------------------+   |
+-------------------------------------------+
```

**Regle :** chaque section autonome de la page (sidebar, widget, bloc de contenu) doit avoir sa propre Error Boundary. Un crash dans un widget de recommandation ne doit pas tuer le formulaire de commande.

---

## Pratique — Exemples TypeScript/React

### 1. Headless hook — useToggle

```typescript
// hooks/useToggle.ts
// POURQUOI headless : la logique de toggle (ouvert/ferme) est reutilisable
// partout — dropdown, accordion, modal, sidebar — sans imposer de rendu.
import { useState, useCallback } from 'react';

interface UseToggleReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  // Props ARIA prets a l'emploi — le consommateur les spread sur son element
  triggerProps: {
    'aria-expanded': boolean;
    onClick: () => void;
  };
  contentProps: {
    role: string;
    hidden: boolean;
  };
}

export function useToggle(initial = false): UseToggleReturn {
  const [isOpen, setIsOpen] = useState(initial);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return {
    isOpen,
    open,
    close,
    toggle,
    // Le hook fournit les props d'accessibilite — le dev n'a plus
    // besoin d'y penser, ca vient "gratuitement"
    triggerProps: {
      'aria-expanded': isOpen,
      onClick: toggle,
    },
    contentProps: {
      role: 'region',
      hidden: !isOpen,
    },
  };
}
```

```tsx
// components/Accordion.tsx
// POURQUOI : meme hook useToggle, rendu completement different d'un dropdown
import { useToggle } from '../hooks/useToggle';

interface AccordionProps {
  title: string;
  children: React.ReactNode;
}

export function Accordion({ title, children }: AccordionProps) {
  const { isOpen, triggerProps, contentProps } = useToggle();

  return (
    <div className="border rounded-lg">
      <button {...triggerProps} className="w-full p-4 text-left font-semibold">
        {title}
        <span className="float-right">{isOpen ? '−' : '+'}</span>
      </button>
      <div {...contentProps} className="p-4 border-t">
        {children}
      </div>
    </div>
  );
}
```

### 2. Component Registry — blockType vers composant

```typescript
// registry/blockRegistry.ts
// POURQUOI un registre : Open/Closed Principle. Ajouter un block = ajouter
// une entree, sans modifier le moteur de rendu existant.
import { ComponentType, lazy } from 'react';

// Chaque block recoit ses props specifiques + un id commun
interface BlockProps {
  id: string;
  [key: string]: unknown;
}

// Map type → composant React (lazy-loaded pour le code splitting)
const registry = new Map<string, ComponentType<BlockProps>>();

// Enregistrement statique des blocks du core
registry.set('hero', lazy(() => import('../blocks/HeroBlock')));
registry.set('text', lazy(() => import('../blocks/TextBlock')));
registry.set('image', lazy(() => import('../blocks/ImageBlock')));
registry.set('form', lazy(() => import('../blocks/FormBlock')));
registry.set('video', lazy(() => import('../blocks/VideoBlock')));

// API publique pour les plugins tiers
export function registerBlock(
  type: string,
  component: ComponentType<BlockProps>,
): void {
  if (registry.has(type)) {
    console.warn(`Block "${type}" already registered — overriding.`);
  }
  registry.set(type, component);
}

export function getBlockComponent(
  type: string,
): ComponentType<BlockProps> | null {
  return registry.get(type) ?? null;
}

export function getRegisteredTypes(): string[] {
  return Array.from(registry.keys());
}
```

```tsx
// components/BlockRenderer.tsx
// POURQUOI : le renderer est generique — il ne connait pas les blocks,
// il delegue au registry. Un nouveau block n'impacte pas ce fichier.
import { Suspense } from 'react';
import { getBlockComponent } from '../registry/blockRegistry';
import { ErrorBoundary } from './ErrorBoundary';
import { BlockSkeleton } from './BlockSkeleton';
import { BlockError } from './BlockError';

interface Block {
  id: string;
  type: string;
  props: Record<string, unknown>;
}

interface BlockRendererProps {
  blocks: Block[];
}

export function BlockRenderer({ blocks }: BlockRendererProps) {
  return (
    <>
      {blocks.map((block) => {
        const Component = getBlockComponent(block.type);

        if (!Component) {
          // Block inconnu — degradation gracieuse, pas de crash
          console.warn(`Unknown block type: "${block.type}"`);
          return null;
        }

        return (
          // Chaque block a sa propre Error Boundary
          // Un crash dans un block ne tue pas les autres
          <ErrorBoundary key={block.id} fallback={<BlockError type={block.type} />}>
            <Suspense fallback={<BlockSkeleton />}>
              <Component id={block.id} {...block.props} />
            </Suspense>
          </ErrorBoundary>
        );
      })}
    </>
  );
}
```

### 3. Error Boundary — capture et degradation

```tsx
// components/ErrorBoundary.tsx
// POURQUOI : React ne catch pas les erreurs de rendu avec try/catch classique.
// Les Error Boundaries sont le seul mecanisme pour eviter un crash total.
import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // Phase 1 : React detecte l'erreur dans le rendu d'un enfant
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  // Phase 2 : on peut logger l'erreur (Sentry, console, etc.)
  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      // Affiche le fallback au lieu de l'arbre crashe
      return this.props.fallback;
    }
    return this.props.children;
  }
}
```

### 4. Adapter Pattern — frontiere editeur tiers

```typescript
// adapters/EditorAdapter.ts
// POURQUOI : l'interface stable protege notre code des changements du SDK tiers.
// Si Unlayer change son API, seul cet adapter est impacte.

export interface EditorContent {
  html: string;
  json: Record<string, unknown>;
}

// Contrat stable — notre app ne connait QUE cette interface
export interface EditorAdapter {
  init(container: HTMLElement): Promise<void>;
  getContent(): Promise<EditorContent>;
  setContent(content: EditorContent): Promise<void>;
  onContentChange(callback: (content: EditorContent) => void): void;
  destroy(): void;
}
```

```typescript
// adapters/UnlayerAdapter.ts
// Implementation concrete — tout le couplage avec Unlayer est ICI
import { EditorAdapter, EditorContent } from './EditorAdapter';

export class UnlayerAdapter implements EditorAdapter {
  private editor: any = null;

  async init(container: HTMLElement): Promise<void> {
    // Charge le SDK Unlayer dynamiquement (pas dans le bundle principal)
    const unlayer = await import('unlayer');
    this.editor = unlayer.createEditor({
      id: container.id,
      displayMode: 'email',
    });
  }

  async getContent(): Promise<EditorContent> {
    return new Promise((resolve) => {
      // Traduit l'API Unlayer vers notre interface
      this.editor.exportHtml((data: any) => {
        resolve({ html: data.html, json: data.design });
      });
    });
  }

  async setContent(content: EditorContent): Promise<void> {
    this.editor.loadDesign(content.json);
  }

  onContentChange(callback: (content: EditorContent) => void): void {
    this.editor.addEventListener('design:updated', async () => {
      const content = await this.getContent();
      callback(content);
    });
  }

  destroy(): void {
    // Nettoyage pour eviter les fuites memoire
    this.editor?.destroy();
    this.editor = null;
  }
}
```

---

## Resume

- Les **composants headless** separent logique et rendu — un hook comme `useToggle` ou `useDropdown` encapsule l'état et l'accessibilite, le consommateur fournit le visuel.
- L'**atomic design** organise les composants en 5 niveaux (atoms → molecules → organisms → templates → pages) avec ~27 primitives de base qui couvrent 90% des besoins UI.
- Le **component registry** mappe dynamiquement un `blockType` vers un composant React, respectant l'Open/Closed Principle — ajouter un block ne modifie jamais le moteur de rendu.
- L'**Adapter Pattern** isole les SDK tiers (Unlayer, TinyMCE) derriere une interface stable — un changement de librairie ne touche qu'un seul fichier.
- Les **Error Boundaries** capturent les erreurs de rendu par section — un crash dans un widget ne tue pas la page entiere, on affiche un fallback gracieux.


---

> **Lien fil rouge — ShopArch**
>
> - Conçois le component tree de la page produit ShopArch (atoms → molecules → organisms)
> - Implémente le ProductCard atom et le ProductGrid organism
> - Exercice(s) associé(s) : `exercices/21-component-tree/`
> - Checkpoint : Module 05, critère 1

## Prochain cours

[Cours 34 — State Management Patterns](./02-state-management.md)

> On va voir comment gérer l'état global et local d'une application front-end : stores (Zustand, Redux Toolkit, Jotai), synchronisation cross-tab, ETag tracking, et gestion d'erreurs par code HTTP.
