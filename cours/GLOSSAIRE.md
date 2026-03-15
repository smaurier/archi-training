# Glossaire — Architecture & Technique

> Ce glossaire regroupe tous les termes techniques que tu vas croiser dans cette formation.
> Chaque terme est défini en une phrase, avec une analogie quand c'est utile.
> Tu peux le garder ouvert a cote pendant que tu bosses.

---

## Si tu retiens 10 termes

| Terme | En une phrase |
|---|---|
| **Clean Architecture** | Organise ton code en couches pour que le metier ne depende jamais du framework. |
| **Bounded Context** | Une frontiere claire autour d'un sous-domaine ou les mots ont un sens précis. |
| **Aggregate** | Un groupe d'objets traites comme une seule unite lors d'une modification. |
| **Dependency Injection** | Au lieu de créer ses dépendances, un objet les recoit de l'exterieur. |
| **DTO** | Un objet qui transporte des donnees entre deux couches sans logique metier. |
| **CQRS** | Separer les operations de lecture et d'écriture dans deux modèles distincts. |
| **JWT** | Un jeton signe qui prouve l'identite d'un utilisateur sans interroger le serveur à chaque requête. |
| **Migration** | Un script versionne qui modifie le schema de ta base de donnees de façon reproductible. |
| **CI/CD** | L'automatisation du build, des tests et du déploiement à chaque commit. |
| **Discriminated Union** | Un type TypeScript qui permet de distinguer des variantes grâce à un champ commun. |

---

## 1. Architecture générale

**ADR (Architecture Decision Record)** : Un document court qui explique une decision d'architecture, son contexte et ses consequences. *Comme un journal de bord : "On a choisi PostgreSQL parce que..."*

**Bounded Context** : Une frontiere explicite autour d'une partie du domaine ou chaque terme à une définition unique et précisé. *Dans le contexte "Vente", un `Client` n'a pas les memes attributs que dans le contexte "Support".*

**Clean Architecture** : Une organisation en couches concentriques ou le code metier est au centre et ne depend de rien d'externe. *Le coeur de ton appli ne sait pas si tu utilises Express ou NestJS.*

**Architecture Hexagonale** : Variante de Clean Architecture qui expose le metier via des ports (interfaces) connectes a des adaptateurs (implementations). *Un port `UserRepository`, un adaptateur `PostgresUserRepository`.*

**Layered Architecture** : Architecture classique en couches empilees (présentation, service, persistence), chaque couche ne parle qu'a celle du dessous. *Le controlleur appelle le service, le service appelle le repository, jamais l'inverse.*

**Monolithe** : Une application déployée comme un seul bloc. *Un seul `main()`, un seul artifact de déploiement.*

**Microservices** : Un système decompose en petits services independants, chacun déployé et scale separement. *Un service "Paiement", un service "Commande", un service "Notification".*

**Modular Monolith** : Un monolithe dont le code est strictement organise en modules independants, pret a etre découpé en microservices si besoin. *Un monolithe propre avec des frontieres claires entre modules.*

**Vertical Slice** : Organiser le code par fonctionnalite (feature) plutot que par couche technique. *Un dossier `create-order/` contient son controlleur, son service, son test et son DTO.*

**Trade-off** : Un compromis explicite entre deux qualites concurrentes lors d'un choix d'architecture. *"Plus de performance, mais plus de complexite" — tu documentes le pour et le contre.*

**Fitness Function** : Une mesure automatisee qui vérifié qu'une propriété d'architecture est respectee au fil du temps. *Un test qui echoue si un import interdit apparait entre deux modules.*

**Conway's Law** : La structure de ton logiciel finira par refleter la structure de communication de ton organisation. *Deux équipes qui ne se parlent pas produiront deux systèmes qui communiquent mal.*

**Strangler Fig** : Stratégie de migration qui remplace progressivement un ancien système en routant le trafic vers le nouveau, morceau par morceau. *Comme un figuier etrangleur qui enveloppe l'arbre hote jusqu'a le remplacer.*

**Anti-Corruption Layer (ACL)** : Une couche de traduction entre ton système et un système externe pour proteger ton modèle de domaine. *Un adaptateur qui transforme les réponses d'une vieille API en objets propres pour ton domaine.*

---

## 2. Domain-Driven Design

