# Cours 82 — Conway's Law, Team Topologies & Communication

> **Objectif** : Comprendre Conway's Law et l'Inverse Conway Maneuver, maîtriser les 4 types d'équipes Team Topologies, et savoir communiquer une decision architecturale a différentes audiences (CTO, devs, PO).

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce que le plugin manifest et pourquoi est-il declaratif ?</summary>

Le manifest (YAML) déclaré les permissions, endpoints, events, egress hosts, routes, widgets et blocks du plugin. Il est declaratif pour que le système puisse **valider** et **restreindre** les capacités du plugin avant de l'activer (principe du moindre privilege). Le plugin ne peut pas faire plus que ce que le manifest déclaré.
</details>

<details>
<summary>2. Qu'est-ce que l'adapter boundary pattern ?</summary>

On place une **interface** (port) entre l'application et un service tiers (Unlayer, Elasticsearch). L'application ne connait que l'interface. L'adapter implémenté l'interface pour le service tiers. Si on remplace le service → on change 1 adapter au lieu de refactorer tout le code. Cout de remplacement minimal.
</details>

---

## Analogie — L'armee et la radio

L'organisation d'une armee déterminé sa stratégie :
- Si 3 divisions ne communiquent pas entre elles → 3 stratégies independantes (pas de coordination)
- Si elles partagent le même canal radio → une stratégie coordonnee

**Conway's Law** : la structure de communication de l'organisation se retrouve dans la structure du système. Si 4 équipes travaillent sur un compilateur, tu obtiens un compilateur en 4 modules.

---

## Théorie

### 1. Conway's Law

```
"Les organisations qui concoivent des systemes sont contraintes
de produire des designs qui sont des copies de leurs structures
de communication." — Melvin Conway, 1967

Equipe 1 : Front    ┐
Equipe 2 : Back     ├──> Architecture : Front → API → DB
Equipe 3 : DBA      ┘    (3 couches = 3 equipes)

vs

Equipe A : Catalog   ┐
Equipe B : Orders    ├──> Architecture : 3 services domaine
Equipe C : Users     ┘    (3 domaines = 3 equipes)
```

### 2. Inverse Conway Maneuver

```
Au lieu de laisser l'organisation dicter l'architecture :
  → Definir l'architecture cible
  → Reorganiser les equipes pour qu'elles correspondent

"Si tu veux des microservices, organise tes equipes comme des microservices."

AVANT (equipes par couche) :
  Frontend Team → Backend Team → DBA Team
  Resultat : monolithe en 3 couches, forte coordination

APRES (equipes par domaine) :
  Catalog Team (FE + BE + DB)
  Order Team (FE + BE + DB)
  Resultat : services autonomes, faible coordination inter-equipes
```

### 3. Team Topologies — 4 types d'équipes

| Type | Mission | Exemple |
|---|---|---|
| **Stream-aligned** | Delivrer de la valeur business | Équipe Catalog, équipe Checkout |
| **Platform** | Fournir des outils aux stream-aligned | Équipe DevOps, équipe Design System |
| **Enabling** | Aider les autres a monter en compétence | Équipe Architecture, équipe QA |
| **Complicated-subsystem** | Gérer un sous-système technique complexe | Équipe Search/ML, équipe Security |

### 4. 3 modes d'interaction

```
Collaboration :
  Equipe A <──────> Equipe B
  Travaillent ensemble temporairement (quelques sprints)
  Quand : decouverte, innovation, nouveau domaine

X-as-a-Service :
  Equipe A ──uses──> Platform Team
  Interface claire, API stable, pas de collaboration directe
  Quand : le service est mature et stable

Facilitation :
  Enabling Team ──helps──> Equipe A
  Coaching, mentorat, pas de production directe
  Quand : montee en competence, adoption d'un nouvel outil
```

### 5. Impact sur l'architecture

```
4 equipes stream-aligned → 4 services/modules autonomes
1 equipe platform → 1 plateforme partagee (CI/CD, monitoring, auth)
1 equipe enabling → pas de code en prod (coaching uniquement)

Team APIs :
  Chaque equipe stream-aligned publie une "Team API" :
  - Quelles APIs elle maintient
  - Quels events elle emet/ecoute
  - Quel SLA elle garantit
  - Comment la contacter (Slack channel, on-call)
```

