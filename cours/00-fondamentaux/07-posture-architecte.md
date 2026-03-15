# Cours 7 — De l'exécutant au décideur : la posture d'architecte

## Objectif

A la fin de ce cours, tu sauras **identifier ton niveau de maturité architecturale**, comprendre pourquoi le syndrome de l'imposteur est normal (et comment le dépasser), raisonner systématiquement en trade-offs plutôt qu'en solutions, utiliser le framework RAPID pour structurer tes décisions, et poser les bonnes questions avant chaque choix technique. Ce cours est le pont entre les fondamentaux (module 00) et la pratique des patterns architecturaux (module 01) — il ne s'agit plus de savoir coder, mais de savoir décider.

Si TypeScript te fait encore peur, c'est normal — on y va étape par étape. L'architecture, c'est avant tout une façon de penser, pas un langage.

---

## Rappel du cours précédent

Teste ta mémoire avant de continuer.

**Question 1 — Qu'est-ce qu'une fitness function et quel problème résout-elle ?**

<details>
<summary>Réponse</summary>

Une fitness function est un **test automatisé qui vérifie qu'une caractéristique d'architecture reste respectée** dans le temps. Par exemple : un test de charge qui vérifie que le P95 reste sous 200ms, ou un test d'architecture qui vérifie qu'aucun fichier du domaine n'importe de l'infrastructure.

Le problème résolu : les décisions d'architecture se dégradent silencieusement au fil du temps (un import interdit ici, un bundle trop gros là). Les fitness functions transforment des propriétés qualitatives en assertions automatisables qui s'exécutent en CI — si ça passe, l'architecture est respectée.
</details>

**Question 2 — Qu'est-ce qu'un ADR et pourquoi est-ce essentiel dans une équipe ?**

<details>
<summary>Réponse</summary>

Un **ADR** (Architecture Decision Record) est un document court qui capture une décision d'architecture avec son contexte, la décision prise, ses conséquences positives et négatives, et les alternatives rejetées.

C'est essentiel parce que :
- Dans 6 mois, personne ne se souviendra **pourquoi** une décision a été prise
- Sans ADR, l'équipe remet en question des décisions déjà validées (coût cognitif)
- Les ADR capturent non seulement la décision mais les **alternatives considérées et rejetées**, ce qui évite de répéter les mêmes débats
</details>

---

## Analogie — Le chef cuisinier vs le commis

Dans une cuisine professionnelle, il y a deux rôles très différents :

**Le commis** reçoit des instructions précises : "Coupe 500g d'oignons en brunoise, fais revenir à feu moyen pendant 8 minutes." Il exécute. Il ne se demandé pas pourquoi on utilise des oignons plutôt que des échalotes, ni si le plat serait meilleur avec une cuisson différente. Il fait ce qu'on lui dit, bien et vite.

**Le chef cuisinier** raisonne différemment : "Le client veut un plat réconfortant pour l'hiver, avec un budget de 12 euros par assiette, livrable en 15 minutes maximum. Quels ingrédients ? Quelle technique de cuisson ? Quel compromis entre coût et qualité ? Est-ce qu'on peut préparer une base à l'avance ?"

```
LE COMMIS (executant)              LE CHEF (decideur)
────────────────────────           ────────────────────────────────
Recoit une spec precise            Recoit un probleme flou
Execute sans questionner           Pose des questions avant d'agir
Mesure : "Est-ce que c'est fait ?" Mesure : "Est-ce le bon choix ?"
Valeur : vitesse d'execution       Valeur : qualite des decisions
Risque : aucun (suit les ordres)   Risque : assume ses choix

DEVELOPEUR (executant)             ARCHITECTE (decideur)
────────────────────────           ────────────────────────────────
"On m'a dit d'utiliser Redux"      "Quel probleme de state a-t-on ?"
"Le ticket dit API REST"           "REST, GraphQL, ou gRPC ici ?"
"Je code la feature"               "Faut-il vraiment cette feature ?"
"Ca marche sur ma machine"         "Ca tiendra avec 10 000 users ?"
```

La transition de commis à chef ne se fait pas du jour au lendemain. Personne ne te demandera de tout décider demain. Mais chaque fois que tu te poses la question **"pourquoi ?"** au lieu de juste **"comment ?"**, tu avances d'un cran.

---

## Théorie

### 1. Les 4 niveaux de maturité architecturale