**Aggregate** : Un groupe d'objets metier toujours modifies ensemble, avec une racine qui garantit la coherence. *Un `Order` (racine) avec ses `OrderLine` : tu ne modifies jamais une ligne sans passer par la commande.*

**Entity** : Un objet metier défini par son identite unique, même si ses attributs changent. *Un `User` avec un `id` : s'il change de nom, c'est toujours le même user.*

**Value Object** : Un objet défini par sa valeur, pas par son identite — deux instances identiques sont interchangeables. *`Money(10, 'EUR')` est un Value Object : seule la valeur compte.*

**Domain Event** : Un fait metier qui s'est produit dans le passe et qu'on notifie au reste du système. *`OrderPlaced`, `PaymentReceived` — toujours au passe, toujours factuel.*

**Repository** : Une interface qui donne l'illusion d'une collection en mémoire pour acceder aux aggregates. *`userRepository.findById(id)` — tu ne sais pas si c'est PostgreSQL ou MongoDB derriere.*

**Service (Domain Service)** : Une operation metier qui n'appartient naturellement a aucune entite. *Calculer les frais de livraison implique `Order`, `Address` et `Carrier` — c'est un service.*

**Ubiquitous Language** : Le vocabulaire commun entre développeurs et experts metier, utilise partout (code, docs, conversations). *Si le metier dit "Bon de commande", ton code dit `PurchaseOrder`, pas `Order`.*

**Context Map** : Une carte qui montre les relations entre les Bounded Contexts et comment ils communiquent. *"Le contexte Facturation consomme les events du contexte Commande."*

**Shared Kernel** : Un petit morceau de code ou de modèle partage entre deux Bounded Contexts par accord mutuel. *Une librairie `shared/types` que deux modules utilisent — a manier avec precaution.*

---

## 3. Patterns back-end

**API REST** : Une interface web qui expose des ressources via les verbes HTTP (GET, POST, PUT, DELETE) et des URLs. *`GET /users/42` retourne l'utilisateur 42.*

**CRUD** : Les quatre operations de base sur une ressource : Create, Read, Update, Delete. *Un controlleur NestJS avec `@Post`, `@Get`, `@Put`, `@Delete`.*

**DTO (Data Transfer Object)** : Un objet qui transporte des donnees entre deux couches, sans logique metier. *`CreateUserDto { name: string; email: string }` — juste des champs, pas de méthodes.*

**Guard (NestJS)** : Un composant qui decide si une requête a le droit d'etre traitee avant d'atteindre le controlleur. *`AuthGuard` vérifié le JWT et bloque si le token est invalide.*

**Middleware** : Du code exécuté avant (où après) le traitement d'une requête dans le pipeline HTTP. *Logger le temps de réponse, ajouter un `correlationId` à chaque requête.*

**Pipe (NestJS)** : Un composant qui transforme ou valide les donnees entrantes avant qu'elles n'atteignent le handler. *`ValidationPipe` rejette une requête si le body ne correspond pas au DTO.*

**Module (NestJS)** : L'unite d'organisation de NestJS qui regroupe controllers, providers et imports lies à une fonctionnalite. *`@Module({ controllers: [UserController], providers: [UserService] })`.*

**Dependency Injection (DI)** : Un mécanisme ou un objet recoit ses dépendances de l'exterieur au lieu de les créer lui-même. *NestJS injecte `UserService` dans ton controlleur via le constructeur.*

**IoC (Inversion of Control)** : Le principe ou c'est le framework qui appelle ton code, pas l'inverse — la DI en est une forme. *Tu declares tes classes, NestJS decide quand les instancier.*

**ORM (Object-Relational Mapping)** : Une librairie qui mappe tes classes TypeScript vers des tables de base de donnees. *TypeORM ou Prisma : tu manipules des objets, l'ORM généré le SQL.*

**Migration** : Un script versionne qui modifie le schema de ta base de donnees de façon reproductible. *`20240115_add_email_to_users.ts` ajoute une colonne, et c'est rejouable sur tous les environnements.*

**Seed** : Un script qui insere des donnees initiales dans la base pour le développement ou les tests. *Créer un admin par defaut et quelques utilisateurs de test au démarrage.*

**Idempotency Key** : Un identifiant unique envoye avec une requête pour garantir qu'elle ne sera traitee qu'une seule fois, même si elle est rejouee. *Payer deux fois avec la même clé ne debite qu'une fois.*

---

