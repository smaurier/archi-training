# Cours 85 — MLOps & AI Systems Architecture

> **Objectif** : Comprendre le pipeline ML (data → features → training → serving → monitoring), maîtriser le model versioning, intégrer l'IA dans une application web, et comprendre les contraintes reglementaires (EU AI Act).

---

## Rappel du cours précédent

<details>
<summary>1. Pourquoi l'offline-first est obligatoire en mobile ?</summary>

Le réseau mobile est **intermittent** (metro, avion, zone blanche). L'application doit fonctionner sans connexion : opérations executees localement d'abord, mutations mises en queue, sync quand le réseau revient. Sans offline-first, l'app est inutilisable dans les scénarios les plus courants.
</details>

<details>
<summary>2. Qu'est-ce que le delta sync et pourquoi est-il critique en mobile ?</summary>

Au lieu de telecharger tous les produits à chaque ouverture (`GET /products` → 20MB), le delta sync envoie `GET /products?since=timestamp` et ne récupéré que les éléments modifies depuis le dernier sync (~100KB). Economise la bande passante, la batterie, et le temps de chargement.
</details>

---

## Analogie — Le chef cuisinier et ses recettes

Un chef cuisinier (ML engineer) :
- **Teste des recettes** (modèles) avec des **ingredients** (données)
- **Documente chaque version** de la recette (model versioning)
- Fait des **tests aveugles** avec des clients (A/B testing champion/challenger)
- Le restaurant (production) ne sert que les **recettes validees**
- Si une recette rend un client malade → **rollback** vers la version précédente

Le MLOps est le processus qui va du labo du chef (training) au service en salle (inference) avec qualité et traçabilité.

---

## Théorie

### 1. ML Pipeline

```
Data ──> Features ──> Training ──> Evaluation ──> Serving ──> Monitoring
 │          │            │             │             │            │
 │     Feature       Model          Metrics       Model        Data
 │     Store        Registry       (accuracy,    Serving      Drift
 │    (offline +    (MLflow)       precision)   (batch/       Alerting
 │     online)                                   realtime)
 │
 Data Validation
 (schema, stats)
```

### 2. Feature stores

```
PROBLEME : les features calculees en training ≠ features en serving
  Training : feature calculee sur un DataFrame Pandas (offline)
  Serving : feature calculee a la volee (online)
  → Skew training/serving → predictions fausses

SOLUTION : Feature Store
  - Definir les features UNE fois
  - Calculees offline (training) ET online (serving)
  - Meme logique, meme resultat
  Outils : Feast, Tecton, AWS SageMaker Feature Store
```

### 3. Model versioning & registry

```
Model Registry (MLflow / Weights & Biases) :
┌───────────────────────────────────────────┐
│  Model: product-recommender               │
│                                           │
│  v1.0 (2024-01) : accuracy 0.82          │
│  v1.1 (2024-03) : accuracy 0.85 ← prod  │
│  v2.0 (2024-06) : accuracy 0.87 ← canary│
│                                           │
│  Metadata :                               │
│    training_data: s3://data/2024-03/      │
│    hyperparams: { lr: 0.001, epochs: 50 } │
│    metrics: { accuracy: 0.85, f1: 0.83 }  │
│    training_time: 2h34min                 │
│    model_size: 150MB                      │
└───────────────────────────────────────────┘
```

### 4. A/B testing ML (Champion/Challenger)

```
Champion (v1.1) ──── 90% du trafic ──> Users
Challenger (v2.0) ── 10% du trafic ──> Users

Metriques comparees :
  - Click-through rate (recommandations)
  - Conversion rate
  - Latence inference
  - Revenue per session

Si challenger > champion sur toutes les metriques → promote
Si challenger < champion → rollback
```

### 5. Model serving patterns

| Pattern | Latence | Quand |
|---|---|---|
| **Batch** | Minutes-heures | Recommandations nightly, rapports |
| **Real-time** (API) | < 100ms | Recherche, auto-complete |
| **Edge** | < 10ms | Filtres camera, détection locale |
| **Streaming** | Continues | Fraud détection, anomaly détection |

### 6. Intégration web

```
Cas d'usage IA dans une app web :
  - Recherche semantique (embeddings → vector search)
  - Recommandations produits (collaborative filtering)
  - Traductions AI (LLM fine-tuned, human-correctable)
  - Classification de contenu (moderation, tagging)
  - Auto-complete / suggestions (search-as-you-type)

Architecture :
  Client → API → AI Service (inference) → Response
                      ↓
                 Model Registry (version actuelle)
                      ↓
                 Feature Store (features calculees)
```