La transition d'exécutant à architecte n'est pas un saut — c'est une progression. Voici les quatre niveaux, avec des indicateurs concrets pour savoir où tu en es.

```
NIVEAU 4 : ARCHITECTE
  "Je fais des arbitrages avec impact business"
  ┌──────────────────────────────────────────────────────┐
  │ - Participe aux decisions produit                    │
  │ - Traduit les contraintes business en choix tech     │
  │ - Anticipe les evolutions a 6-12 mois                │
  │ - Documente les decisions (ADR)                      │
  │ - Influence la roadmap technique                     │
  └──────────────────────────────────────────────────────┘
           ▲
NIVEAU 3 : CONCEPTEUR
  "Je concois des solutions a des problemes flous"
  ┌──────────────────────────────────────────────────────┐
  │ - Propose des architectures pour de nouvelles features│
  │ - Compare des approches avec des trade-offs          │
  │ - Identifie les risques techniques en amont          │
  │ - Redige des specs techniques                        │
  └──────────────────────────────────────────────────────┘
           ▲
NIVEAU 2 : CONTRIBUTEUR
  "Je propose des ameliorations techniques"
  ┌──────────────────────────────────────────────────────┐
  │ - Propose des refactorings pertinents en code review │
  │ - Identifie la dette technique                       │
  │ - Suggere des alternatives ("Et si on utilisait X ?")│
  │ - Comprend le "pourquoi" derriere les choix existants│
  └──────────────────────────────────────────────────────┘
           ▲
NIVEAU 1 : EXECUTANT
  "Je code ce qu'on me dit"
  ┌──────────────────────────────────────────────────────┐
  │ - Implemente les tickets tels quels                  │
  │ - Suit les conventions sans les questionner           │
  │ - Demande "comment faire ?" mais pas "pourquoi ?"    │
  │ - Se concentre sur la syntaxe et les frameworks      │
  └──────────────────────────────────────────────────────┘
```

**Où tu en es probablement** : si tu es développeur frontend React et que tu lis ce cours, tu es quelque part entre le niveau 1 et le niveau 2. C'est **exactement** là où il faut être pour progresser. L'objectif de cette formation, c'est de t'amener au niveau 3 — et de te donner les outils pour atteindre le niveau 4 avec l'expérience.

**Comment progresser concrètement** :

```typescript
// Niveau 1 — Tu recois un ticket : "Ajouter un bouton de suppression"
// Tu codes le bouton. Point.

// Niveau 2 — Tu te demandes :
// "Est-ce qu'on a une confirmation avant suppression ?"
// "Est-ce qu'il faut un soft delete ou un hard delete ?"

// Niveau 3 — Tu te demandes :
// "Quelles sont les consequences d'une suppression sur les entites liees ?"
// "Faut-il un systeme de corbeille avec restauration ?"
// "Quel est l'impact sur les utilisateurs qui ont un lien vers cet element ?"

// Niveau 4 — Tu te demandes :
// "La suppression est-elle compatible avec nos obligations RGPD ?"
// "Quel est le cout de maintenance d'un soft delete vs la valeur metier ?"
// "Est-ce qu'on a des metriques sur la frequence de suppression accidentelle ?"
```

---

### 2. Le syndrome de l'imposteur en architecture

Si tu lis ce cours et que tu te dis "je ne suis pas légitime pour prendre des décisions d'architecture", sache que c'est **le sentiment le plus répandu** dans la profession. Même les architectes seniors l'ont.

**Pourquoi c'est particulièrement fort en architecture** :

```
SYNDROME DE L'IMPOSTEUR — pourquoi l'architecture l'amplifie
────────────────────────────────────────────────────────────────

En developpement :                 En architecture :
"Mon code compile et les          "Ma decision est-elle la bonne ?
 tests passent → je suis           On ne le saura que dans 6 mois."
 competent."

Feedback : immediat (CI verte)    Feedback : tres retarde
Validation : objective (tests)    Validation : subjective (opinions)
Erreur : visible et corrigeable   Erreur : couteuse et diffuse
Scope : un fichier, une feature   Scope : tout le systeme
```

**Les 5 antidotes concrets** :

1. **Accepte l'incertitude** — une bonne décision d'architecture n'est pas une décision parfaite. C'est une décision dont les risques sont identifiés et acceptés. Même les architectes seniors disent "ça dépend" et "je ne sais pas encore".

