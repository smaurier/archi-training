# Cours 40b — i18n applicative : traduire une APP, pas un site

> **Objectif** : Architecturer l'internationalisation d'une application métier (IHM, back-office, SaaS) : ICU MessageFormat, API `Intl` native, RTL, et le workflow de traduction en équipe distribuée. Complément du cours 40 (qui couvrait l'i18n de contenu + SEO — l'angle site public).

---

## Rappel du cours précédent

<details>
<summary>1. Quelle est la différence entre UI locale et content locale ?</summary>

- **UI locale** : la langue de l'interface (boutons, menus, labels)
- **Content locale** : la langue du contenu métier (articles, produits)
- Les deux sont indépendants : un éditeur francophone peut éditer un contenu en anglais.
</details>

<details>
<summary>2. Pourquoi l'URL prefix (`/fr/...`) plutôt que `?lang=fr` ?</summary>

`?lang=fr` n'est pas indexable proprement par Google et casse le partage d'URL. Le préfixe rend chaque version adressable, indexable (hreflang) et deep-linkable.
</details>

---

## Analogie — Le traducteur simultané vs le panneau traduit

Le cours 40, c'était **le panneau traduit** : un contenu figé, décliné en plusieurs langues, adressé par URL.
Ce cours-ci, c'est **le traducteur simultané de l'ONU** : l'application parle en continu (« 3 trains en retard », « dernière mise à jour il y a 2 minutes », « 1 250,50 € »), et chaque phrase doit être reformulée À LA VOLÉE selon la langue, la grammaire (pluriels !), le format des nombres et le fuseau de l'auditeur. On ne traduit pas des pages — on traduit un **flux de messages paramétrés**.

---

## Théorie

### 1. Pourquoi la concaténation de chaînes est l'ennemi n°1

```typescript
// ❌ L'anti-pattern qui rend la traduction IMPOSSIBLE
const msg = "Il y a " + count + " train" + (count > 1 ? "s" : "") + " en retard";
```

Trois raisons :
- **L'ordre des mots change selon la langue** (« 3 delayed trains » : l'adjectif se déplace) — une concaténation fige l'ordre français.
- **Les règles de pluriel varient énormément** : l'anglais a 2 formes (one/other), le français 2, le russe 3, l'arabe **6**. Le `count > 1 ? "s" : ""` est un pluriel franco-français.
- **Le traducteur ne voit jamais la phrase entière** : il reçoit des fragments (« Il y a », « en retard ») sans contexte.

### 2. ICU MessageFormat — la phrase comme template complet

Le standard (Unicode) utilisé par toutes les libs sérieuses (i18next, FormatJS/react-intl, vue-i18n) :

```
// messages/fr.json
"delayedTrains": "{count, plural, =0 {Aucun train en retard} one {# train en retard} other {# trains en retard}}"

// messages/en.json
"delayedTrains": "{count, plural, =0 {No delayed trains} one {# delayed train} other {# delayed trains}}"
```

La phrase **entière** vit dans le fichier de langue, avec sa logique de pluriel — le code ne fait que `t('delayedTrains', { count })`. Le traducteur voit tout, chaque langue applique SES règles. ICU gère aussi le genre (`select`) et les imbrications.

**Règle d'or** : le code ne contient JAMAIS un mot destiné à l'utilisateur. Que des clés.

### 3. L'API `Intl` native — dates, nombres, fuseaux GRATUITS

Le navigateur sait déjà tout formater — zéro dépendance, zéro fichier de traduction pour ça :

```typescript
// Nombres et monnaies
new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(1250.5)
// → "1 250,50 €"
new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(1250.5)
// → "€1,250.50"   (même monnaie, format différent !)

// Dates avec FUSEAU (crucial en supervision multi-sites : un événement à 14h32 UTC
// doit s'afficher 16h32 pour Lyon et 20h02 pour Bangalore)
new Intl.DateTimeFormat('fr-FR', { timeStyle: 'medium', timeZone: 'Europe/Paris' }).format(date)

// Temps relatif (« il y a 2 minutes » — la fraîcheur des données, traduite !)
new Intl.RelativeTimeFormat('fr', { numeric: 'auto' }).format(-2, 'minute')
// → "il y a 2 minutes"

// Listes ("React, Vue et Angular" vs "React, Vue, and Angular" — la virgule d'Oxford)
new Intl.ListFormat('fr', { type: 'conjunction' }).format(['React', 'Vue', 'Angular'])
```

**Piège classique** : formater les dates à la main (`toLocaleDateString` sans options, ou pire `${day}/${month}`) → 03/04 est le 3 avril en France et le 4 mars aux USA. Toujours `Intl.DateTimeFormat` avec locale ET timeZone explicites.

### 4. RTL — l'arabe et l'hébreu retournent l'écran

- `<html dir="rtl">` retourne le sens de lecture — et tout le layout doit suivre.
- **CSS logical properties** : la clé pour que ce soit GRATUIT. `margin-left` (physique) devient `margin-inline-start` (logique = « côté début de lecture ») → le même CSS marche dans les deux sens.

```css
/* ❌ physique : cassé en RTL */    /* ✅ logique : s'adapte seul */
margin-left: 16px;                  margin-inline-start: 16px;
text-align: left;                   text-align: start;
border-right: 1px solid;            border-inline-end: 1px solid;
```