## 4. Patterns distribues

**CQRS (Command Query Responsibility Segregation)** : Separer le modèle de lecture et le modèle d'écriture pour les optimiser independamment. *Un `Command` modifie la base, une `Query` lit une vue denormalisee ultra-rapide.*

**Event Sourcing** : Stocker l'état comme une sequence d'événements plutot que comme un instantane. *Au lieu de "solde = 90 EUR", tu gardes "depot 100, retrait 10" et tu recalcules.*

**Saga** : Un enchainement d'étapes distribuees avec des compensations en cas d'echec. *Reserver vol, puis hotel ; si l'hotel echoue, annuler le vol.*

**Outbox Pattern** : Écrire l'événement dans une table "outbox" de ta base dans la même transaction, puis le publier de façon asynchrone. *Garantit que l'event est emis si et seulement si la transaction reussit.*

**Circuit Breaker** : Un mécanisme qui coupe les appels vers un service distant defaillant pour éviter l'effet cascade. *Après 5 erreurs, le circuit s'ouvre et retourne une erreur immediatement pendant 30 secondes.*

**Eventual Consistency** : L'état du système finira par etre coherent, mais pas forcement immediatement après une écriture. *Ton commentaire apparait 200ms plus tard sur l'autre serveur — c'est normal.*

**CAP Theorem** : Dans un système distribue, tu ne peux garantir que deux des trois : Coherence, Disponibilité, Tolerance au partitionnement. *En pratique, tu choisis entre coherence forte et disponibilité maximale.*

**Message Broker** : Un intermédiaire qui recoit, stocke et distribue des messages entre services. *RabbitMQ, Kafka — le producteur publie, le broker livre aux consommateurs.*

---

## 5. Communication

**HTTP/2** : Evolution de HTTP/1.1 avec multiplexage, compression des headers et push serveur. *Plusieurs requêtes en parallele sur une seule connexion TCP.*

**WebSocket** : Un protocole de communication bidirectionnelle persistante entre le client et le serveur. *Un chat en temps réel : le serveur pousse les messages sans que le client ne demandé.*

**SSE (Server-Sent Events)** : Un flux unidirectionnel du serveur vers le client via HTTP. *Le serveur envoie des notifications en continu, le client ecoute — plus simple que WebSocket quand tu n'as pas besoin du sens inverse.*

**Webhook** : Un appel HTTP que le serveur distant effectue vers ton application quand un événement survient. *Stripe appelle ton endpoint `/webhook/payment` quand un paiement est confirme.*

**HMAC** : Un code d'authentification de message base sur une clé secrete partagee, pour vérifier l'integrite et l'origine. *Tu verifies la signature HMAC du webhook Stripe pour t'assurer qu'il vient bien de Stripe.*

**BFF (Backend for Frontend)** : Un backend dedie à un type de client spécifique qui agregue et formate les donnees pour lui. *Un BFF mobile qui retourne des payloads legers, un BFF web plus complet.*

**gRPC** : Un framework d'appel de procedure distante base sur HTTP/2 et Protocol Buffers, rapide et type. *Communication inter-services performante avec des contrats forts.*

**REST** : Un style d'architecture pour APIs web base sur les ressources, les verbes HTTP et les representations. *`GET /products/42` retourne le produit, `DELETE /products/42` le supprime.*

**GraphQL** : Un langage de requête pour API ou le client demandé exactement les champs dont il a besoin. *`{ user(id: 42) { name, email } }` — pas de sur-fetching, pas de sous-fetching.*

**Polling** : Le client interroge periodiquement le serveur pour vérifier s'il y a du nouveau. *`setInterval(() => fetch('/notifications'), 5000)` — simple mais inefficace a grande echelle.*

---

## 6. Sécurité

**OIDC (OpenID Connect)** : Un protocole d'authentification construit au-dessus d'OAuth2 qui standardise l'identification de l'utilisateur. *"Se connecter avec Google" utilise OIDC.*

**OAuth2** : Un protocole d'autorisation qui permet à une appli d'acceder a des ressources d'un utilisateur sans connaître son mot de passe. *Tu autorises l'appli X a lire ton calendrier Google sans lui donner tes identifiants.*

**JWT (JSON Web Token)** : Un jeton signe contenant des informations (claims) lisibles sans appel serveur. *`{ sub: "user42", role: "admin", exp: 1700000000 }` — le serveur vérifié juste la signature.*