2. **Documente tes raisonnements** — écrire un ADR te force à structurer ta pensée. Même si ta conclusion est fausse, le raisonnement est valuable. Un junior qui écrit "j'ai choisi X parce que Y, en acceptant le risque Z" est plus crédible qu'un senior qui dit "fais-moi confiance".

3. **Pose des questions, pas des affirmations** — au lieu de dire "il faut utiliser Redux", demandé "quel problème de state management avons-nous exactement ?". Les questions sont toujours légitimes, les affirmations peuvent être contestées.

4. **Compare-toi a toi d'il y a 6 mois** — pas au tech lead qui a 15 ans d'experience. La progression est personnelle.

5. **Commence petit** — tu n'as pas besoin de concevoir un système distribué demain. Commence par proposer un refactoring en code review, puis une alternative technique dans un daily, puis une spec technique pour une feature.

```typescript
// Voici un exemple de "premiere decision d'architecture"
// accessible a un developpeur frontend React :

// AVANT (pas de decision — tu subis)
// Le composant fait tout : fetch, logique, affichage, gestion d'erreur
function UserProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/users/me')
      .then(res => res.json())
      .then(data => setUser(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} />;
  return <div>{user?.name}</div>;
}

// APRES (tu prends une decision d'architecture)
// Decision : separer le data fetching de la presentation
// Raison : testabilite (on peut tester le rendu sans reseau)
// Trade-off : un fichier de plus, mais composant pur et testable

// Hook dedie au data fetching
function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/users/me')
      .then(res => res.json())
      .then(data => setUser(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading, error };
}

// Composant pur — ne sait pas d'ou viennent les donnees
function UserProfile() {
  const { user, loading, error } = useCurrentUser();

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} />;
  return <div>{user?.name}</div>;
}

// Ca, c'est deja une decision d'architecture de niveau 2.
// Tu ne "codes plus ce qu'on te dit" — tu structures le code
// selon un raisonnement explicite.
```

---

### 3. Penser en trade-offs, pas en solutions

C'est **le changement de mindset le plus important** de toute cette formation. Un exécutant cherche **la** solution. Un architecte cherche **les** solutions, compare leurs trade-offs, et choisit celle dont les compromis sont les plus acceptables dans le contexte donné.

**La règle d'or : toute réponse architecturale commence par "ça dépend".**

```
QUESTION                              REPONSE D'EXECUTANT    REPONSE D'ARCHITECTE
─────────────────────────────────────────────────────────────────────────────────────
"On prend REST ou GraphQL ?"          "GraphQL, c'est        "Ca depend. Combien de
                                       plus moderne"          clients differents ?
                                                              Quelle complexite des
                                                              queries ? Quel niveau
                                                              de caching requis ?"

"Redux ou Zustand ?"                  "Zustand, c'est        "Ca depend. Quelle taille
                                       plus simple"           d'etat ? Combien de devs ?
                                                              Besoin de devtools ?
                                                              Middleware ? Persistence ?"

"Monolithe ou microservices ?"        "Microservices,        "Ca depend. Taille de
                                       ca scale"              l'equipe ? Budget ops ?
                                                              Besoin de deploiement
                                                              independant ?"

"SQL ou NoSQL ?"                      "NoSQL, c'est          "Ca depend. Relations entre
                                       flexible"              les donnees ? Patterns de
                                                              lecture ? Besoin de
                                                              transactions ACID ?"
```

**Concrètement, voici comment structurer un trade-off** :

