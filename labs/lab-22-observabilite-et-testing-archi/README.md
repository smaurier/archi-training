# Lab 22 — Observabilité et testabilité au niveau architecture

> **Outcome :** à la fin, tu sais prendre un flux TribuZen aveugle et non testé, et **concevoir** (a) son observabilité — quels logs structurés, quelles métriques RED, quel SLO + error budget, quelle corrélation par `traceId` — et (b) sa stratégie de test architecturale — forme de pyramide par composant + où poser (et ne PAS poser) un contract test.
> **Vrai outil :** papier / tableau blanc / fichier `.md` — c'est un exercice de **conception**, pas d'implémentation. Tu produis un plan d'observabilité + un tableau de stratégie de test + un mini-ADR. **Aucun code à faire tourner, aucun outil à installer.**
> **Feedback :** le coach valide le raisonnement en session (grille ci-dessous). Pas de test-runner.

---

## Énoncé

TribuZen a un flux **« féliciter un enfant qui termine sa semaine de routines »** (feature « badge hebdo »). Il traverse **trois briques indépendantes** :

1. **App mobile** (React Native) — l'enfant coche sa dernière routine de la semaine ; l'app appelle l'API.
2. **API NestJS** — vérifie que la semaine est complète, attribue le badge en base, publie un événement `week.completed`.
3. **Service de badges & notifications** — consomme `week.completed`, génère l'image du badge, notifie le co-référent.

Un contributeur pressé a livré ça sans aucune observabilité ni test de frontière. Voici l'état actuel côté API (tu le lis, tu n'as **pas** à l'exécuter) :

```ts
// award-badge.controller.ts — aveugle et non testé
@Controller('weeks')
export class AwardBadgeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

  @Post(':childId/complete-week')
  async completeWeek(@Param('childId') childId: string) {
    console.log('complete week');                          // (1) log inutile
    const done = await this.prisma.completion.count({ where: { childId } });
    if (done < 7) {
      console.log('not enough');                           // (2)
      throw new BadRequestException('semaine incomplète');
    }
    const badge = await this.prisma.badge.create({ data: { childId, week: 'current' } });
    this.bus.publish({ type: 'week.completed', childId, badgeId: badge.id }); // (3) pas de traceId
    console.log('ok');                                     // (4)
    return { badgeId: badge.id };
  }
}
```

Symptômes : en cas d'incident, on a `complete week / not enough / ok` sans contexte ; les 3 briques loguent en silos non corrélés ; aucun seuil ne dit « c'est cassé » ; et un rename de champ entre l'API et le mobile passe en prod sans alerte.

**Ta mission (conception uniquement) :**

### Partie A — Concevoir l'observabilité du flux