**RBAC (Role-Based Access Control)** : Controle d'acces base sur les roles attribues a l'utilisateur. *Si ton role est "editor", tu peux modifier ; si c'est "viewer", tu ne peux que lire.*

**ABAC (Attribute-Based Access Control)** : Controle d'acces base sur des attributs (user, ressource, contexte) et des regles. *"Un manager peut valider les conges de son équipe, mais pas ceux d'une autre équipe."*

**CSP (Content Security Policy)** : Un header HTTP qui restreint les sources de contenu autorisees sur ta page pour bloquer les injections. *`script-src 'self'` interdit le chargement de scripts externes.*

**CORS (Cross-Origin Resource Sharing)** : Un mécanisme du navigateur qui controle quels domaines peuvent appeler ton API. *Ton front sur `app.com` appelle `api.app.com` — le serveur doit autoriser l'origine.*

**Rate Limiting** : Limiter le nombre de requêtes qu'un client peut faire dans un laps de temps. *100 requêtes par minute max par IP — au-dela, réponse 429 Too Many Requests.*

**STRIDE** : Un modèle de classification des menaces en six categories : Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege. *Un framework pour te poser les bonnes questions en revue de sécurité.*

**XSS (Cross-Site Scripting)** : Une attaque qui injecte du code JavaScript malveillant dans une page vue par d'autres utilisateurs. *Un commentaire qui contient `<script>alert('hack')</script>` et s'exécuté chez les autres.*

**CSRF (Cross-Site Request Forgery)** : Une attaque qui force le navigateur d'un utilisateur authentifie a effectuer une action a son insu. *Un lien malveillant qui declenche un virement sur le site de ta banque si tu es connecte.*

**SQL Injection** : Une attaque qui injecte du SQL malveillant dans une requête via une entree utilisateur non sanitisee. *`' OR 1=1 --` dans un champ login — utilise toujours des requêtes parametrees.*

**CMP (Consent Management Platform)** : Un outil qui géré le consentement des utilisateurs pour les cookies et le tracking, en conformite avec le RGPD. *Le bandeau cookies qui te demandé d'accepter ou refuser.*

**mTLS (mutual TLS)** : TLS ou le client et le serveur s'authentifient mutuellement avec des certificats. *Communication service-a-service securisee dans un cluster Kubernetes.*

---

## 7. Base de donnees

**Index** : Une structure qui accelere les recherches dans une table en evitant de scanner toutes les lignes. *Comme l'index d'un livre — tu cherches "PostgreSQL" et tu vas directement à la bonne page.*

**GIN Index** : Un index specialise de PostgreSQL pour les donnees composites (tableaux, JSONB, full-text). *Ideal pour rechercher dans un champ `tags JSONB` ou un vecteur de recherche.*

**Full-Text Search** : La capacité de rechercher dans du texte libre avec stemming, ranking et operateurs logiques. *Chercher "architecture" trouve aussi "architectural" grâce à la racinisation.*

**tsvector** : Le type PostgreSQL qui stocke un document sous forme de lexemes indexes pour le full-text search. *`to_tsvector('french', 'Les architectures modulaires')` produit `'architectur':2 'modulair':3`.*

**Migration** : Un script versionne qui modifie le schema de la base de donnees de façon controlable et rejouable. *Chaque migration à un `up()` et un `down()` pour avancer ou reculer.*

**Schema-per-tenant** : Une stratégie multi-tenant ou chaque client a son propre schema de base de donnees. *Tenant "acme" utilise le schema `acme.*`, tenant "globex" utilise `globex.*` — isolation forte.*

**Materialized View** : Une vue dont le résultat est stocke physiquement et rafraichi à la demandé. *Une vue `product_stats` pre-calculee qu'on rafraichit toutes les heures au lieu de recalculer à chaque requête.*

**JSONB** : Le type PostgreSQL qui stocke du JSON en binaire avec indexation et requêtes performantes. *Stocker des metadonnees flexibles sans créer de colonnes pour chaque champ.*

**Polyglot Persistence** : Utiliser plusieurs types de bases de donnees dans un même système, chacune adaptee a son usage. *PostgreSQL pour les commandes, Redis pour le cache, Elasticsearch pour la recherche.*