### 6. Communication architecturale — adapter le message

| Audience | Ce qu'elle veut savoir | Format |
|---|---|---|
| **CTO** | Impact business, risques, cout, timeline | 1 slide, ROI chiffre |
| **Devs** | Comment ça marche, qu'est-ce qui change, migration | ADR + diagramme C4 |
| **PO** | Impact utilisateur, features impactees, delais | Demo, user stories |
| **Client** | Ça marche, c'est fiable, c'est rapide | SLA, uptime, metriques |

```
Pitcher un ADR :
  1. "On a un probleme" (1 phrase)
  2. "Voici les options" (tableau comparatif)
  3. "On recommande X parce que" (1-2 arguments)
  4. "Le trade-off est" (ce qu'on perd)
  5. "Le plan" (timeline, migration steps)

Ne PAS :
  - Presenter 15 slides techniques au PO
  - Dire "c'est mieux" sans justification
  - Ignorer les trade-offs
```

---

## Pratique

### Team API template

```markdown
# Team API — Catalog Team

## Mission
Gerer le catalogue produits : CRUD, categories, recherche, media.

## Owned services
- `catalog-service` (NestJS)
- `search-indexer` (worker)

## API endpoints
- `GET/POST/PATCH/DELETE /api/products`
- `GET /api/categories`
- `GET /api/search?q=...`

## Events emitted
- `product.created` (payload: { id, name, categoryId })
- `product.updated` (payload: { id, changes })
- `product.published` (payload: { id, siteId })

## Events consumed
- `media.uploaded` (from Media Team)
- `tenant.created` (from Platform Team)

## SLA
- API p95 < 200ms
- Search p95 < 300ms
- Availability 99.9%

## Contact
- Slack: #team-catalog
- On-call: PagerDuty rotation
- Tech lead: Alice
```

### Conway's Law analysis exercise

```typescript
// Analyser si l'architecture correspond a la structure d'equipe
interface Team {
  name: string;
  members: string[];
  owns: string[];    // Services/modules
}

interface Dependency {
  from: string; // Service
  to: string;   // Service
}

function analyzeConway(
  teams: Team[],
  dependencies: Dependency[],
): ConwayReport {
  const crossTeamDeps: Dependency[] = [];

  for (const dep of dependencies) {
    const fromTeam = teams.find((t) => t.owns.includes(dep.from));
    const toTeam = teams.find((t) => t.owns.includes(dep.to));

    if (fromTeam && toTeam && fromTeam.name !== toTeam.name) {
      crossTeamDeps.push(dep);
    }
  }

  return {
    totalDependencies: dependencies.length,
    crossTeamDependencies: crossTeamDeps.length,
    ratio: crossTeamDeps.length / dependencies.length,
    // Ratio > 0.3 = trop de coordination inter-equipes
    recommendation:
      crossTeamDeps.length / dependencies.length > 0.3
        ? 'Consider reorganizing teams to reduce cross-team dependencies'
        : 'Team structure aligns well with architecture',
    details: crossTeamDeps,
  };
}
```

---

## Résumé

1. **Conway's Law** : la structure de l'organisation se retrouve dans la structure du système — c'est une LOI, pas une suggestion
2. **Inverse Conway** : définir l'architecture cible PUIS reorganiser les équipes pour correspondre
3. **Team Topologies** : stream-aligned (valeur business), platform (outils), enabling (coaching), complicated-subsystem (expertise technique)
4. **3 interactions** : collaboration (temporaire), X-as-a-Service (stable), facilitation (montee en compétence)
5. **Communication** : adapter le message a l'audience — CTO (ROI), devs (ADR), PO (impact utilisateur)

---

> **Prochain cours** : [Cours 83 — Evolutionary Architecture, FinOps & Wardley Mapping](./07-evolutionary-finops-wardley.md)

---

> **Lien fil rouge — ShopArch**
>
> - Analyse l'alignement Conway's Law pour ShopArch : une équipe par Bounded Context ?
> - Identifie les Team Topologies appropriées (stream-aligned, platform, enabling)
> - Exercice(s) associé(s) : `exercices/55-team-topologies/`
> - Checkpoint : Module 12, critère 4