### 7. EU AI Act

| Risque | Exemples | Obligations |
|---|---|---|
| **Inacceptable** | Scoring social, manipulation | Interdit |
| **Haut risque** | Recrutement, credit scoring, medical | Audit, transparence, explainability |
| **Risque limite** | Chatbot, deepfake | Informer l'utilisateur que c'est de l'IA |
| **Risque minimal** | Spam filter, recommandations | Pas d'obligations spécifiques |

```
Risk register :
  { feature: "product-recommendations", risk: "minimal", justification: "..." }
  { feature: "content-moderation", risk: "limited", justification: "..." }
  { feature: "auto-translation", risk: "limited", justification: "..." }
```

---

## Pratique

### ML model serving API

```typescript
@Controller('api/recommendations')
export class RecommendationController {
  constructor(
    private readonly modelService: ModelServingService,
    private readonly featureStore: FeatureStore,
  ) {}

  @Get(':userId')
  async getRecommendations(
    @Param('userId') userId: string,
    @Query('limit') limit: number = 10,
  ): Promise<ProductRecommendation[]> {
    // 1. Recuperer les features utilisateur
    const features = await this.featureStore.getOnlineFeatures(userId, [
      'recent_views',
      'purchase_history',
      'preferred_categories',
    ]);

    // 2. Inference via le modele
    const predictions = await this.modelService.predict(
      'product-recommender',
      features,
      { topK: limit },
    );

    // 3. Log pour monitoring (drift detection)
    await this.logPrediction(userId, predictions);

    return predictions;
  }
}

@Injectable()
export class ModelServingService {
  async predict(
    modelName: string,
    features: Record<string, unknown>,
    options: { topK: number },
  ): Promise<ProductRecommendation[]> {
    // Appel au service d'inference (TensorFlow Serving, Triton, ou API LLM)
    const response = await fetch(`${process.env.ML_SERVING_URL}/predict`, {
      method: 'POST',
      body: JSON.stringify({
        model: modelName,
        features,
        top_k: options.topK,
      }),
    });

    return response.json();
  }
}
```

### AI quality testing

```typescript
// tests/ai/translation-quality.test.ts
import { describe, it, expect } from 'vitest';

describe('Translation quality baseline', () => {
  const testCases = [
    { input: 'Bonjour le monde', expected: 'Hello world', lang: 'en' },
    { input: 'Ajouter au panier', expected: 'Add to cart', lang: 'en' },
  ];

  it('BLEU score above baseline', async () => {
    const translations = await Promise.all(
      testCases.map((tc) =>
        translationService.translate(tc.input, 'fr', tc.lang),
      ),
    );

    const bleuScore = calculateBLEU(
      translations,
      testCases.map((tc) => tc.expected),
    );

    expect(bleuScore).toBeGreaterThan(0.7); // Baseline
  });

  it('no regression vs previous model', async () => {
    const currentScore = await evaluateModel('v2.0');
    const previousScore = await evaluateModel('v1.1');

    // Le nouveau modele ne doit pas etre pire
    expect(currentScore).toBeGreaterThanOrEqual(previousScore * 0.95);
  });
});
```

---

## Résumé

1. **ML Pipeline** : data → features → training → évaluation → serving → monitoring — chaque étape est automatisee et versionnee
2. **Feature Store** : memes features en training et serving — évité le training/serving skew
3. **Model Registry** : versionner les modèles avec metadata (hyperparams, metrics, data) — rollback possible
4. **Champion/Challenger** : A/B testing ML — 90% trafic sur le champion, 10% sur le challenger, comparer les metriques business
5. **EU AI Act** : classifier le risque (inacceptable → minimal), documenter dans un risk register, transparence pour l'utilisateur

---

> **Prochain cours** : [Cours 86 — Blockchain & Consensus distribue](./03-blockchain-consensus.md)

---

> **Lien fil rouge — ShopArch**
>
> - Réfléchis : dans quel cas ShopArch aurait besoin de ML ? (recommandations produit, pricing dynamique, détection de fraude)
> - Conçois l'interface `RecommendationEngine` comme un port hexagonal
> - Checkpoint : Module 13, critère 4