```typescript
// Exemple : choisir entre Server-Side Rendering (SSR) et
// Static Site Generation (SSG) pour un site e-commerce

interface TradeOffOption {
  name: string;
  advantages: string[];
  disadvantages: string[];
  bestWhen: string[];
  costOfReversal: 'faible' | 'moyen' | 'eleve';
}

const ssrOption: TradeOffOption = {
  name: 'Server-Side Rendering (SSR)',
  advantages: [
    'Contenu toujours a jour (pas de rebuild)',
    'Bon pour le SEO avec du contenu dynamique',
    'Personnalisation par utilisateur possible',
  ],
  disadvantages: [
    'Serveur necessaire (cout + maintenance)',
    'Temps de reponse depend du serveur (TTFB plus eleve)',
    'Scaling horizontal requis si trafic eleve',
  ],
  bestWhen: [
    'Contenu change frequemment (prix, stock)',
    'Personnalisation par utilisateur',
    'Donnees en temps reel',
  ],
  costOfReversal: 'moyen',
};

const ssgOption: TradeOffOption = {
  name: 'Static Site Generation (SSG)',
  advantages: [
    'Performance maximale (fichiers statiques sur CDN)',
    'Pas de serveur a maintenir',
    'Securite renforcee (pas de serveur attaquable)',
  ],
  disadvantages: [
    'Rebuild necessaire a chaque changement de contenu',
    'Temps de build croit avec le nombre de pages',
    'Pas de personnalisation sans JavaScript cote client',
  ],
  bestWhen: [
    'Contenu change rarement (blog, documentation)',
    'Performance critique (Core Web Vitals)',
    'Budget infrastructure limite',
  ],
  costOfReversal: 'moyen',
};

// La decision pour un e-commerce avec 50 000 produits
// dont les prix changent toutes les heures :
// → SSR, parce que le contenu est trop dynamique pour du SSG
// → Trade-off accepte : cout serveur + complexite ops
// → Mitigation : cache CDN de 5 minutes pour les pages catalogue
```

**Le réflexe à développer** : chaque fois que quelqu'un te propose UNE solution, demandé-toi immédiatement "quelle est l'alternative, et quels sont les trade-offs de chacune ?"

---

### 4. Le framework de décision RAPID

Quand plusieurs personnes sont impliquées dans une décision technique, les choses deviennent floues rapidement. Qui décide ? Qui doit être consulté ? Qui exécute ? Le framework **RAPID** (créé par Bain & Company) clarifie les rôles.

```
FRAMEWORK RAPID — Qui fait quoi dans une decision
──────────────────────────────────────────────────────────────────

R — RECOMMEND (Recommander)
    Qui : Le developpeur ou l'architecte qui a etudie le sujet
    Quoi : Prepare l'analyse, les options, les trade-offs
    Exemple : "J'ai analyse 3 options de state management,
              voici ma recommandation avec les trade-offs"

A — AGREE (Valider)
    Qui : Les personnes qui doivent valider (tech lead, securite, ops)
    Quoi : Donnent leur accord ou leur veto argumente
    Exemple : "L'equipe ops valide que l'option choisie est
              deployable avec notre infra actuelle"

P — PERFORM (Executer)
    Qui : L'equipe qui va implementer la decision
    Quoi : Implemente et livre
    Exemple : "L'equipe frontend implemente la migration
              vers la nouvelle solution de state management"

I — INPUT (Contribuer)
    Qui : Les personnes consultees pour leur expertise
    Quoi : Fournissent des informations, pas des decisions
    Exemple : "L'equipe mobile nous dit si l'API doit etre
              compatible avec leur client"

D — DECIDE (Decider)
    Qui : Une seule personne qui tranche
    Quoi : Prend la decision finale en cas de desaccord
    Exemple : "Le CTO tranche : on part sur l'option B
              malgre le desaccord de l'equipe ops"
```

**Quand utiliser RAPID** :

```
UTILISER RAPID QUAND :                   NE PAS UTILISER QUAND :
─────────────────────────────────        ──────────────────────────────────
Decision impacte plusieurs equipes       Decision locale a un composant
Cout de reversal eleve                   Facilement reversible
Desaccord technique entre personnes      Consensus naturel
Decision structurante (archi, stack)     Choix d'implementation detail
```

**Exemple concret appliqué à un projet React** :

```typescript
// Situation : l'equipe doit choisir entre Next.js App Router et
// Pages Router pour un nouveau projet e-commerce

// R (Recommend) — Toi, le dev frontend :
interface Recommendation {
  author: string;
  date: string;
  decision: string;
  options: Array<{
    name: string;
    score: Record<string, number>; // 1-5
    recommendation: 'recommande' | 'acceptable' | 'deconseille';
  }>;
  finalRecommendation: string;
  risks: string[];
}

const myRecommendation: Recommendation = {
  author: 'moi (dev frontend)',
  date: '2025-10-01',
  decision: 'Choix du routing strategy pour le projet e-commerce',
  options: [
    {
      name: 'App Router (RSC)',
      score: {
        'Performance': 5,
        'Courbe apprentissage equipe': 2, // l'equipe ne connait pas les RSC
        'Ecosysteme bibliotheques': 3,
        'Stabilite': 3,
      },
      recommendation: 'recommande',
    },
    {
      name: 'Pages Router (classique)',
      score: {
        'Performance': 3,
        'Courbe apprentissage equipe': 5, // tout le monde connait
        'Ecosysteme bibliotheques': 5,
        'Stabilite': 5,
      },
      recommendation: 'acceptable',
    },
  ],
  finalRecommendation: 'App Router — les gains de performance justifient '
    + 'l\'investissement en formation, et le projet est prevu pour 2+ ans',
  risks: [
    'Courbe d\'apprentissage de 2-3 semaines pour l\'equipe',
    'Certaines bibliotheques ne supportent pas encore les RSC',
  ],
};

// A (Agree) — Le tech lead valide, l'equipe ops confirme
//             la compatibilite avec le deployment pipeline

// P (Perform) — L'equipe frontend implemente

// I (Input) — L'equipe backend donne ses contraintes sur l'API,
//             l'equipe design confirme les besoins de SSR pour le SEO

// D (Decide) — Le tech lead tranche si desaccord
```

