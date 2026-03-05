# Premiers pas avec NestJS — Crash course pour la formation

> **Objectif** : En ~1h30, tu comprends assez de NestJS pour ne pas être perdu dans le Module 03.
> Ce n'est pas un cours complet — c'est le strict minimum pour démarrer.
>
> **Prérequis** : Tu connais Express (même vaguement). Tu as déjà écrit une route GET/POST.
> TypeScript basique (les prérequis TypeScript de la formation suffisent).

---

## C'est quoi NestJS ?

**En une phrase** : NestJS, c'est Express sous stéroïdes avec de la structure imposée.

Tu connais Express ? Tu fais `app.get('/products', (req, res) => ...)` et tu organises ton code comme tu veux (ou pas). NestJS prend Express (ou Fastify) en dessous, et t'impose une structure claire inspirée d'Angular : modules, controllers, services.

**Pourquoi c'est utilisé dans cette formation ?**
Parce que NestJS implémente nativement les patterns d'architecture qu'on va étudier : injection de dépendances, séparation des responsabilités, décorateurs. C'est un cadre idéal pour apprendre l'architecture backend.

---

## Les 3 piliers : Module, Controller, Service

Imagine un restaurant :

| Concept | Analogie restaurant | Rôle dans NestJS |
|---|---|---|
| **Module** | Le restaurant lui-même | Regroupe et organise les éléments liés. "Voici tout ce qui concerne les produits." |
| **Controller** | Le serveur | Reçoit les commandes (requêtes HTTP) et les transmet en cuisine. Ne cuisine pas. |
| **Service** | Le cuisinier | Fait le vrai travail (logique métier, accès BDD). Ne parle pas aux clients. |

**La règle d'or** : Le Controller ne fait JAMAIS de logique métier. Il reçoit, il délègue au Service, il renvoie la réponse. C'est tout.

---

## Les décorateurs — la syntaxe qui fait peur (mais qui est simple)

En NestJS, tu vas voir beaucoup de `@TrucMachin`. Ce sont des **décorateurs**. Un décorateur, c'est juste une annotation qui dit à NestJS "ce truc-là, traite-le de telle manière".

```typescript
@Controller('products')  // "Cette classe gère les routes /products"
export class ProductController {

  @Get()                 // "Cette méthode répond aux GET /products"
  findAll() {
    return [];
  }

  @Post()                // "Cette méthode répond aux POST /products"
  create(@Body() data: CreateProductDto) {
    return data;
  }
}
```

Les décorateurs essentiels pour commencer :

| Décorateur | Signification |
|---|---|
| `@Controller('route')` | Cette classe est un controller, rattaché à la route donnée |
| `@Get()`, `@Post()`, `@Put()`, `@Delete()` | Cette méthode répond au verbe HTTP correspondant |
| `@Body()` | Extraire le corps de la requête |
| `@Param('id')` | Extraire un paramètre de l'URL (`/products/:id`) |
| `@Injectable()` | Cette classe peut être injectée (c'est un service) |
| `@Module({...})` | Cette classe est un module qui organise controllers et services |

Tu n'as pas besoin d'en savoir plus pour le moment. Guards, interceptors, pipes, middleware = on verra ça dans le Module 03.

---

## Walkthrough complet : un CRUD Produits

On va construire une API avec deux routes :
- `GET /products` -> retourne la liste des produits
- `POST /products` -> crée un produit

### Etape 1 — Le Service (le cuisinier)

```typescript
// product.service.ts
import { Injectable } from '@nestjs/common';

interface Product {
  id: number;
  name: string;
  price: number;
}

@Injectable() // Dit à NestJS : "tu peux injecter cette classe ailleurs"
export class ProductService {
  private products: Product[] = [
    { id: 1, name: 'Clavier mécanique', price: 89.99 },
    { id: 2, name: 'Souris ergonomique', price: 45.00 },
  ];

  findAll(): Product[] {
    return this.products;
  }

  create(name: string, price: number): Product {
    const newProduct: Product = {
      id: this.products.length + 1,
      name,
      price,
    };
    this.products.push(newProduct);
    return newProduct;
  }
}
```

**Ce qu'il faut retenir** : le Service contient la logique. Ici c'est un tableau en mémoire, en vrai ce serait une base de données. Le `@Injectable()` est obligatoire pour que NestJS sache qu'il peut gérer cette classe.

### Etape 2 — Le Controller (le serveur)

```typescript
// product.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { ProductService } from './product.service';

@Controller('products') // Toutes les routes commencent par /products
export class ProductController {

  // Le constructeur reçoit le service automatiquement (injection de dépendances)
  constructor(private readonly productService: ProductService) {}

  @Get() // GET /products
  findAll() {
    return this.productService.findAll();
  }

  @Post() // POST /products
  create(@Body() body: { name: string; price: number }) {
    return this.productService.create(body.name, body.price);
  }
}
```

**Ce qu'il faut retenir** :
- Le Controller ne fait rien lui-même. Il appelle le Service.
- `constructor(private readonly productService: ProductService)` = NestJS va automatiquement créer et fournir une instance de `ProductService`. C'est l'injection de dépendances. Tu ne fais jamais `new ProductService()` toi-même.
- `@Body()` extrait le JSON envoyé dans la requête POST.

### Etape 3 — Le Module (le restaurant)

```typescript
// product.module.ts
import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  controllers: [ProductController], // Les controllers de ce module
  providers: [ProductService],       // Les services disponibles dans ce module
})
export class ProductModule {}
```

**Ce qu'il faut retenir** : Le Module déclare "voici mes controllers et mes services". NestJS utilise ça pour savoir quoi injecter où. Si tu oublies de déclarer un service dans `providers`, NestJS ne pourra pas l'injecter et tu auras une erreur.

### Etape 4 — Brancher au module racine

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ProductModule } from './product/product.module';

