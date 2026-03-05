# Exercice 60 — Decision Katas

> 🟡 **Difficulte** : Conception | **Temps estime** : 2h | **Ere** : 7 — L'Architecte
>
> **Prerequis** : Au moins 40 exercices completes

## Objectif

Pas de code. Uniquement des decisions architecturales argumentees.

Chaque kata presente un scenario metier realiste avec plusieurs options viables. Ton travail : analyser les trade-offs, choisir une option, et rediger un ADR (Architecture Decision Record) structure pour justifier ta recommandation.

---

## Kata 1 — Le CTO veut des microservices

**Contexte :** Tu es lead dev dans une startup e-commerce de 8 developpeurs (3 back, 3 front, 1 DevOps, 1 data). L'application est un monolithe NestJS + PostgreSQL qui tourne en production depuis 18 mois. Le CTO revient d'une conference et veut migrer vers des microservices "pour scaler". Le monolithe actuel :

- 120K lignes de code TypeScript
- 4 domaines metier identifies (Catalogue, Commandes, Paiement, Utilisateurs)
- Temps de deploy : 8 minutes (CI/CD complet)
- Charge : ~500 requetes/seconde en pic
- 99.2% de disponibilite sur les 6 derniers mois
- Aucun probleme de performance identifie
- L'equipe n'a jamais opere de microservices en production

**Options :**