---

### 5. Les questions qu'un architecte se pose

Voici la **checklist mentale** qu'un architecte parcourt avant chaque décision importante. L'objectif n'est pas de répondre à toutes ces questions à chaque fois — c'est de développer le **réflexe** de les poser.

```
CHECKLIST DE L'ARCHITECTE
══════════════════════════════════════════════════════════════════

RESILIENCE
  □ Que se passe-t-il si ce composant tombe ?
  □ Y a-t-il un single point of failure ?
  □ Quel est le plan de recovery ?

SCALABILITE
  □ Combien d'utilisateurs simultanes doit-on supporter ?
  □ Quel est le pattern de trafic (constant, pics, saisonnier) ?
  □ Qu'est-ce qui va croitre le plus vite (donnees, users, features) ?

REVERSIBILITE
  □ Quel est le cout de revenir en arriere sur cette decision ?
  □ Peut-on faire un test A/B ou un feature flag ?
  □ Cette decision est-elle une "porte a sens unique" ou "a double sens" ?

IMPACT
  □ Qui sera impacte si on change ca ? (equipes, users, systemes)
  □ Quels systemes en amont et en aval dependent de ce composant ?
  □ Quel est l'impact sur les performances globales ?

NECESSITE
  □ Est-ce qu'on a vraiment besoin de ca maintenant ?
  □ Quel probleme concret ca resout (pas un probleme hypothetique) ?
  □ Peut-on faire plus simple pour commencer (MVP architectural) ?

COUT
  □ Combien ca coute a developper ? A maintenir ? A operer ?
  □ Quel est le cout en complexite pour l'equipe ?
  □ Le cout de ne rien faire est-il superieur au cout d'agir ?

SECURITE
  □ Quelles donnees sensibles transitent par ce composant ?
  □ Qui a acces ? Qui ne devrait pas avoir acces ?
  □ Que se passe-t-il si ces donnees fuitent ?
```

**Exercice de réflexe** — applique cette checklist à une situation quotidienne :

```typescript
// Situation : on te demande d'ajouter un cache Redis pour
// les donnees utilisateur afin d'accelerer le dashboard

// Un executant repond : "OK, j'installe Redis et je cache les users"

// Un architecte pose ces questions :

// RESILIENCE
// → Que se passe-t-il si Redis tombe ?
//   Le dashboard doit-il fonctionner sans cache (fallback DB) ?

// SCALABILITE
// → Combien d'utilisateurs ? 100 ? 100 000 ?
//   Pour 100 users, un cache in-memory suffit.
//   Redis est du over-engineering.

// REVERSIBILITE
// → Si Redis pose des problemes, peut-on facilement revenir
//   a une solution sans cache ?
//   Oui, si on utilise une interface CacheProvider.

// NECESSITE
// → Le dashboard est-il vraiment lent ? Mesures ?
//   Si le P95 est deja a 50ms, le cache n'apporte rien.
//   "Premature optimization is the root of all evil" — Knuth

// COUT
// → Redis = serveur supplementaire = cout infra + monitoring + ops.
//   Pour 100 users, le rapport cout/benefice est negatif.

interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  invalidate(key: string): Promise<void>;
}

// Grace a l'interface, on peut commencer avec un cache in-memory
// et migrer vers Redis plus tard SI les metriques le justifient
class InMemoryCacheProvider implements CacheProvider {
  private store = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async invalidate(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// Decision architecturale :
// "On commence avec InMemoryCacheProvider.
//  On migrera vers RedisCacheProvider quand les metriques
//  montreront un P95 > 200ms sur le dashboard."
//
// → C'est une decision de niveau 3 (Concepteur).
```

