# Correction — Exercice 60 : Decision Katas

---

## Kata 1 — Le CTO veut des microservices

### Analyse du contexte

Avant de choisir une option, identifions les signaux cles :

| Signal | Valeur | Interpretation |
|---|---|---|
| Taille equipe | 8 (3 back) | Trop petite pour operer des microservices (regle : 1 equipe par service) |
| Charge | 500 req/s | Un monolithe bien optimise gere facilement 10x plus |
| Disponibilite | 99.2% | Correct, pas de probleme flagrant |
| Temps de deploy | 8 min | Acceptable pour un monolithe |
| Experience microservices | Zero | Risque majeur d'apprentissage en production |
| Probleme a resoudre | Aucun identifie | Le CTO reagit a une tendance, pas a un probleme concret |

### Decision recommandee : Option B — Monolithe modulaire

```markdown
# ADR-060-1 : Architecture applicative — monolithe modulaire vs microservices

## Statut
Accepte

## Contexte
Le CTO souhaite migrer vers des microservices pour "scaler". L'application est un monolithe
NestJS qui fonctionne correctement (500 req/s, 99.2% dispo, 8 min de deploy).
L'equipe de 8 developpeurs n'a jamais opere de microservices en production.

## Options envisagees

### Option A — Microservices complets
Decoupage en 4 services. Necessite service mesh, distributed tracing, eventual consistency,
4 pipelines CI/CD, 4 bases de donnees.
→ Rejete : l'equipe n'a pas la maturite operationnelle. Le ratio cout/benefice est negatif
  quand il n'y a pas de probleme de scaling.

### Option B — Monolithe modulaire
Restructurer en modules stricts avec frontieres explicites (interfaces TypeScript,
pas d'import direct entre modules, injection de dependances).

### Option C — Strangler Fig progressif
Extraire 1 service (Paiement) pour tester l'approche.
→ Reserve comme etape future SI les triggers sont atteints.

### Option D — Ne rien changer
→ Rejete partiellement : le monolithe fonctionne, mais la structure interne peut etre amelioree
  pour faciliter une future extraction si necessaire.

## Decision
**Option B — Monolithe modulaire.**

### Justification
1. **Aucun probleme de scaling** : 500 req/s est loin des limites d'un monolithe NestJS
   (un seul serveur bien configure gere 5000+ req/s). Le CTO reagit a une mode, pas a un besoin.
2. **Equipe trop petite** : operer des microservices requiert au minimum 1 equipe
   (2-3 devs) par service. Avec 3 back-end, on aurait 1 dev par service — zero resilience humaine.
3. **Frontieres preparent le futur** : les modules stricts avec interfaces permettent
   une extraction future quasi-mecanique (le module devient un service, l'interface devient une API).
4. **Time-to-market** : restructurer le monolithe en modules prend ~2-3 sprints.
   Migrer vers des microservices prendrait 3-6 mois minimum.

### Triggers de migration vers C (Strangler Fig)
Migrer vers des microservices SI et SEULEMENT SI :
- L'equipe depasse 15 developpeurs (3+ equipes independantes)
- OU un domaine a des besoins de scaling 10x superieurs aux autres (ex: Catalogue a 10K req/s, Paiement a 100 req/s)
- OU le temps de deploy depasse 30 minutes et impacte la productivite
- OU un domaine necessite une techno differente (ex: Paiement en Go pour la performance)

## Consequences

### Positives
- Zero cout d'infra supplementaire
- L'equipe reste productive (pas de courbe d'apprentissage Kubernetes/service mesh)
- Les frontieres de modules servent de documentation vivante de l'architecture
- Migration future possible a moindre cout

### Negatives
- Le CTO peut etre decu (gerer la communication est important)
- Deploiement reste couple (tout le monolithe redeploy)

### Risques
- Si la croissance est explosive (100x en 1 an), le monolithe modulaire sera un goulot
- Mitige par les triggers mesurables ci-dessus
```

### Alternatives et arbitrages

**Pourquoi pas D (ne rien changer) ?** Meme si le monolithe fonctionne, structurer en modules est un investissement a faible cout qui ameliore la maintenabilite immediatement (chaque developpeur comprend mieux les frontieres) et facilite une migration future. C'est un "free lunch" architectural.

**Pourquoi pas C (Strangler Fig) immediatement ?** Parce que l'equipe n'a jamais opere de microservices. Extraire un service sans maturite ops, c'est introduire de la complexite distribuee (reseau, timeouts, retries, circuit breakers, monitoring distribue) sans en tirer de benefice. Mieux vaut d'abord modulariser proprement, puis extraire quand le besoin est reel.

**Le piege classique** : confondre "le code est mal organise" avec "il faut des microservices". Les microservices ne resolvent pas le mauvais code — ils le distribuent sur le reseau, ce qui le rend plus difficile a debugger.

