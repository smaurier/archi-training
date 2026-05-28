# Exercice 04 — Patterns Creationnels (Débutant)

> 🟢 **Difficulté** : Débutant | **Temps estimé** : 2h30 | **Ère** : 1 — Les Fondations
>
> **Prérequis** : cours `03-design-patterns-essentiels.md` — section Creationnels

## Objectif

Implémenter les 5 patterns creationnels sur des scénarios simples et concrets. Chaque partie est indépendante — commence par celle qui t'intéresse.

---

## Partie 1 — Factory (25 min)

### Scénario : Système de notifications

Une app mobile peut envoyer des notifications via Email, SMS ou Push. Le type est choisi à l'exécution selon les préférences utilisateur.

### Instructions pas à pas

1. Crée l'interface `Notification` :
   ```typescript
   interface Notification {
     send(to: string, message: string): void;
   }
   ```

2. Crée 3 classes qui l'implémentent :
   - `EmailNotification` → imprime `[EMAIL] → <to>: <message>`
   - `SmsNotification`   → imprime `[SMS]   → <to>: <message>`
   - `PushNotification`  → imprime `[PUSH]  → <to>: <message>`

3. Crée `NotificationFactory` avec :
   ```typescript
   static create(type: 'email' | 'sms' | 'push'): Notification
   ```
   Lance une erreur pour les types non gérés.

4. Teste avec les 3 types.

**Question** : Pourquoi utiliser une Factory plutôt que `new EmailNotification()` directement à chaque endroit du code ?

---

## Partie 2 — Abstract Factory (35 min)

### Scénario : Thèmes visuels d'une interface

Une app a deux thèmes : `dark` et `light`. Chaque thème produit des composants visuellement cohérents. On veut garantir qu'on ne mélange pas un `DarkButton` avec un `LightInput`.

### Instructions pas à pas

1. Crée les interfaces :
   ```typescript
   interface UIButton { render(): string; }
   interface UIInput  { render(): string; }
   ```

2. Implémente les 4 classes concrètes :
   - `DarkButton`  → retourne `'<button class="dark">Valider</button>'`
   - `LightButton` → retourne `'<button class="light">Valider</button>'`
   - `DarkInput`   → retourne `'<input class="dark" />'`
   - `LightInput`  → retourne `'<input class="light" />'`

3. Crée l'interface `ThemeFactory` :
   ```typescript
   interface ThemeFactory {
     createButton(): UIButton;
     createInput(): UIInput;
   }
   ```

4. Implémente `DarkThemeFactory` et `LightThemeFactory`.

5. Écris la fonction :
   ```typescript
   function buildLoginForm(factory: ThemeFactory): void {
     // crée un bouton + un input, affiche les deux
   }
   ```

6. Appelle `buildLoginForm` avec les deux factories.

**Question** : Quelle garantie donne Abstract Factory que Factory simple ne donne pas ?

---

## Partie 3 — Builder (30 min)

### Scénario : Constructeur de pizza

Une pizza a une taille, un type de pâte, et des garnitures. Créer `new Pizza('large', 'thin', 'tomato', 'cheese', 'pepperoni', null)` est illisible et source d'erreurs.

### Instructions pas à pas

1. Crée la classe `Pizza` avec les propriétés :
   ```typescript
   class Pizza {
     size: 'small' | 'medium' | 'large' = 'medium';
     crust: 'thin' | 'thick' | 'stuffed' = 'thin';
     toppings: string[] = [];
   }
   ```

2. Crée `PizzaBuilder` avec les méthodes suivantes (chacune retourne `this`) :
   - `setSize(size): this`
   - `setCrust(crust): this`
   - `addTopping(topping: string): this`
   - `build(): Pizza` — lance une erreur si `size` n'a pas été définie

3. Construis deux pizzas différentes avec le chaînage fluent.

4. Bonus : Ajoute une méthode `describe(): string` à `Pizza` qui retourne
   `"Pizza large, pâte thin, garnitures: fromage, pepperoni"`.

**Question** : Pourquoi chaque méthode du Builder retourne-t-elle `this` ?

---

## Partie 4 — Prototype (25 min)

### Scénario : Personnages de jeu vidéo

Un jeu a des templates de personnages préconfigurés (Guerrier, Mage). Créer un nouveau personnage = cloner un template, puis personnaliser.

### Instructions pas à pas

1. Crée la classe `Character` :
   ```typescript
   class Character {
     constructor(
       public name: string,
       public health: number,
       public attack: number,
       public skills: string[],
     ) {}
     clone(): Character { /* TODO : copie profonde */ }
   }
   ```

2. Implémente `clone()` pour retourner une copie profonde.

3. Crée le template :
   ```typescript
   const warriorTemplate = new Character('Guerrier', 100, 15, ['sword']);
   ```

4. Clone-le pour créer `arthur` et `lancelot`.
   - Ajoute `'shield'` aux skills d'Arthur
   - Ajoute `'horse'` aux skills de Lancelot
   - Vérifie que `warriorTemplate.skills` n'a toujours que `['sword']`

**Piège** : `const copy = { ...character }` copie le tableau `skills` par référence.
Prouve-le en testant, puis corrige avec `[...this.skills]`.

---

## Partie 5 — Singleton (20 min)

### Scénario : Logger global

Un logger partagé dans toute l'application — une seule instance.

### Instructions pas à pas

1. Crée `AppLogger` :
   ```typescript
   class AppLogger {
     private static instance: AppLogger | null = null;
     private constructor() {}  // privé : on ne peut pas faire new AppLogger()
     static getInstance(): AppLogger { /* TODO */ }
     log(level: 'info' | 'warn' | 'error', message: string): void {
       console.log(`[${level.toUpperCase()}] ${new Date().toISOString()} — ${message}`);
     }
   }
   ```

2. Implémente `getInstance()` : crée l'instance si elle n'existe pas, retourne-la sinon.

3. Vérifie :
   ```typescript
   const a = AppLogger.getInstance();
   const b = AppLogger.getInstance();
   console.log(a === b); // doit être true
   ```

**Question critique** : Dans quel cas le Singleton pose-t-il problème dans les tests ?

> **Note** : En production, préfère l'injection de dépendances. Le Singleton ici sert à comprendre le pattern.