**N+1 Problem** : Un bug de performance ou tu fais 1 requête pour une liste, puis N requêtes pour les relations de chaque élément. *Charger 100 commandes, puis 100 requêtes pour leurs lignes — corrige avec un `JOIN` ou un `dataloader`.*

---

## 8. Front-end

**SSR (Server-Side Rendering)** : Le HTML est généré sur le serveur à chaque requête, puis envoye au navigateur. *Le navigateur recoit du HTML pret a afficher — bon pour le SEO et le premier affichage.*

**SSG (Static Site Génération)** : Le HTML est généré au build, pas à chaque requête — les pages sont pre-construites. *Un blog ou chaque article est un fichier HTML généré une fois à la compilation.*

**ISR (Incremental Static Regeneration)** : Les pages statiques sont regenerees en arriere-plan après un delai, sans rebuild complet. *La page produit est statique mais se met a jour toutes les 60 secondes automatiquement.*

**SPA (Single Page Application)** : Une application chargee en une seule page HTML, ou la navigation se fait cote client en JavaScript. *React Router change l'URL et le contenu sans recharger la page.*

**Hydration** : Le processus ou React rattache ses event handlers au HTML déjà rendu par le serveur. *Le HTML SSR s'affiche vite, puis React "prend le relais" pour le rendre interactif.*

**Design Tokens** : Des variables semantiques (couleurs, espacements, typo) qui definissent le système de design de façon agnostique. *`color.primary = #3B82F6` utilise partout, modifiable en un seul endroit.*

**Atomic Design** : Une méthodologie qui organise les composants UI en niveaux : atoms, molecules, organisms, templates, pages. *Un bouton (atome) + un input (atome) = un champ de recherche (molecule).*

**Headless Component** : Un composant qui fournit la logique et l'accessibilité sans imposer de style. *`useCombobox()` géré le clavier et l'ARIA, tu fournis le HTML et le CSS.*

**PWA (Progressive Web App)** : Une application web qui peut fonctionner hors-ligne, s'installer et envoyer des notifications comme une appli native. *Un site web avec un manifest et un Service Worker qui marche sans réseau.*

**Service Worker** : Un script qui s'exécuté en arriere-plan dans le navigateur, independamment de la page, pour gérer le cache et les notifications. *Il intercepte les requêtes réseau et peut servir les réponses depuis le cache.*

**CRDT (Conflict-free Replicated Data Type)** : Une structure de donnees qui se synchronise automatiquement entre plusieurs repliques sans conflit. *Deux utilisateurs editent le même document — les modifications fusionnent sans perte.*

**Micro-Frontend** : Decomposer le front-end en petites applications independantes, developpees et déployées separement. *L'équipe "Panier" deploie son micro-frontend sans toucher a celui de l'équipe "Catalogue".*

**hreflang** : Un attribut HTML qui indique aux moteurs de recherche la langue et la region d'une page. *`<link rel="alternate" hreflang="fr-FR" href="/fr/produit" />` pour le SEO multilingue.*

---

## 9. Performance & Infrastructure

**CDN (Content Delivery Network)** : Un réseau de serveurs distribues geographiquement qui sert le contenu au plus proche de l'utilisateur. *Tes images sont servies depuis un serveur a Paris pour les Français, a Tokyo pour les Japonais.*

**Cache L1/L2/L3** : Des niveaux de cache empiles, du plus rapide et local au plus partage et distant. *L1 = mémoire du processus, L2 = Redis local, L3 = CDN.*

**Redis** : Un store clé-valeur en mémoire, ultra-rapide, utilise pour le cache, les sessions et les files d'attente. *`redis.set('user:42', json)` — lecture en sous-milliseconde.*

**S3 (Simple Storage Service)** : Un service de stockage d'objets (fichiers) dans le cloud, hautement disponible. *Stocker les avatars et les documents uploades.*

**Docker** : Un outil qui empaquette ton application et ses dépendances dans un conteneur isolable et reproductible. *"Ça marche sur ma machine" n'existe plus — le conteneur est identique partout.*

**Kubernetes (K8s)** : Un orchestrateur de conteneurs qui géré le déploiement, le scaling et la disponibilité de tes applications. *Kubernetes détecté qu'un pod est mort et en relance un nouveau automatiquement.*

**Helm** : Un gestionnaire de paquets pour Kubernetes qui simplifie le déploiement via des charts templatisees. *`helm install my-app ./chart` deploie toute ta stack avec des valeurs configurables.*