---

## Kata 2 — Migrer la base de donnees

### Analyse du contexte

| Signal | Valeur | Interpretation |
|---|---|---|
| Version actuelle | MySQL 5.7 (EOL) | Urgence securite — il FAUT agir |
| Volume | 2 To, 150 tables | Migration non triviale |
| Requetes a adapter | 800 | Cout de migration significatif |
| Equipe | 6 devs | Capacite limitee pour operer du polyglotte |
| Frustrations | JSON lent, FTS basique, pas de DDL transactionnel | Problemes reels et quotidiens |

### Decision recommandee : Option B — Migrer vers PostgreSQL 16

```markdown
# ADR-060-2 : Migration de MySQL 5.7 vers PostgreSQL 16

## Statut
Accepte

## Contexte
MySQL 5.7 est en fin de vie (plus de patches de securite). L'equipe souffre de limitations
concretes : JSON lent, FTS basique, pas de DDL transactionnel. 2 To de donnees,
150 tables, 800 requetes SQL.

## Options envisagees

### Option A — Upgrade MySQL 8.0
Migration la moins risquee mais ne resout pas les frustrations principales (FTS, JSON).
→ Rejete : c'est un pansement. On repoussera le probleme de 2-3 ans sans le resoudre.

### Option B — Migrer vers PostgreSQL 16
Migration complete avec adaptation des 800 requetes SQL.

### Option C — Approche polyglotte
MySQL 8 + Elasticsearch + MongoDB.
→ Rejete : 3 bases a operer pour 6 devs est deraisonnable. La charge operationnelle
  (backup, monitoring, upgrade, synchro) tuerait la productivite.

## Decision
**Option B — Migration vers PostgreSQL 16.**

### Justification
1. **Securite** : MySQL 5.7 EOL impose d'agir. Tant qu'a migrer, autant resoudre les
   vrais problemes (JSON, FTS, DDL transactionnel).
2. **Gain net** : jsonb + GIN, tsvector + FTS excellent, DDL transactionnel, CTE recursif,
   extensions (pg_trgm, pgvector pour le futur).
3. **Ecosysteme** : PostgreSQL est le standard de facto pour les nouvelles apps.
   Recrutement plus facile, communaute plus active, pas de dependance Oracle.
4. **Investissement durable** : la migration coute 3-4 mois, mais les benefices durent 10+ ans.
5. **Stack unique** : evite la complexite operationnelle du polyglotte (option C).

## Plan de migration phase

### Phase 1 — Preparation (2 semaines)
- Audit des 800 requetes : categoriser par complexite de migration (trivial, moyen, complexe)
- Installer pgloader pour la migration de donnees
- Mettre en place un environnement PostgreSQL de test avec les donnees de production anonymisees
- Identifier les incompatibilites : TINYINT → SMALLINT, ENUM → CHECK ou type custom,
  AUTO_INCREMENT → SERIAL/IDENTITY, backticks → double quotes

### Phase 2 — Migration des requetes (6-8 semaines)
- Sprint 1-2 : requetes triviales (SELECT/INSERT/UPDATE sans specificites MySQL)
- Sprint 3-4 : requetes moyennes (GROUP_CONCAT → STRING_AGG, IFNULL → COALESCE,
  DATE_FORMAT → TO_CHAR, JSON_EXTRACT → jsonb operators)
- Sprint 5-6 : requetes complexes (procedures stockees, triggers, CTE)
- Chaque sprint : tests de non-regression sur les requetes migrees

### Phase 3 — Migration des donnees (1 semaine)
- pgloader pour la migration bulk (schema + donnees)
- Verification d'integrite (checksums par table)
- Tests de performance (les requetes critiques doivent etre au moins aussi rapides)

### Phase 4 — Bascule (1 semaine)
- Dual-write pendant 48h (ecrire dans MySQL ET PostgreSQL)
- Comparaison automatisee des resultats de lecture
- Bascule du traffic lecture vers PostgreSQL
- Arret du dual-write, MySQL en standby 2 semaines
- Decommissioning de MySQL

## Consequences

### Positives
- JSON natif performant (jsonb + GIN — requetes 10-50x plus rapides)
- Full-text search integre (elimine le besoin d'Elasticsearch pour 80% des cas)
- DDL transactionnel (plus de migrations echouees a moitie)
- Extensions futures (pgvector pour la recherche semantique, PostGIS pour la geo)

### Negatives
- 3-4 mois de travail sur la migration (cout d'opportunite : features non livrees)
- Risque de regression sur les 800 requetes
- L'equipe doit apprendre les specificites PostgreSQL

### Risques
- Regression non detectee en production → mitige par le dual-write + comparaison automatisee
- Retard sur le planning → mitige par la priorisation (migrer les modules critiques en premier)
- Performance degradee sur certaines requetes → mitige par les benchmarks en phase 3
```