**Décision d'architecte** : imposer les logical properties dans le design system dès le jour 1 (règle de lint), même si le RTL n'est pas au programme — le coût est nul maintenant, la retrofit est un enfer plus tard. (Même logique que l'a11y : par construction, pas par audit.)

### 5. Le workflow de traduction en équipe distribuée (l'angle architecte)

C'est LA partie que les tutos ignorent et qui fait la différence en production :

1. **Extraction automatique** : un script scanne le code et extrait les clés → le fichier source (en général l'anglais) est toujours exhaustif. Une clé utilisée mais non déclarée = build cassé (CI).
2. **TMS** (Translation Management System — Crowdin, Lokalise, Phrase) : les traducteurs travaillent dans un outil web avec contexte (captures d'écran), pas dans des JSON à la main. Le TMS ouvre des PRs automatiques.
3. **Clés manquantes en prod** : stratégie de fallback explicite (afficher la langue source, JAMAIS la clé brute `dashboard.trains.delayed` ni un blanc) + log de la clé manquante (observabilité !).
4. **Pseudo-localisation pour tester** : une fausse locale qui transforme "Settings" en "⟦Šéttîñğš one two⟧" — allonge le texte de +40 % et remplace les caractères. Lance l'app en pseudo-locale → tous les débordements, textes en dur et labels tronqués sautent aux yeux **avant** de payer un traducteur.
5. **Expansion du texte** : l'allemand est ~30 % plus long que l'anglais, le finnois pire. Conséquence design system : les composants ne doivent JAMAIS supposer une longueur de texte (pas de largeur fixe sur un bouton).

### 6. L'i18n dans une architecture shell + modules

- **Le shell possède la locale** (choix utilisateur, persistance, `<html lang>` et `dir`) et la fournit aux modules via le contexte de montage — un module ne décide jamais de sa langue tout seul.
- **Chaque module possède SES fichiers de messages** (namespace par module : `fleet.delayedTrains`) — chargés paresseusement avec le module, pas un mega-fichier global.
- **Le changement de langue** = un événement du shell, les modules re-rendent. Pas de reload complet si l'archi est propre.

---

## Pratique

### Setup i18next (framework-agnostique) avec ICU

```typescript
import i18next from 'i18next';
import ICU from 'i18next-icu';

await i18next.use(ICU).init({
  lng: shellContext.locale,          // la locale vient du SHELL
  fallbackLng: 'en',
  ns: ['fleet'],                     // namespace du module
  resources: {
    fr: { fleet: await import('./messages/fr.json') },
    en: { fleet: await import('./messages/en.json') },
  },
  parseMissingKeyHandler: (key) => {
    telemetry.warn('i18n.missing_key', { key });   // observabilité !
    return i18next.t(key, { lng: 'en' });          // fallback source, jamais la clé brute
  },
});

// Usage — le code ne contient aucun mot utilisateur
t('fleet:delayedTrains', { count: delayed.length });
```

### Le composant Fraîcheur (fil rouge checklist !) — i18n + Intl combinés

```typescript
function DataFreshness({ timestamp, locale }: { timestamp: number; locale: string }) {
  const ageSeconds = Math.round((timestamp - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  const label = Math.abs(ageSeconds) < 60
    ? rtf.format(ageSeconds, 'second')       // "il y a 12 secondes" / "12 seconds ago"
    : rtf.format(Math.round(ageSeconds / 60), 'minute');

  const stale = Math.abs(ageSeconds) > STALE_THRESHOLD_S;
  return (
    <time dateTime={new Date(timestamp).toISOString()} data-stale={stale}>
      {label}
    </time>
  );
}
```

### Exercice pseudo-localisation (30 min)

1. Ajoute une locale `pseudo` qui transforme chaque message : caractères accentués + suffixe `one two` (+40 % de longueur).
2. Lance l'app dessus. Note chaque : texte en dur (il reste en français → il a échappé à l'extraction), débordement de layout, date formatée à la main.
3. Chaque trouvaille = un bug i18n réel qui aurait coûté un ticket en prod.

---

## Résumé

1. **Jamais de concaténation, jamais de mot en dur** : des clés + ICU MessageFormat (les pluriels varient de 2 à 6 formes selon les langues, la phrase entière vit dans le fichier de langue).
2. **`Intl` natif pour tout ce qui est format** : nombres, monnaies, dates AVEC fuseau, temps relatif — zéro lib, zéro traduction manuelle.
3. **RTL gratuit si logical properties dès le jour 1** (règle de lint dans le design system) — la retrofit est un enfer.
4. **Le workflow est le vrai sujet d'architecte** : extraction en CI, TMS pour les traducteurs, fallback observé pour les clés manquantes, pseudo-localisation pour tester sans traducteur.
5. **Dans un shell** : le shell possède la locale et la fournit ; chaque module possède ses messages (namespace, chargement paresseux).

---

> **Prochain cours** : [Cours 41 — Micro-frontends](./09-micro-frontends.md)

---

> **Lien fil rouge — checklist Alstom (item 12)**
>
> - Le squelette de projet embarque i18next+ICU dès le jour 1, même avec une seule langue : le coût est nul maintenant, la retrofit est le chantier le plus douloureux du front
> - Le composant fraîcheur (item 9) utilise `Intl.RelativeTimeFormat` — les deux items se construisent ensemble
> - Règle de lint logical properties dans le design system (item 4)
> - Exercice : la pseudo-localisation ci-dessus sur la première app
