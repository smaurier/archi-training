# Exercice 05 — Patterns Structurels (Débutant)

> 🟢 **Difficulté** : Débutant | **Temps estimé** : 4h | **Ère** : 1 — Les Fondations
>
> **Prérequis** : cours `03-design-patterns-essentiels.md` — section Structurels

## Objectif

Implémenter les 7 patterns structurels. Chaque partie est indépendante.

---

## Partie 1 — Adapter (25 min)

### Scénario : Intégration d'une librairie de paiement

Ton code utilise l'interface `PaymentGateway`. Tu dois intégrer `StripeSDK` qui a une API différente — sans modifier ni ton code ni la librairie Stripe.

### Instructions

1. Interface existante de ton app :
   ```typescript
   interface PaymentGateway {
     charge(amountEuros: number, currency: string, description: string): Promise<string>; // retourne un transactionId
   }
   ```

2. API Stripe (simulée) que tu ne peux pas modifier :
   ```typescript
   class StripeSDK {
     async createPaymentIntent(params: {
       amount: number;      // en centimes !
       currency: string;
       metadata: { description: string };
     }): Promise<{ id: string; status: string }> {
       console.log(`[Stripe] PaymentIntent créé: ${JSON.stringify(params)}`);
       return { id: `pi_${Date.now()}`, status: 'succeeded' };
     }
   }
   ```

3. Crée `StripeAdapter` qui implémente `PaymentGateway` et utilise `StripeSDK`.
   - Convertit euros → centimes (`amountEuros * 100`)
   - Retourne l'`id` du PaymentIntent

4. Teste : charge 29.99€ "Abonnement mensuel".

**Question** : Quel est l'avantage si tu dois passer de Stripe à Braintree demain ?

---

## Partie 2 — Bridge (35 min)

### Scénario : Systèmes de notification × canaux de livraison

Tu as deux axes qui évoluent indépendamment :
- **Types de messages** : `UrgentMessage`, `InfoMessage`
- **Canaux** : `EmailSender`, `SlackSender`

Tu veux pouvoir croiser les deux sans créer une classe par combinaison (`UrgentEmailMessage`, `UrgentSlackMessage`, `InfoEmailMessage`...).

### Instructions

1. Crée l'interface `MessageSender` (implémentation) :
   ```typescript
   interface MessageSender {
     send(content: string, recipient: string): void;
   }
   ```

2. Implémente `EmailSender` et `SlackSender`.

3. Crée la classe abstraite `Message` (abstraction) avec `protected sender: MessageSender` :
   ```typescript
   abstract class Message {
     constructor(protected sender: MessageSender) {}
     abstract send(recipient: string): void;
   }
   ```

4. Implémente `UrgentMessage` (préfixe `[URGENT]`) et `InfoMessage` (préfixe `[INFO]`).

5. Teste les 4 combinaisons possibles.

**Question** : Combien de classes faudrait-il sans Bridge pour 3 types de messages × 4 canaux ?

---

## Partie 3 — Composite (35 min)

### Scénario : Système de fichiers simplifié

Des fichiers et des dossiers. Les deux ont un `name` et une taille (`getSize()`). Un dossier calcule sa taille en additionnant celle de ses enfants.

### Instructions

1. Crée l'interface `FileSystemItem` :
   ```typescript
   interface FileSystemItem {
     getName(): string;
     getSize(): number;    // en Ko
     display(indent?: number): void;
   }
   ```