---

### 6. L'art de dire "ça dépend" avec substance

"Ça dépend" est la réponse la plus honnête en architecture — mais dit seul, ça donne l'impression que tu ne sais pas. L'art, c'est de **dire "ça dépend" suivi des axes de décision concrets**.

**La formule** :

```
"Ca depend" + [de quoi ca depend] + [voici les options selon le contexte]
```

**Exemples** :

```
MAUVAIS : "On devrait utiliser des microservices ? — Ca depend."
          (vide, pas actionnable, impression d'incompetence)

BON :     "Ca depend de trois facteurs :
           1. La taille de l'equipe — en dessous de 8-10 devs,
              un monolithe modulaire est presque toujours preferable
           2. Le besoin de deploiement independant — si les modules
              ont des cycles de release differents, ca plaide pour
              les microservices
           3. Le budget ops — les microservices coutent 3-5x plus cher
              a operer (monitoring, networking, debugging distribue)

           Dans notre cas, avec 4 devs et pas de besoin de deploy
           independant, je recommande un monolithe modulaire
           avec des frontieres claires entre les modules."
```

**Comment présenter un trade-off à un non-technique (PM, PO, client)** :

```
STRUCTURE DE PRESENTATION
──────────────────────────────────────────────────────────

1. CONTEXTE (30 secondes)
   "On doit choisir comment gerer l'authentification"

2. OPTIONS (1 minute)
   "Option A : solution maison — 3 semaines de dev,
    controle total, mais responsabilite de la securite
    Option B : Auth0 — 3 jours d'integration,
    securite geree par un tiers, mais 0.05€/user/mois"

3. MA RECOMMANDATION (30 secondes)
   "Je recommande Auth0 parce que la securite n'est pas
    notre coeur de metier et le cout est acceptable"

4. CE QU'ON PERD (important — ca montre ta maturite)
   "En contrepartie, on depend d'un tiers et on a moins
    de controle sur les flux d'authentification custom"

5. DECISION DEMANDEE
   "Est-ce qu'on accepte ce trade-off ?"
```

**En TypeScript, ça se traduit par des types explicites pour les décisions** :

```typescript
interface ArchitecturalDecision {
  question: string;
  dependsOn: string[];
  options: Array<{
    name: string;
    ifContext: string;  // "Si [condition], alors cette option"
    tradeOff: string;   // "On gagne X mais on perd Y"
  }>;
  recommendation: string;
  reversibility: 'facile' | 'moderee' | 'difficile';
}

const authDecision: ArchitecturalDecision = {
  question: 'Comment gerer l\'authentification utilisateur ?',
  dependsOn: [
    'Budget disponible pour un service tiers',
    'Besoin de flux d\'auth custom (SSO entreprise, MFA specifique)',
    'Expertise securite dans l\'equipe',
    'Nombre d\'utilisateurs prevu',
  ],
  options: [
    {
      name: 'Auth0 / Clerk (SaaS)',
      ifContext: 'Si pas de besoin custom et budget > 0',
      tradeOff: 'On gagne du temps et de la securite, '
        + 'mais on depend d\'un tiers et on perd en flexibilite',
    },
    {
      name: 'NextAuth.js / Lucia (self-hosted)',
      ifContext: 'Si besoin de controle et equipe competente en securite',
      tradeOff: 'On gagne en controle et on elimine la dependance, '
        + 'mais on assume la responsabilite de la securite',
    },
    {
      name: 'Solution maison (JWT + bcrypt)',
      ifContext: 'Si besoin tres specifique et expertise securite solide',
      tradeOff: 'Controle total, mais risque eleve de failles '
        + 'si l\'equipe n\'est pas experte en securite',
    },
  ],
  recommendation: 'Auth0 pour un projet standard, '
    + 'NextAuth pour un projet avec des besoins specifiques',
  reversibility: 'difficile', // changer de systeme d'auth est toujours couteux
};
```

---

### 7. Construire sa crédibilité progressivement

La crédibilité ne se décrète pas — elle se construit action par action. Voici un plan concret pour un développeur frontend qui veut être pris au sérieux sur les sujets d'architecture.