@Module({
  imports: [ProductModule], // On importe notre module produit
})
export class AppModule {}
```

Et c'est tout. Avec ces 4 fichiers, tu as une API fonctionnelle.

---

## L'injection de dépendances — le concept clé

C'est LE concept qui revient partout dans la formation. Voici l'idée :

**Sans injection de dépendances (ce que tu fais peut-être en Express)** :

```typescript
class ProductController {
  handle(req, res) {
    const service = new ProductService(); // Tu crées le service toi-même
    const products = service.findAll();
    res.json(products);
  }
}
```

Problème : le Controller est collé au Service. Tu ne peux pas tester le Controller sans le vrai Service. Tu ne peux pas remplacer le Service par un mock.

**Avec injection de dépendances (ce que fait NestJS)** :

```typescript
@Controller('products')
class ProductController {
  constructor(private readonly productService: ProductService) {}
  // NestJS fournit le service. Tu ne sais pas comment il est créé.
  // En test, NestJS peut te fournir un faux service (mock).
}
```

Avantage : le Controller ne dépend que de l'interface du Service, pas de son implémentation. C'est un des principes SOLID (le D = Dependency Inversion) que tu verras en Ere 1.

---

## Ou se situe NestJS dans l'architecture ?

Quand tu arriveras à l'architecture hexagonale (Ere 2), tu apprendras que l'application se découpe en couches :

```
[Client HTTP] -> [Controller] -> [Service / Use Case] -> [Domaine]
                  ^                                        ^
                  |                                        |
              "Adapter"                                "Coeur"
              (NestJS vit ici)                     (logique pure)
```

NestJS, c'est la couche "adapter" — l'interface entre le monde extérieur (requêtes HTTP) et ta logique métier. Il reçoit les requêtes, les traduit en appels vers ton domaine, et renvoie les réponses.

C'est pour ça qu'on sépare Controller et Service : le Controller est un adapter HTTP, le Service contient (ou appelle) la logique métier.

---

## Ce que tu n'as PAS besoin de savoir maintenant

Tout ce qui suit sera couvert dans le Module 03. Ne t'en préoccupe pas :

- **Guards** : pour protéger des routes (auth). -> Module 03 : Auth OIDC
- **Interceptors** : pour transformer les réponses. -> Module 03 : Middleware pipeline
- **Pipes** : pour valider/transformer les données entrantes. -> Module 03 : Validation
- **Middleware** : similaire à Express middleware. -> Module 03 : Middleware pipeline
- **TypeORM / Prisma** : accès base de données. -> Module 04 : Architecture BDD
- **Configuration avancée** : variables d'env, modules dynamiques. -> On y viendra.

---

## Exercice rapide (15 min)

Pour vérifier que tu as compris, essaie de créer mentalement (ou sur papier) un module `User` avec :
- Un `UserService` qui a une méthode `findById(id: number)` retournant `{ id, name, email }`
- Un `UserController` avec une route `GET /users/:id` qui utilise le service
- Un `UserModule` qui regroupe les deux

Si tu sais écrire ça sans regarder les exemples ci-dessus, tu es prêt pour le Module 03.

---

## Ressources pour aller plus loin

- [NestJS First Steps](https://docs.nestjs.com/first-steps) — Le tutorial officiel (~2h)
- [NestJS Overview - Controllers](https://docs.nestjs.com/controllers) — Référence controllers
- [NestJS Overview - Providers](https://docs.nestjs.com/providers) — Référence services/DI

> **Rappel** : Tu n'as pas besoin de maîtriser NestJS pour commencer la formation.
> Tu as besoin de comprendre Module + Controller + Service + Injection de dépendances.
> Le reste viendra avec la pratique dans les exercices.