**Terraform** : Un outil d'Infrastructure as Code qui créé et géré des ressources cloud via des fichiers declaratifs. *Tu decris "je veux une base PostgreSQL et un bucket S3" et Terraform le créé.*

**Blue/Green Deploy** : Déployer la nouvelle version sur un environnement identique (green), puis basculer le trafic d'un coup depuis l'ancien (blue). *Rollback instantane : tu rebascules sur blue si green à un problème.*

**Canary Deploy** : Déployer la nouvelle version pour un petit pourcentage d'utilisateurs avant de l'etendre a tous. *5% du trafic va sur la v2, tu surveilles les metriques, puis tu montes progressivement.*

**Feature Flag** : Un interrupteur qui active ou désactivé une fonctionnalite sans redeploy. *`if (featureFlags.newCheckout)` — tu actives pour 10% des users, puis 100%.*

**SLO (Service Level Objective)** : Un objectif interne de qualite de service mesurable. *"99.9% des requêtes doivent repondre en moins de 200ms."*

**SLI (Service Level Indicator)** : La metrique réelle mesuree pour évaluer un SLO. *Le p99 de latence mesure cette semaine est de 180ms.*

**SLA (Service Level Agreement)** : Un contrat formel avec le client qui définit le niveau de service garanti et les penalites. *"99.5% de disponibilité par mois, sinon credit de 10%."*

**Error Budget** : La marge d'erreur toleree avant de violer un SLO — consommee par chaque incident. *SLO a 99.9% = 43 minutes de downtime autorisees par mois. Si tu les depasses, tu geles les releases.*

**Load Balancer** : Un composant qui distribue le trafic entrant entre plusieurs instances de ton application. *Trois serveurs derriere un load balancer — chaque requête va au moins charge.*

---

## 10. Testing

**Unit Test** : Un test qui vérifié le comportement d'une unite isolee (fonction, classe) sans dépendances externes. *`expect(calculateTotal(items)).toBe(42)` — rapide, déterministe, sans base de donnees.*

**Intégration Test** : Un test qui vérifié que plusieurs composants fonctionnent correctement ensemble. *Tester que ton service + ta base de donnees inserent et lisent correctement un utilisateur.*

**E2E Test (End-to-End)** : Un test qui simule le parcours complet d'un utilisateur a travers toute l'application. *Playwright ouvre le navigateur, remplit le formulaire, clique "Valider" et vérifié la page de confirmation.*

**Contract Test (Pact)** : Un test qui vérifié que le contrat d'API entre un consumer et un provider est respecte des deux cotes. *Le front dit "je m'attends a `{ name: string }`", le back vérifié qu'il le fournit bien.*

**Load Test (k6)** : Un test qui simule de la charge pour vérifier que l'application tient sous la pression. *k6 envoie 1000 requêtes/seconde pendant 5 minutes et mesure la latence.*

**Smoke Test** : Un test minimaliste qui vérifié que l'application demarre et repond — le strict minimum. *Après un déploiement, `GET /health` retourne 200 — ça fume pas, c'est bon.*

**A11y (Accessibility)** : L'ensemble des pratiques qui rendent ton application utilisable par les personnes en situation de handicap. *Navigation au clavier, attributs ARIA, contraste suffisant.*

**MSW (Mock Service Worker)** : Une librairie qui intercepte les requêtes HTTP au niveau du Service Worker pour les mocker dans les tests front. *Pas besoin de backend pour tester — MSW repond à la place.*

**Test Double** : Terme générique pour tout objet qui remplace une vraie dépendance dans un test. *Mock, stub, spy, fake — ce sont tous des test doubles.*

**Mock** : Un test double qui vérifié qu'une méthode a ete appelee avec les bons arguments. *`expect(mailer.send).toHaveBeenCalledWith('user@test.com', 'Bienvenue')` — tu testes l'interaction.*

**Stub** : Un test double qui retourne une réponse predeterminee sans logique. *`jest.fn().mockReturnValue({ id: 1, name: 'Alice' })` — il repond toujours la même chose.*

**Spy** : Un test double qui laisse l'implementation réelle s'exécuter tout en enregistrant les appels. *`jest.spyOn(service, 'save')` — la vraie méthode tourne, mais tu peux vérifier qu'elle a ete appelee.*

---

## 11. DevOps & Observabilité