1. **Événements loggés** — liste les événements structurés (nom `entity.action`, `level`, champs de contexte) à émettre aux points de décision/échec. Marque explicitement les champs **PII-free**.
2. **Métriques RED** — quelles métriques Rate / Errors / Duration exposer sur ce flux (et pourquoi des percentiles, pas la moyenne).
3. **SLO + error budget** — définis le **SLI** (formule), le **SLO** (cible chiffrée + fenêtre) et l'**error budget** correspondant (en temps/mois). Dis à quoi sert ce budget.
4. **Corrélation** — trace le chemin du `traceId` : où il naît, comment il se propage aux 3 briques (y compris à **l'événement** `week.completed`). Décris le parcours de diagnostic « alerte → trace → log » d'un incident.

### Partie B — Concevoir la stratégie de test architecturale

5. **Forme de pyramide par composant** — pour chaque brique/élément (entité `Week`/règle « 7 jours », adaptateur Prisma `badge`, endpoint HTTP, consumer d'événement, parcours mobile→API→notif), choisis **pyramide** (unit massif) ou **honeycomb** (intégration dominante) et **justifie** par « où vit la complexité ».
6. **Contract testing** — décide **UNE** frontière où poser un contract test consumer-driven (déclare le schéma attendu), et **UNE** frontière où il serait **superflu**. Justifie les deux.
7. **Mini-ADR** — 6-10 lignes résumant les décisions d'observabilité + de test.

**Contrainte de portée :** on **conçoit**, on n'implémente pas. Interdit de partir dans le code OpenTelemetry, la config Grafana, ou l'écriture de tests Vitest/Pact — ça, c'est le **cours 16** (observabilité) et le **cours 06** (tests). Ici : **quoi** observer, **quel** SLO, **quelles** frontières sous contrat, **quelle** forme de pyramide — et **pourquoi**.

---

## Étapes (en friction)

1. **Cartographie des points chauds.** Relis le controller et repère chaque point de **décision** (« 7 jours ? ») et d'**échec** possible (base, bus, service de badges). Pour chacun : que veut savoir un ops à 3h du matin ?
2. **Rédige les logs structurés.** Pour chaque point chaud, écris l'objet log : `event`, `level`, champs. Piège PII : le badge concerne un **enfant** — quels champs peux-tu mettre en clair, lesquels doivent être hashés ?
3. **Choisis les métriques RED.** Rate/Errors/Duration du endpoint. Justifie pourquoi tu regardes le **p95/p99** et pas la moyenne.
4. **Pose le SLO.** Écris le SLI (formule), choisis une cible et une fenêtre (ex : 30 j), calcule l'error budget en minutes/heures. Dis quelle **décision** ce budget déclenche s'il s'épuise.
5. **Trace le `traceId`.** Dessine mobile → API → bus → service badges avec le `traceId` propagé partout (y compris dans l'événement). Décris le diagnostic en 3 sauts.
6. **Attribue une forme de test à chaque composant.** Remplis le tableau (composant → pyramide/honeycomb → raison). Le piège : l'adaptateur Prisma et le consumer d'événement — logique pure ou I/O ?
7. **Place le contrat.** Identifie la frontière entre briques **indépendantes** (cycles de déploiement différents) → contrat. Identifie une frontière **interne** → pas de contrat. Écris le schéma attendu du contrat choisi.
8. **Mini-ADR + auto-contrôle.** Rédige l'ADR, puis repasse la grille ci-dessous sur ta copie avant de la montrer au coach.

---

## Corrigé complet commenté

> Le corrigé porte sur les **décisions de conception**, pas sur du code exécutable. Les extraits sont des **spécifications** (à quoi ressemble le log / le contrat), pas de l'implémentation.

### Partie A — Observabilité

**1. Événements loggés (structurés, PII-free)**

```
event: "week.completion.received"   (info)  — { traceId, familyId, childHash }
event: "week.completion.rejected"   (warn)  — { traceId, familyId, childHash, reason: "incomplete", daysDone }
event: "badge.awarded"              (info)  — { traceId, familyId, childHash, badgeId }
event: "badge.persist.failed"       (error) — { traceId, familyId, childHash, reason: "db_error" }
event: "week.completed.published"   (info)  — { traceId, familyId, badgeId }
event: "badge.notification.failed"  (error) — { traceId, familyId, reason: "renderer_down" }
```

- **Nom `entity.action`**, pas de phrase libre → filtrable et comptable (`count(reason="db_error")`).
- **`level` discipliné** : `error` = un humain doit agir ; `warn` = anormal mais géré (semaine incomplète = cas métier normal, donc `warn`, pas `error`) ; `info` = événement attendu.
- **PII-free** : jamais le **prénom** de l'enfant en clair. On garde `familyId` (pseudonyme) et `childHash` (hash). Contrainte RGPD **et** engagement vie privée famille de TribuZen.

**2. Métriques RED du endpoint `complete-week`**

- **Rate** : `week.completion.received` par minute.
- **Errors** : `badge.persist.failed` / total.
- **Duration** : histogramme de latence → on suit **p95 et p99**, pas la moyenne (la moyenne noie les enfants qui vivent une lenteur ; le p99 la révèle).

**3. SLO + error budget**

```
SLI  : 1 − (badge.persist.failed / week.completion.received)   [succès d'attribution]
SLO  : ≥ 99,5 % de semaines complétées attribuent le badge, sur 30 jours glissants
Error budget : 0,5 % × 30 j ≈ 3,6 h/mois d'échecs budgétés
Décision : si le budget se consomme trop vite (burn-rate élevé) → alerte ;
           si épuisé → GEL des nouvelles features, focus fiabilité de l'attribution.
```

Le SLO transforme « ça rate parfois » en une **décision chiffrée**. On alerte sur le **rythme de consommation** du budget, pas sur une erreur isolée (sinon faux positifs).

**4. Corrélation par `traceId`**

```
Mobile ──[traceparent: T1]──▶ API ──[traceparent: T1]──▶ base
                                │
                                └──[event week.completed, traceId: T1]──▶ Service badges
```

- Le `traceId` **naît dans l'app mobile** (point d'entrée réel).
- Il voyage en **header HTTP** vers l'API, puis est **copié dans l'événement** `week.completed` (sinon la brique badges est un silo).
- Il est injecté dans **chaque log** et **chaque span**.

Diagnostic d'incident en **3 sauts** : alerte « error rate > SLO » (metric) → ouvrir **la trace** d'une requête fautive → voir le span `badge.persist` en erreur → lire le log `badge.persist.failed` avec `reason` et `familyId`. Plus de `console.log('ok')` à l'aveugle.

### Partie B — Stratégie de test

**5. Forme de pyramide par composant**

| Composant | Nature | Forme | Pourquoi |
|---|---|---|---|
| Entité `Week` — règle « 7 jours complets », anti-double-attribution | Logique métier **pure** | **Pyramide** (unit massif) | Aucune I/O ; beaucoup de cas limites rapides et stables (6 jours, 7, 8, semaine déjà validée) |
| `PrismaBadgeRepository` (adaptateur base) | I/O, **peu** de logique | **Honeycomb** (intégration) | Un unit qui mocke Prisma ne teste rien ; la valeur est de vérifier la vraie requête/contrainte d'unicité |
| Endpoint `POST /:childId/complete-week` | Frontière HTTP entrante | **Intégration** | Vérifie le câblage couches + codes HTTP (400 semaine incomplète, 201 badge) |
| Consumer de `week.completed` (service badges) | I/O + orchestration | **Honeycomb** | Surtout de la coordination (rendu image + notif) ; l'intégration avec un vrai message a le plus de valeur |
| Parcours mobile → API → notif | Parcours **critique** | **E2E** — 1 scénario | Chemin vital, mais coûteux/fragile → un seul |

**6. Contract testing**

- **Frontière SOUS contrat : app mobile ↔ API.** Les deux briques ont des **cycles de déploiement différents** (l'app est publiée sur les stores, lente à mettre à jour ; l'API se déploie plusieurs fois/semaine). Contrat consumer-driven :

```
Contrat (le mobile déclare ce qu'il attend de POST /:childId/complete-week) :
  réponse 201 → { badgeId: string }
  réponse 400 → { message: string }   quand la semaine est incomplète
```

L'API vérifie ce contrat **en CI**. Le jour où quelqu'un renomme `badgeId → id`, la CI **casse avant le déploiement** — la version d'app déjà installée sur les téléphones ne casse pas en prod.

- **Frontière SANS contrat : API ↔ son propre `PrismaBadgeRepository`.** Une seule brique, une seule équipe, même cycle de déploiement. Un contrat ici serait de la **cérémonie** : les tests d'intégration de l'API couvrent déjà cette couture.

**7. Mini-ADR (exemple attendu)**

```
ADR-22 — Observabilité & stratégie de test du flux « badge hebdo »
Contexte : flux à 3 briques (mobile, API, service badges) livré aveugle et non testé aux frontières.
Observabilité :
  - Logs structurés entity.action, PII-free (childHash, jamais le prénom), level discipliné.
  - Métriques RED sur le endpoint ; suivi p95/p99, pas la moyenne.
  - SLO 99,5 %/30j sur l'attribution ; error budget ≈ 3,6 h/mois → gèle les features si épuisé.
  - traceId né sur mobile, propagé en header ET dans l'événement week.completed.
Tests :
  - Pyramide pour le domaine Week (logique pure) ; honeycomb pour repo Prisma et consumer d'événement (I/O).
  - Contract test consumer-driven sur mobile↔API (cycles de déploiement disjoints).
  - Pas de contrat API↔repo interne (même brique) : intégration suffit.
Conséquence : un incident se diagnostique en 3 sauts (metric→trace→log) ;
  un breaking change de la frontière mobile↔API est bloqué en CI avant déploiement.
```

**Pourquoi ce corrigé est correct :** l'observabilité est **conçue** (événements + métriques + SLO + corrélation décidés à l'avance, pas ajoutés après) ; la testabilité suit la **structure** (pure→pyramide, I/O→honeycomb) ; le contrat est posé **exactement** sur la frontière entre briques indépendantes et **nulle part ailleurs** ; et aucune ligne d'implémentation n'a été écrite — tout reste au niveau des décisions d'architecture.

---

## Grille d'évaluation (coach)

| Critère | Attendu | ✅ / ❌ |
|---|---|---|
| Logs structurés | Événements `entity.action` nommés, `level` discipliné (semaine incomplète = `warn`, pas `error`), contexte métier | |
| PII-free | Le prénom de l'enfant **jamais** en clair ; `childHash`/`familyId` seulement, justifié RGPD/vie privée | |
| Métriques RED | Rate + Errors + Duration identifiés, avec justification percentiles (p95/p99) vs moyenne | |
| SLI/SLO/error budget | SLI = formule, SLO = cible + fenêtre chiffrées, error budget calculé + décision associée (gel features) | |
| Corrélation `traceId` | Né sur mobile, propagé aux 3 briques **y compris dans l'événement** ; diagnostic en 3 sauts décrit | |
| Forme de pyramide | Chaque composant a une forme justifiée par « où vit la complexité » (pure→pyramide, I/O→honeycomb) | |
| Contract testing | UNE frontière sous contrat (briques indépendantes) + UNE sans (interne), les deux justifiées | |
| Portée respectée | Reste au niveau conception ; ne part pas dans l'implémentation OTel/Grafana/Vitest/Pact | |

Seuil : **6/8** pour valider. En dessous, reprends la Partie A (observabilité) avant la Partie B — on ne teste bien que ce qu'on sait déjà observer.

---

## Variante J+30 (fading)

**Même exercice, contraintes ajoutées :**

1. **En 25 minutes, de mémoire**, sans relire ce corrigé ni le module 22.
2. On te donne un **nouveau** flux TribuZen : **« export mensuel du journal d'une famille en PDF »** (l'app demande l'export → l'API lance un **job asynchrone** → un worker génère le PDF → upload sur le stockage → notifie l'app quand c'est prêt). Conçois son observabilité (logs + métriques + SLO + `traceId`) et sa stratégie de test.
3. **Contrainte supplémentaire :** ce flux est **asynchrone** (le job peut durer). Identifie **une** différence d'observabilité par rapport à un flux synchrone (indice : que devient le SLI — c'est un taux d'erreur, ou une **latence de bout en bout** / fraîcheur du résultat ?) et **une** conséquence sur la propagation du `traceId` à travers la file de jobs.

