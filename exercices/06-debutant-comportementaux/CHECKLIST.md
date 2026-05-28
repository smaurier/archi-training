# Checklist — Exercice 06 : Patterns Comportementaux

## Partie 1 — Chain of Responsibility
- [ ] Classe abstraite `SupportHandler` avec `setNext()` chaînable
- [ ] `handle()` appelle `process()` ou délègue au suivant
- [ ] Les 3 handlers traitent les bons niveaux de priorité
- [ ] Un ticket `critical` atteint bien le Manager
- [ ] Je peux expliquer ce qui se passe si aucun handler ne traite

## Partie 2 — Command
- [ ] Interface `Command` avec `execute()` et `undo()`
- [ ] `AppendCommand` mémorise le texte pour pouvoir l'annuler
- [ ] `CommandHistory` empile et dépile correctement
- [ ] Undo restaure l'état précédent (pas d'effet de bord)
- [ ] Je peux expliquer comment ajouter `DeleteCommand`

## Partie 3 — Iterator
- [ ] `Range` implémente `[Symbol.iterator]()`
- [ ] `for...of` fonctionne sur `Range`
- [ ] Le spread `[...new Range(1, 6)]` retourne `[1,2,3,4,5]`
- [ ] `step` fonctionne correctement (Range(0,20,5) → 0,5,10,15)
- [ ] Je comprends la différence `Iterable` vs `Iterator`

## Partie 4 — Mediator
- [ ] `Bidder` ne connaît que `AuctionMediator`, jamais les autres `Bidder`
- [ ] `AuctionRoom` notifie tous sauf l'auteur de l'enchère
- [ ] Les offres inférieures sont refusées
- [ ] Je peux calculer N×(N-1)/2 liens sans Mediator pour N acheteurs

## Partie 5 — Memento
- [ ] `CalculatorMemento` est opaque (getter, pas setter)
- [ ] `Calculator.save()` crée un snapshot sans modifier l'état
- [ ] `Calculator.restore()` restaure correctement l'état
- [ ] Undo après plusieurs opérations revient à l'état précédent
- [ ] Le Caretaker ne peut pas lire le contenu du Memento directement

## Partie 6 — Observer
- [ ] `Stock` maintient une liste d'observers
- [ ] `subscribe` et `unsubscribe` fonctionnent
- [ ] `setPrice()` notifie tous les observers abonnés
- [ ] Après `unsubscribe`, l'observer ne reçoit plus de notifications
- [ ] Les observers sont indépendants (l'un peut lever une exception sans bloquer les autres)

## Partie 7 — State
- [ ] Interface `TrafficLightState` avec `getColor()` et `next(light)`
- [ ] Chaque état connaît son successeur
- [ ] `TrafficLight` délègue `next()` et `getColor()` à son état courant
- [ ] 6 appels à `next()` produisent ROUGE→VERT→ORANGE→ROUGE→VERT→ORANGE
- [ ] Je peux expliquer pourquoi State est meilleur qu'un if/else

## Partie 8 — Strategy
- [ ] Interface `SortStrategy<T>` avec `sort(data): T[]`
- [ ] Les 3 strategies ne mutent pas le tableau original (spread ou `.slice()`)
- [ ] `Sorter.setStrategy()` change le comportement à la volée
- [ ] Je peux expliquer comment choisir la strategy au runtime

## Partie 9 — Template Method
- [ ] Classe abstraite avec méthode template `generate()` non surchargeable
- [ ] Les 3 méthodes abstraites sont obligatoirement implémentées
- [ ] `TextReportGenerator` et `HtmlReportGenerator` produisent le bon format
- [ ] Ajouter `MarkdownReportGenerator` n'affecte pas la classe abstraite
- [ ] Je comprends la différence avec Strategy

## Partie 10 — Visitor
- [ ] Double dispatch : `shape.accept(v)` → `v.visitShape(this)`
- [ ] `AreaCalculatorVisitor` calcule correctement les 3 formules
- [ ] `SvgExporterVisitor` produit du SVG valide pour chaque forme
- [ ] Ajouter `PerimeterCalculatorVisitor` = 1 nouvelle classe, 0 modification
- [ ] Je comprends pourquoi c'est l'Open/Closed Principle en action
