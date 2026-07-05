# Lab 02 — Choisir le bon pattern (ou aucun)

> **Outcome :** à la fin, tu sais, face à un problème TribuZen brut, **nommer le problème**, décider quel design pattern y répond (ou décider qu'aucun n'est justifié), et **argumenter** ton choix — la compétence réelle attendue en entretien et en revue d'archi.
> **Vrai outil :** un document de décision (Markdown ou papier) + esquisses d'interfaces TypeScript. **Pas de test-runner, pas de harnais** — c'est un lab de raisonnement, évalué par une grille + le coach.
> **Feedback :** le coach challenge chaque justification en session. Un pattern « appliqué pour faire propre » sans problème nommé = échec du critère, même si le code est correct.

---

## Énoncé

Tu es l'architecte de TribuZen. On te soumet **trois situations réelles**. Pour **chacune**, tu produis une **fiche de décision** en 4 points :

1. **Le problème en UNE phrase** (« je dois… »).
2. **Le pattern retenu** — Factory, Strategy, Observer, Adapter, Decorator, Repository, Singleton… **ou "aucun pattern"** si un simple `if`/une fonction suffit.
3. **La justification** : pourquoi ce pattern et pas un voisin proche (ex. Factory plutôt que Strategy).
4. **Une esquisse d'interface** TypeScript (5-15 lignes, signatures seulement — pas d'implémentation complète).

> **Piège volontaire :** au moins une des trois situations ne mérite **aucun** pattern. Repérer l'over-engineering fait partie de la note.

### Situation A — Paiement des cotisations de tribu

TribuZen encaisse les cotisations via **Stripe aujourd'hui**, mais l'équipe sait qu'un gros client mutualiste imposera **son propre prestataire (SlimPay)** dans 6 mois. Le SDK Stripe expose `stripe.paymentIntents.create({ amount, currency })` ; SlimPay exposera une signature totalement différente. Ton domaine, lui, veut juste appeler `payer(cotisation)`.

### Situation B — Statut d'invitation d'un membre

Une invitation à rejoindre une tribu a un statut : `pending`, `accepted`, `declined`. À l'affichage, on montre un libellé et une couleur selon le statut. Il y a exactement ces trois cas, définis par le métier, et **aucune évolution prévue** depuis 2 ans.

### Situation C — Journal d'activité de la tribu

Quand un membre rejoint, quitte, ou crée un événement, TribuZen doit : (1) écrire une ligne dans le **feed d'activité**, (2) mettre à jour un **compteur de badges**, (3) éventuellement **envoyer une notif** aux admins. Demain on voudra aussi **indexer pour la recherche**. Le code qui déclenche l'action (`member.join()`) ne doit **pas** connaître tous ces effets, et on veut pouvoir en **ajouter sans rouvrir** `member.join()`.

---

## Étapes (en friction)

1. **Situation A** — écris le problème en une phrase. Le mot « signature totalement différente » + « ton domaine veut juste `payer()` » doit t'orienter. Nomme le pattern, esquisse l'interface `PaymentGateway` et l'adaptateur.
2. **Situation B** — résiste. Compte les cas, vérifie l'évolution prévue. Décide **honnêtement** s'il faut un pattern. Écris la solution minimale.
3. **Situation C** — identifie le mot-clé « ajouter sans rouvrir » et « la source ne doit pas connaître les effets ». Nomme le pattern, esquisse l'API `on` / `emit`.
4. Pour chaque fiche, **écris la phrase "et pas [voisin] parce que…"** — c'est là que se joue la vraie compréhension.
5. **Auto-évalue-toi** avec la grille ci-dessous **avant** de lire la correction indicative.

---

## Grille d'évaluation (auto + coach)

| Critère | 0 — insuffisant | 1 — correct | 2 — solide |
|---|---|---|---|
| **Problème nommé** | pattern cité sans problème formulé | problème vague | « je dois… » précis et juste pour les 3 |
| **Pattern juste** | 2+ erreurs de choix | 1 erreur ou hésitation | les 3 choix corrects, dont le "aucun" de B |
| **Discrimination des voisins** | aucune | 1 justification "et pas X" | chaque choix opposé à son voisin proche |
| **Over-engineering repéré** | ajoute un pattern à B | doute mais tranche mal | B tranché "aucun pattern", argumenté YAGNI |
| **Esquisse d'interface** | absente ou fausse | signatures approximatives | interfaces propres, domaine découplé de la techno |