2. Crée `File` (une feuille — pas d'enfants) avec `name` et `size` en Ko.

3. Crée `Folder` (un composite) :
   - `getSize()` retourne la somme des tailles de ses enfants
   - `add(item: FileSystemItem)` ajoute un enfant
   - `display()` affiche le nom du dossier, puis recurse sur les enfants avec indentation

4. Construis cette structure et appelle `display()` et `getSize()` :
   ```
   Documents/
     CV.pdf (120 Ko)
     Projets/
       app.ts (45 Ko)
       README.md (8 Ko)
     Photo.jpg (2048 Ko)
   ```

**Question** : Que se passe-t-il si tu appelles `getSize()` sur le dossier racine ?

---

## Partie 4 — Decorator (30 min)

### Scénario : Café personnalisable

Un café de base coûte 1€. On peut ajouter des extras (lait +0.30€, sucre +0.10€, caramel +0.50€) dans n'importe quelle combinaison.

### Instructions

1. Interface `Coffee` :
   ```typescript
   interface Coffee {
     getDescription(): string;
     getCost(): number;
   }
   ```

2. Classe de base `SimpleCoffee` : description `"Café"`, coût `1.00`.

3. Classe abstraite `CoffeeDecorator` qui implémente `Coffee` et wrape un `Coffee` :
   ```typescript
   abstract class CoffeeDecorator implements Coffee {
     constructor(protected coffee: Coffee) {}
     getDescription(): string { return this.coffee.getDescription(); }
     getCost(): number        { return this.coffee.getCost(); }
   }
   ```

4. Crée 3 decorators concrets :
   - `MilkDecorator`    → ajoute `"+ Lait"`, +0.30€
   - `SugarDecorator`   → ajoute `"+ Sucre"`, +0.10€
   - `CaramelDecorator` → ajoute `"+ Caramel"`, +0.50€

5. Crée un café latte (lait + sucre) et un caramel macchiato (lait + caramel + sucre).

**Question** : Sans Decorator, combien de sous-classes faudrait-il pour couvrir toutes les combinaisons de 5 extras ?

---

## Partie 5 — Facade (25 min)

### Scénario : Home Theater

Tu as 3 sous-systèmes complexes : `Projector`, `SoundSystem`, `StreamingService`. Pour regarder un film, tu dois les coordonner. La Facade simplifie tout ça en une méthode `watchMovie(title)`.

### Instructions

1. Crée les 3 sous-systèmes (méthodes qui `console.log` leur action) :
   ```typescript
   class Projector {
     turnOn(): void  { console.log('[Projector] Allumé — résolution 4K'); }
     setInput(source: string): void { console.log(`[Projector] Source: ${source}`); }
   }
   class SoundSystem {
     turnOn(): void         { console.log('[Sound] Allumé'); }
     setSurroundMode(): void { console.log('[Sound] Mode surround 5.1 activé'); }
     setVolume(v: number): void { console.log(`[Sound] Volume: ${v}`); }
   }
   class StreamingService {
     connect(): void              { console.log('[Streaming] Connecté'); }
     play(title: string): void    { console.log(`[Streaming] Lecture: ${title}`); }
   }
   ```

2. Crée `HomeTheaterFacade` avec :
   - `watchMovie(title: string): void` — allume tout, configure, lance le film
   - `endMovie(): void` — éteint proprement

3. Teste : `facade.watchMovie('Inception')`.

**Question** : Que se passe-t-il si tu dois ajouter un `LightingSystem` à la procédure ? Qui doit changer ?

---

## Partie 6 — Flyweight (30 min)

### Scénario : Particules dans un jeu

Un jeu crée des milliers de balles. Chaque balle a une position unique (état extrinsèque) mais partage une couleur et une texture (état intrinsèque).

### Instructions

1. Crée `BulletType` (Flyweight — partagé) :
   ```typescript
   class BulletType {
     constructor(
       public readonly color: string,
       public readonly texture: string,
       public readonly damage: number,
     ) {}
     draw(x: number, y: number): void {
       console.log(`[${this.color} bullet] (${x},${y}) dmg:${this.damage}`);
     }
   }
   ```

2. Crée `BulletTypeFactory` avec `get(color, texture, damage): BulletType` — cache par clé composite.

3. Crée `Bullet` (contexte unique) avec `x`, `y`, `type: BulletType`.

4. Simule un jeu qui tire 10 balles rouges et 5 balles bleues.
   - Vérifie que seulement 2 `BulletType` ont été créés (pas 15).

**Question** : Quel impact mémoire si chaque balle stockait sa propre copie de `texture` (une image de 50 Ko) ?

---

## Partie 7 — Proxy (30 min)

### Scénario : Chargement différé d'images

Un éditeur affiche des images. Les images lourdes ne doivent être chargées qu'au moment où elles sont affichées (lazy loading).

### Instructions

1. Interface `Image` :
   ```typescript
   interface Image {
     display(): void;
   }
   ```

2. `RealImage` (le sujet réel) :
   ```typescript
   class RealImage implements Image {
     constructor(private filename: string) {
       this.load(); // chargement simulé au constructeur
     }
     private load(): void { console.log(`[RealImage] Chargement depuis disque: ${this.filename}`); }
     display(): void      { console.log(`[RealImage] Affichage: ${this.filename}`); }
   }
   ```

3. `ProxyImage` (le proxy) :
   - Stocke le `filename` mais **ne crée pas** `RealImage` immédiatement
   - Crée `RealImage` seulement au premier appel de `display()`
   - Réutilise l'instance aux appels suivants (cache)

4. Teste :
   ```typescript
   const img = new ProxyImage('photo-haute-resolution.jpg');
   console.log('Image créée — pas encore chargée');
   img.display(); // premier appel : charge + affiche
   img.display(); // deuxième appel : affiche seulement (déjà chargée)
   ```

**Question** : Cite deux autres usages du Proxy en dehors du lazy loading.