**Critère de réussite :** plan d'observabilité + tableau de stratégie de test + ADR de ~6 lignes, produits en 25 min, avec (a) un SLI adapté à l'async (durée/fraîcheur, pas seulement erreurs) et (b) le `traceId` correctement propagé **à travers le job** (pas perdu au passage dans la file).

---

## Application TribuZen

Ce lab prépare la mise en observabilité et la stratégie de test réelles de TribuZen (repos `smaurier/tribuzen-api` et `smaurier/tribuzen-mobile`).

- Le flux **« badge hebdo »** existera vraiment (gamification des routines, cf. spec §science/engagement).
- Le plan d'observabilité produit ici est le **cahier des charges** qu'on implémentera au **cours 16** (OpenTelemetry + Loki/Tempo/Grafana) — le lab décide **quoi**, le cours 16 code **comment**.
- Le contract test mobile↔API décidé ici sera écrit au **cours 06** (Pact / schéma OpenAPI) et branché en CI.
- La contrainte **PII-free** rejoint l'engagement Level 1 (device-only, chiffré) de la spec : ce que l'appareil chiffre ne doit jamais réapparaître dans un log serveur.

**Commit cible :**
```
docs(observability): plan d'observabilité + stratégie de test du flux badge hebdo (logs structurés, SLO, traceId, contract mobile↔API)
```