**Seuil de réussite : 7/10, avec obligatoirement le critère "over-engineering" ≥ 1.** Un lab où tu colles un pattern à la Situation B est recalé quelle que soit la note globale : le but pédagogique central est de savoir dire NON à un pattern.

---

## Correction indicative (à lire APRÈS ta fiche)

**Situation A → Adapter (+ Factory si multi-prestataires simultanés).**
Problème : « je dois faire tenir deux SDK de paiement aux signatures incompatibles derrière une seule interface `PaymentGateway` que mon domaine appelle ». C'est la définition d'Adapter. Pas Strategy : on ne choisit pas un *algorithme* interchangeable à chaud, on *traduit* une API externe. Si les deux prestataires coexistent selon le client, une Factory choisit l'adaptateur — mais le cœur reste l'Adapter.

```ts
interface PaymentGateway {
  payer(cotisation: Cotisation): Promise<PaymentResult>   // vocabulaire domaine
}
class StripeAdapter implements PaymentGateway {
  constructor(private stripe: StripeClient) {}
  payer(c: Cotisation): Promise<PaymentResult> { /* traduit vers stripe.paymentIntents.create */ }
}
// SlimPayAdapter implements PaymentGateway → écrit dans 6 mois, 0 ligne changée dans le domaine
```

**Situation B → AUCUN pattern.** (Le piège.)
Trois cas figés, zéro évolution en 2 ans → une `Map` de config ou un `switch` de 4 lignes suffit. Introduire Strategy (trois classes) ou un State pattern serait de l'over-engineering pur (viole YAGNI). La bonne réponse est de **ne pas** sortir le catalogue.

```ts
const LABELS: Record<InviteStatus, { text: string; color: string }> = {
  pending:  { text: 'En attente', color: 'amber' },
  accepted: { text: 'Acceptée',   color: 'green' },
  declined: { text: 'Refusée',    color: 'red'   },
}
// Si un jour des transitions à valider apparaissent → alors, et seulement alors, une FSM/State.
```

**Situation C → Observer.**
Problème : « quand un événement métier survient, N effets doivent réagir sans que la source les connaisse, et on veut en ajouter sans rouvrir la source ». Signature exacte d'Observer. Pas Decorator (on n'enrichit pas un objet, on notifie des abonnés indépendants). Reste **synchrone en mémoire** ici — le jour où il faut durabilité/retry inter-services, ce sera un vrai bus de messages (module 17), pas un `EventEmitter`.

```ts
interface ActivityBus {
  on<T>(event: string, handler: (p: T) => void): () => void
  emit<T>(event: string, payload: T): void
}
// member.join() → bus.emit('member.joined', {...}) ; feed, badges, notif, search s'abonnent séparément
```

---

## Variante J+30 (fading)

**Sans relire ce lab ni le module 02**, en **20 minutes** :

1. Prends **une seule** nouvelle situation TribuZen : *« Chaque appel au `PaymentGateway` doit maintenant être retryé 3× en cas d'échec réseau, loggé, et son temps de réponse mesuré — sans toucher à `StripeAdapter` ni au domaine. »*
2. Nomme le problème, choisis le(s) pattern(s), esquisse l'interface.
3. **Contrainte ajoutée** : tu dois combiner **exactement deux** patterns du module et expliquer pourquoi l'ordre d'empilement compte.

**Critère de réussite :** tu identifies **Decorator** (retry + log + métrique empilés autour du `PaymentGateway`, même interface), tu montres la composition `new MetricsDecorator(new RetryDecorator(new StripeAdapter()))`, et tu justifies que la métrique doit englober les retries (sinon elle ne mesure qu'une tentative).

---

## Application TribuZen

Ces trois décisions se matérialisent dans `smaurier/tribuzen` :

```
tribuzen/
  src/
    domain/
      billing/
        payment.gateway.ts       ← interface (Situation A)
    infra/
      billing/
        stripe.adapter.ts        ← Adapter (A)
        retry.decorator.ts       ← Decorator (variante J+30)
    activity/
      activity.bus.ts            ← Observer (Situation C)
    invitations/
      invite-status.ts           ← simple Record, AUCUN pattern (Situation B)
```

**Commit cible :**
```
docs(archi): fiches de décision patterns — paiement (adapter), invitation (aucun), activité (observer)
```

Range ces fiches dans `docs/adr/` de TribuZen : elles deviennent tes premiers **Architecture Decision Records** — le format travaillé au module 23.