**CI/CD (Continuous Intégration / Continuous Delivery)** : L'automatisation du build, des tests et du déploiement declenchee à chaque push de code. *Push sur `main` → build → tests → déploiement en staging automatiquement.*

**Pipeline** : La sequence d'étapes automatisees (build, test, deploy) executee par ton système de CI/CD. *Un pipeline GitLab avec les stages `lint`, `test`, `build`, `deploy`.*

**OpenTelemetry** : Un standard open-source pour collecter traces, metriques et logs de façon unifiee et vendor-agnostic. *Instrumente ton code une fois, exporte vers Jaeger, Datadog ou Grafana.*

**Prometheus** : Un système de monitoring qui collecte des metriques en scrappant des endpoints HTTP et permet de créer des alertes. *Ton appli expose `/metrics`, Prometheus les collecte toutes les 15 secondes.*

**Grafana** : Un outil de visualisation qui affiche des dashboards à partir de sources de donnees comme Prometheus, Loki ou Elasticsearch. *Un dashboard avec les courbes de latence, CPU et taux d'erreur de ton service.*

**Structured Logging** : Logger en JSON avec des champs structures plutot qu'en texte libre. *`{ "level": "error", "message": "Payment failed", "orderId": "42", "userId": "7" }` — filtrable et parsable.*

**Correlation ID** : Un identifiant unique propage dans tous les services pour tracer une requête de bout en bout. *Chaque requête recoit un UUID, passe de service en service, et apparait dans tous les logs.*

**Tracing** : L'enregistrement du chemin complet d'une requête a travers les différents services, avec le temps passe dans chacun. *Un trace montre : API Gateway (2ms) → OrderService (15ms) → PaymentService (200ms).*

**GitOps** : Une pratique ou l'état desire de l'infrastructure est declare dans Git, et un operateur applique automatiquement les changements. *Tu fais un PR pour changer un replicas de 2 a 3, merge = déploiement automatique.*

**IaC (Infrastructure as Code)** : Gérer ton infrastructure via des fichiers de code versionnes plutot que des clics dans une console. *Terraform, Pulumi — ton infra est dans Git, reproductible et auditable.*

---

## 12. TypeScript

**Branded Type** : Un type nominal créé en ajoutant une propriété fantome pour empecher la confusion entre types structurellement identiques. *`type UserId = string & { __brand: 'UserId' }` — tu ne peux plus passer un `ProductId` par erreur.*

**Discriminated Union** : Une union de types qui partagent un champ commun (discriminant) permettant a TypeScript de les distinguer. *`type Shape = { kind: 'circle'; radius: number } | { kind: 'rect'; w: number; h: number }` — `switch(shape.kind)` et TypeScript sait tout.*

**Type Guard** : Une fonction qui retrecit le type d'une variable via un predicat `is`. *`function isUser(x: unknown): x is User` — après le `if`, TypeScript sait que c'est un `User`.*

**Narrowing** : Le mécanisme par lequel TypeScript retrecit automatiquement un type après un test conditionnel. *`if (typeof x === 'string')` — dans le bloc, `x` est `string`, plus `string | number`.*

**Generic** : Un paramètre de type qui rend une fonction ou une classe réutilisable pour plusieurs types. *`function first<T>(arr: T[]): T` — fonctionne avec `string[]`, `number[]`, n'importe quoi.*

**Utility Type** : Des types fournis par TypeScript pour transformer d'autres types facilement. *`Partial<User>` rend tous les champs optionnels, `Pick<User, 'name' | 'email'>` n'en garde que deux.*

**`as const`** : Une assertion qui fige une valeur comme literal et readonly à la compilation. *`const roles = ['admin', 'user'] as const` — TypeScript infere `readonly ['admin', 'user']`, pas `string[]`.*

**`satisfies`** : Un operateur qui vérifié qu'une valeur est compatible avec un type sans elargir son type infere. *`const config = { port: 3000 } satisfies Config` — l'inference reste `{ port: 3000 }`, pas `Config`.*

**Inference** : La capacité de TypeScript a deduire automatiquement le type d'une variable sans annotation explicite. *`const x = 42` — TypeScript sait que c'est un `number`, pas besoin de le dire.*

---

> **Astuce** : Si un terme te semble flou en contexte, reviens ici. Ce glossaire est fait pour etre consulte, pas appris par coeur.