```
PLAN DE CONSTRUCTION DE CREDIBILITE — 6 mois
══════════════════════════════════════════════════════════════════

MOIS 1-2 : OBSERVER ET QUESTIONNER
  □ Lis les ADR existants du projet (s'il y en a)
  □ Pose des questions en code review : "Pourquoi ce choix ?"
  □ Note les patterns recurrents dans le codebase
  □ Commence un journal de decisions (meme personnel)
  □ Lis 1 article d'architecture par semaine

MOIS 3-4 : PROPOSER DES AMELIORATIONS
  □ Propose un refactoring en code review avec le "pourquoi"
  □ Redige ton premier ADR (meme pour une petite decision)
  □ Presente un trade-off en daily/weekly ("J'ai compare X et Y")
  □ Identifie une dette technique et propose un plan
  □ Mesure quelque chose (performance, bundle size, couverture)

MOIS 5-6 : CONCEVOIR
  □ Propose l'architecture d'une nouvelle feature
  □ Anime une session de design review
  □ Redige une spec technique complete
  □ Mentore un dev junior sur un choix technique
  □ Presente un retour d'experience technique a l'equipe
```

**Les 5 habitudes qui accélèrent la progression** :

1. **Écris tes raisonnements** — même dans un fichier personnel. Le simple fait d'écrire "j'ai choisi X parce que Y" structure ta pensée et te force à expliciter tes hypothèses.

2. **Lis du code open source** — pas pour le copier, mais pour comprendre les décisions. Pourquoi React utilise un Virtual DOM ? Pourquoi NestJS a choisi les décorateurs ? Pourquoi Zustand n'a pas de boilerplate ?

3. **Dessine avant de coder** — un schéma sur papier, un diagramme ASCII, un schéma de flux. Visualiser l'architecture avant de coder révèle des problèmes invisibles dans le code.

4. **Cherche les contraintes, pas les solutions** — quand on te donne un problème, commence par lister les contraintes (budget, délai, taille d'équipe, compétences, legacy). Les contraintes éliminent des options et guident vers la bonne décision.

5. **Demande des feedbacks sur tes décisions** — pas sur ton code, sur tes **décisions**. "J'ai choisi de séparer le state en deux stores. Est-ce que tu aurais fait pareil ? Pourquoi ?"

---

## Pratique

### Kata de décision — Template

Utilise ce template pour t'entraîner à structurer tes raisonnements architecturaux. L'objectif est de développer le réflexe : **problème → contraintes → options → trade-offs → décision → conséquences**.

```typescript
// ============================================================
// TEMPLATE DE KATA DE DECISION ARCHITECTURALE
// ============================================================

interface DecisionKata {
  // 1. Definir le probleme
  problem: string;

  // 2. Identifier les contraintes
  constraints: Array<{
    name: string;
    description: string;
    isNegotiable: boolean; // peut-on assouplir cette contrainte ?
  }>;

  // 3. Lister les options
  options: Array<{
    name: string;
    description: string;
    pros: string[];
    cons: string[];
    effort: 'faible' | 'moyen' | 'eleve';
    risk: 'faible' | 'moyen' | 'eleve';
  }>;

  // 4. Choisir et justifier
  decision: {
    chosenOption: string;
    reasoning: string;      // POURQUOI cette option
    acceptedTradeOffs: string[]; // Ce qu'on perd consciemment
    mitigations: string[];  // Comment on reduit les risques
  };

  // 5. Prevoir les consequences
  consequences: {
    immediate: string[];    // Ce qui change maintenant
    longTerm: string[];     // Ce qui changera dans 6-12 mois
    reviewDate: string;     // Quand re-evaluer cette decision
  };
}
```

### Exercice — Analyse d'un scénario réel

**Contexte** : Tu es développeur frontend dans une équipe de 5 personnes. Vous construisez un back-office React pour gérer des commandes e-commerce. Le product owner vient te voir :

> "Les utilisateurs se plaignent que le tableau de commandes est lent. Il met 4 secondes à charger quand il y a plus de 1 000 commandes. On a besoin que ça charge en moins d'une seconde. Tu peux régler ça ?"

**Ta mission** : remplis le template `DecisionKata` ci-dessus pour ce scénario.

Voici des pistes pour t'aider à structurer ta réflexion :

```typescript
// ============================================================
// EXERCICE — A toi de jouer
// ============================================================

// Etape 1 : Ne te precipite pas sur une solution.
// Pose-toi d'abord ces questions :
//
// - Pourquoi c'est lent ? (reseau ? rendu ? requete SQL ?)
// - 1 000 commandes, c'est le cas courant ou un edge case ?
// - "Moins d'une seconde" = temps percu ou temps reel ?
// - Qui utilise ce tableau ? (frequence, contexte, device)
// - Combien de commandes dans 6 mois ? 12 mois ?

// Etape 2 : Identifie les options possibles
// (en voici quelques-unes — il y en a d'autres)
//
// Option A : Pagination serveur (limit/offset)
//   + Simple a implementer
//   + Reduit immediatement la charge
//   - Change l'UX (l'utilisateur ne voit plus tout d'un coup)
//
// Option B : Virtualisation du tableau (react-virtualized / TanStack Virtual)
//   + L'utilisateur garde l'impression de "tout voir"
//   + Pas de changement cote API
//   - Complexite front supplementaire
//   - Ne resout pas le probleme si la requete API est lente
//
// Option C : Pagination + filtres + tri cote serveur
//   + Solution complete et scalable
//   + Meilleure UX (l'utilisateur cherche, il ne scrolle pas)
//   - Plus d'effort (front + back)
//   - Necessite des index en base de donnees
//
// Option D : Cache API (React Query / SWR avec stale-while-revalidate)
//   + Chargement instantane apres la premiere visite
//   + Peu de changement de code
//   - Ne resout pas le premier chargement
//   - Donnees potentiellement obsoletes

// Etape 3 : Choisis une option et justifie ton trade-off.
// Il n'y a pas de "bonne reponse" — il y a des reponses
// bien argumentees et des reponses non argumentees.

// Etape 4 : Redige un mini-ADR de 10 lignes pour ta decision.
// Structure : Contexte (2 lignes) → Decision (1 ligne) →
//             Consequences positives (2-3) → Consequences negatives (2-3)
```

---

## Résumé

- La transition d'exécutant à architecte passe par **4 niveaux de maturité** : exécutant (je code ce qu'on me dit), contributeur (je propose des améliorations), concepteur (je conçois des solutions), architecte (je fais des arbitrages business). Tu n'as pas besoin d'être au niveau 4 demain — chaque question "pourquoi ?" te fait monter d'un cran.