### Alternatives et arbitrages

**Pourquoi pas A (MySQL 8.0) ?** C'est le chemin de moindre resistance, mais il ne resout pas les frustrations quotidiennes de l'equipe. Le FTS MySQL 8 reste basique compare a PostgreSQL tsvector. Le JSON est meilleur en MySQL 8, mais toujours inferieur a jsonb+GIN. Et surtout, dans 3 ans on se reposera la meme question. Autant investir maintenant.

**Pourquoi pas C (polyglotte) ?** Trois bases de donnees pour 6 developpeurs, c'est la garantie de nuits blanches en astreinte. Chaque base a besoin de monitoring, backup, upgrades, et une expertise specifique. L'equipe passerait plus de temps a maintenir l'infra qu'a developper des features.

**Le critere decisif** : MySQL 5.7 est EOL. Il faut migrer de toute facon. La question n'est pas "migrer ou pas" mais "vers quoi". Et si on fait l'effort de migrer, autant aller vers la meilleure option a long terme.

---

## Kata 3 — Build vs Buy

### Analyse du contexte

| Signal | Valeur | Interpretation |
|---|---|---|
| Volume produits | 50K → 200K en 1 an | Modere, tous les moteurs gerent ce volume |
| Besoins | Typo-tolerance, facettes, suggestions | Features avancees, pas un simple LIKE |
| Latence cible | < 100ms p95 | Exigeant mais atteignable |
| Equipe | 3 back + 1 DevOps | Capacite ops limitee |
| Budget | Non precise | A evaluer cout total (dev + infra + maintenance) |

### Decision recommandee : Option D — Meilisearch Cloud

```markdown
# ADR-060-3 : Choix du moteur de recherche full-text pour le catalogue

## Statut
Accepte

## Contexte
ShopArch a besoin d'une recherche avancee (typo-tolerance, facettes, auto-suggestions)
sur un catalogue de 50K → 200K produits. Latence cible : < 100ms p95. Equipe : 3 back + 1 DevOps.

## Options envisagees

### Option A — PostgreSQL FTS
tsvector + GIN + pg_trgm.
→ Rejete : repond bien a la recherche basique, mais la typo-tolerance (trigram) est limitee,
  les facettes necessitent des requetes agregees couteuses, et les auto-suggestions demandent
  un developpement custom significatif. Le p95 < 100ms sera difficile a tenir avec les facettes.

### Option B — Algolia (SaaS)
→ Rejete : la qualite de recherche est excellente, mais le cout a 200K produits
  (300-500 EUR/mois) et le vendor lock-in (API proprietaire, pas de self-hosting possible)
  sont des risques a long terme. Si Algolia augmente ses prix, la migration sera penible.

### Option C — Elasticsearch self-hosted
→ Reserve comme plan B : controle total mais charge operationnelle trop lourde pour 1 DevOps
  (3 noeuds HA, monitoring, backups, upgrades, mapping, analysers).

### Option D — Meilisearch Cloud
Moteur de recherche manage, open-source, avec typo-tolerance native.

## Decision
**Option D — Meilisearch Cloud.**

### Justification
1. **Time-to-market** : setup en quelques heures (vs semaines pour ES self-hosted).
   SDK JavaScript/TypeScript natif, configuration minimale.
2. **Qualite de recherche** : typo-tolerance excellente out-of-the-box (edit distance),
   facettes natives (filterable attributes), auto-suggestions en temps reel.
3. **Cout raisonnable** : ~100-200 EUR/mois pour 200K documents, soit 2-3x moins qu'Algolia
   pour des features equivalentes sur ce volume.
4. **Pas de vendor lock-in total** : Meilisearch est open-source. Si le SaaS devient trop
   cher, on peut self-host (Docker) ou migrer vers Elasticsearch via l'interface SearchProvider.
5. **Charge operationnelle zero** : le DevOps n'a pas a gerer de cluster. Monitoring,
   backups et upgrades sont geres par Meilisearch Cloud.
6. **Latence** : ~30ms de latence moyenne, bien en dessous du p95 < 100ms cible.

### Criteres de succes mesurables
- p95 de recherche < 100ms (mesure via observabilite front-end)
- Taux de "zero resultats" < 5% (mesure via analytics)
- Temps d'indexation < 10 minutes pour 200K produits
- Cout mensuel < 250 EUR

## Plan d'integration

### Semaine 1
- Creer un compte Meilisearch Cloud
- Implementer l'interface `SearchProvider` (abstraction) avec `MeilisearchProvider`
- Indexer les 50K produits depuis PostgreSQL (script batch)

### Semaine 2
- Implementer le webhook de synchronisation (quand un produit est cree/modifie/supprime
  dans PostgreSQL, mettre a jour l'index Meilisearch)
- Configurer les filterable attributes (categorie, prix, note) et les sortable attributes
- Implementer la recherche front-end (search bar + facettes + suggestions)

### Semaine 3
- Tests de charge (200K produits simulees)
- Monitoring : dashboard avec latence, taux d'erreur, taux de zero resultats
- Mise en production avec feature flag (10% du trafic puis 100%)

## Consequences

### Positives
- UX de recherche nettement superieure (typo-tolerance, facettes, suggestions)
- Mise en production en 2-3 semaines (vs 2-3 mois pour ES self-hosted)
- Zero charge operationnelle supplementaire pour le DevOps
- Migration possible vers self-hosted ou ES via l'interface SearchProvider

### Negatives
- Dependance a un service externe (SLA Meilisearch Cloud)
- Cout recurrent (~100-200 EUR/mois)
- Features ML/vector search moins matures qu'Elasticsearch

### Risques
- Meilisearch Cloud down → degradation gracieuse : fallback sur PostgreSQL FTS (basique mais fonctionnel)
- Cout qui augmente avec le volume → trigger : si > 400 EUR/mois, evaluer le self-hosting
- Fonctionnalites manquantes → trigger : si besoin de vector search ou ML ranking, migrer vers ES
```