| Option | Description | Avantages | Inconvenients |
|---|---|---|---|
| **A — Microservices complets** | Decoupe en 4 services independants avec communication asynchrone (RabbitMQ), bases de donnees separees | Deploiement independant par equipe, scaling granulaire, isolation des pannes | Complexite operationnelle massive (service mesh, distributed tracing, eventual consistency), equipe trop petite pour operer, cout infra x3-4 |
| **B — Monolithe modulaire** | Garder le monolithe mais restructurer en modules stricts (Vertical Slices) avec des frontieres explicites (interfaces, pas d'import direct entre modules) | Zero cout d'infra supplementaire, frontieres claires, migration future possible, equipe familiere | Deploiement couple (tout redeploy a chaque changement), pas de scaling independant |
| **C — Extraction progressive (Strangler Fig)** | Identifier le domaine le plus independant (ex: Paiement) et l'extraire en service autonome, garder le reste en monolithe | Apprentissage progressif, risque limite, valide l'approche microservices sur 1 service avant de continuer | Complexite de la cohabitation monolithe + service, synchronisation des donnees, plus lent |
| **D — Ne rien changer** | Le monolithe fonctionne bien. 500 req/s n'est pas un probleme de scaling. Investir le temps sur les features metier | Zero risque technique, time-to-market maximal | Le CTO peut etre frustre, dette architecturale possible si la croissance accelere |

**Ta mission :** Redige un ADR recommandant une option. Justifie ton choix en analysant les trade-offs par rapport au contexte (taille equipe, charge, maturite ops). Definis des triggers mesurables qui declencheraient un changement de strategie.

---

## Kata 2 — Migrer la base de donnees

**Contexte :** L'application ShopArch tourne sur MySQL 5.7 depuis 4 ans. La version 5.7 est en fin de vie (plus de patches de securite). L'equipe de 6 developpeurs rencontre plusieurs frustrations :

- Pas de support JSON natif performant (les requetes JSON sont lentes)
- Pas de full-text search correct (FULLTEXT MyISAM est obsolete, InnoDB FTS est basique)
- Les migrations de schema sont penibles (pas de DDL transactionnel — un `ALTER TABLE` qui echoue laisse la table dans un etat intermediaire)
- Le CTE (Common Table Expressions) recursif est limite
- 2 To de donnees, 150 tables, 800 requetes SQL dans le code

L'equipe hesite entre 3 strategies :

**Options :**

| Option | Description | Avantages | Inconvenients |
|---|---|---|---|
| **A — Upgrade MySQL 8.0** | Rester sur MySQL, passer a la version 8.0+ qui supporte le JSON natif, les CTE ameliores et le DDL atomique | Migration la moins risquee (compatibilite quasi-totale), l'equipe connait MySQL, peu de changements de code | Ne resout pas le FTS (toujours basique), JSON toujours moins performant que PostgreSQL jsonb, enferme dans l'ecosysteme Oracle |
| **B — Migrer vers PostgreSQL 16** | Migration complete vers PostgreSQL avec adaptation des requetes SQL, des types et des procedures | JSON natif (jsonb + GIN), FTS excellent (tsvector), DDL transactionnel, extensions riches (PostGIS, pgvector, pg_trgm), communaute open-source | Migration lourde (800 requetes a adapter, types differents — TINYINT, ENUM, AUTO_INCREMENT), risque de regression, 3-4 mois de travail, equipe doit apprendre PG |
| **C — Approche polyglotte** | Garder MySQL 8.0 pour le relationnel, ajouter Elasticsearch pour le FTS et MongoDB pour les donnees JSON dynamiques | Chaque techno utilisee pour son point fort, pas de migration massive | 3 bases a operer (monitoring, backup, expertise), synchronisation des donnees, complexite operationnelle enorme pour 6 devs, cout infra x3 |

**Ta mission :** Redige un ADR recommandant une strategie. Prends en compte le cout de migration (3-4 mois de travail vs. continuer a livrer des features), le risque de regression sur 800 requetes, et la capacite operationnelle de l'equipe. Propose un plan de migration phase si tu choisis B.

---

## Kata 3 — Build vs Buy

**Contexte :** Le product owner de ShopArch veut un systeme de recherche full-text avance pour le catalogue produits (50 000 produits aujourd'hui, objectif 200 000 dans 1 an). Les besoins :

- Recherche par nom, description, categorie, attributs (taille, couleur, matiere)
- Typo-tolerance ("chausure" doit trouver "chaussure")
- Facettes (filtrer par prix, categorie, note moyenne)
- Auto-suggestions (search-as-you-type)
- Temps de reponse < 100ms p95
- L'equipe a 3 developpeurs back-end et 1 DevOps

**Options :**

| Option | Description | Avantages | Inconvenients |
|---|---|---|---|
| **A — Construire avec PostgreSQL FTS** | Utiliser tsvector + GIN + pg_trgm pour la typo-tolerance, materialiser les facettes avec des requetes agregees | Zero cout d'infra supplementaire, stack unique, l'equipe connait PG | Typo-tolerance limitee (pg_trgm trigram, pas de vrai fuzzy edit-distance), facettes couteuses (agreger a chaque requete), auto-suggestions complexes a implementer, maintenance custom |
| **B — Algolia (SaaS)** | Indexer les produits dans Algolia, utiliser leur API pour la recherche, les facettes et les suggestions | Setup en 1-2 jours, UX de recherche excellente, typo-tolerance native, facettes zero-config, CDN mondial (latence ~20ms), zero ops | Cout eleve a 200K produits (~300-500 EUR/mois pour les operations de recherche), vendor lock-in (API proprietaire), donnees hebergees chez un tiers, personnalisation du ranking limitee |
| **C — Elasticsearch self-hosted** | Deployer un cluster Elasticsearch, indexer les produits, utiliser la Search DSL | Controle total sur le ranking (BM25, boosting, scripts), facettes natives (aggregations), fuzzy search excellent, open-source | Cluster a operer (3 noeuds minimum pour la HA, monitoring, backup, upgrades), synchronisation DB → ES a implementer, mapping et analysers a configurer, courbe d'apprentissage, cout infra ~150-250 EUR/mois |
| **D — Meilisearch Cloud (SaaS manage)** | Utiliser Meilisearch Cloud comme moteur de recherche manage | Typo-tolerance excellente, facettes natives, tres simple a configurer, open-source (pas de vendor lock-in total), latence ~30ms, cout modere (~100-200 EUR/mois) | Moins de controle sur le ranking qu'Elasticsearch, communaute plus petite, features avancees (vector search, ML ranking) moins matures |

**Ta mission :** Redige un ADR recommandant une option. Justifie ton choix en evaluant les criteres suivants : cout total (infra + temps dev + maintenance), time-to-market, qualite de la recherche (UX), charge operationnelle pour l'equipe, et risque de vendor lock-in. Definis le plan d'integration et les criteres de succes mesurables.