- Le **syndrome de l'imposteur** est universel en architecture parce que le feedback est retardé et subjectif (contrairement au code ou les tests passent ou non). Les antidotes : accepte l'incertitude, documente tes raisonnements, pose des questions plutôt que des affirmations, et commence petit.

- **Penser en trade-offs** est le changement de mindset fondamental : il n'y a jamais UNE bonne solution, il y a des solutions dont les compromis sont mieux adaptés au contexte. Toute réponse architecturale commence par "ça dépend de..." suivi des axes de décision concrets.

- Le framework **RAPID** (Recommend, Agree, Perform, Input, Decide) clarifie les rôles dans une décision collective. L'erreur la plus courante : tout le monde donne son avis, personne ne décide — ou pire, quelqu'un décide sans consulter les personnes impactées.

- La crédibilité se construit **progressivement** : observer et questionner (mois 1-2), proposer des améliorations avec un "pourquoi" (mois 3-4), concevoir des solutions complètes (mois 5-6). L'habitude la plus puissante : écrire tes raisonnements, même dans un fichier personnel.

---

> **Lien fil rouge — ShopArch**
>
> - Identifie ton niveau de maturité actuel sur l'échelle 1-4 et note 3 actions concrètes pour atteindre le niveau suivant
> - Remplis le template `DecisionKata` pour un choix technique de ShopArch (ex : "Comment gérer le panier : state local, context, ou store global ?")
> - Rédige un ADR en utilisant le framework RAPID pour le choix du framework CSS de ShopArch (Tailwind vs CSS Modules vs styled-components)
> - Exercice(s) associé(s) : `exercices/05-posture-architecte/`
> - Checkpoint : Module 00, critère 5

## Prochain cours

[Module 01 — Cours 01 : Architecture en couches](../01-patterns-architecturaux/01-architecture-en-couches.md)

> Tu as maintenant les outils mentaux pour raisonner en architecte : les niveaux de maturité, les trade-offs, le framework RAPID, et la checklist de questions. Dans le module 01, nous allons appliquer cette posture aux patterns architecturaux classiques, en commençant par l'architecture en couches (Layered Architecture) — le pattern le plus répandu, celui que tu utilises probablement déjà sans le savoir.