### Alternatives et arbitrages

**Pourquoi pas A (PostgreSQL FTS) ?** Pour une recherche basique (nom + description), PostgreSQL FTS est excellent et gratuit. Mais les besoins exprimes (typo-tolerance, facettes, auto-suggestions) vont au-dela de ce que PostgreSQL fait nativement. Implementer tout ca en custom prendrait 2-3 mois de dev et serait fragile a maintenir. Le cout total (temps dev + maintenance) depasse largement le cout d'un SaaS.

**Pourquoi pas B (Algolia) ?** Algolia est la reference en qualite de recherche SaaS. Mais le modele de pricing (par operation de recherche) scale mal : a 200K produits avec du search-as-you-type (chaque frappe = 1 operation), la facture grimpe vite. Meilisearch Cloud offre un modele par nombre de documents, plus previsible.

**Pourquoi pas C (Elasticsearch self-hosted) ?** Elasticsearch est le moteur le plus puissant et le plus flexible. Mais la charge operationnelle d'un cluster ES (3 noeuds, JVM tuning, shard management, rolling upgrades) est disproportionnee pour 1 DevOps et 200K documents. C'est l'artillerie lourde pour un besoin modere. A reserver si les triggers sont atteints (volume > 1M, besoin de vector search, budget ops disponible).

**Le critere decisif** : le ratio temps-de-dev / qualite-de-resultat. Meilisearch Cloud donne 90% de la qualite d'Algolia et 80% de la flexibilite d'Elasticsearch pour 20% de l'effort total. C'est le "sweet spot" pour une equipe de cette taille avec ce volume.

---

## Grille d'evaluation commune aux 3 katas

Pour chaque ADR que tu as redige, verifie ces criteres :

| Critere | Valide ? |
|---|---|
| Le contexte est resume (pas de copier-coller de l'enonce) | |
| Toutes les options sont evaluees (pas de "j'ai choisi X sans regarder les autres") | |
| Les rejets sont justifies (pas juste "trop complexe") | |
| La decision est explicite et sans ambiguite | |
| Les consequences negatives sont admises (pas de solution parfaite) | |
| Les triggers de migration/changement sont mesurables (pas "quand ca ira mal") | |
| Le plan d'action est concret (phases, durees, livrables) | |
| Le ton est factuel, pas dogmatique ("nous recommandons X parce que Y", pas "X est la seule bonne option") | |

## Ce que tu aurais pu oublier

### 1. Confondre complexite accidentelle et complexite essentielle
Les microservices ajoutent de la complexite accidentelle (reseau, serialisation, distributed transactions) a un probleme qui n'a pas de complexite essentielle de distribution. Avant de distribuer, se demander : "quel probleme concret cette distribution resout-elle ?"

### 2. Ignorer le cout d'opportunite
3-4 mois de migration de base de donnees = 3-4 mois sans nouvelles features. Pour une startup, c'est potentiellement fatal. Toujours peser le benefice technique contre l'impact business.

### 3. Ne pas definir de fallback
Chaque decision architecturale devrait avoir un plan de degradation gracieuse. Meilisearch down ? Fallback sur PG FTS. ERP inaccessible ? Queue et retry. Pas de fallback = single point of failure.

### 4. Le biais du "resume de conference"
Le CTO du Kata 1 veut des microservices parce qu'il a vu une presentation. Les decisions architecturales doivent etre motivees par des problemes concrets et mesurables, pas par des tendances technologiques.
