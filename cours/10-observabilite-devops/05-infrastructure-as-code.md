# Cours 72 — Infrastructure as Code

> **Objectif** : Comprendre l'Infrastructure as Code (Terraform, Pulumi, CDK), gérer le state, implémenter des modules réutilisables, et adopter le GitOps pour l'immutable infrastructure.

---

## Rappel du cours précédent

<details>
<summary>1. Quelle est la différence entre Blue/Green et Canary deployment ?</summary>

**Blue/Green** : deux environnements complets (Blue = actuel, Green = nouveau). Bascule instantanee du trafic de Blue a Green. Rollback = rebascule vers Blue. Cout : 2x l'infra temporairement. **Canary** : envoyer 5% du trafic vers la nouvelle version, observer les metriques, augmenter progressivement. Rollback = remettre le canary a 0%. Blast radius minimal.
</details>

<details>
<summary>2. Quels sont les 3 types de feature flags ?</summary>

1. **Build-time** (env vars `NEXT_PUBLIC_*`) : compile dans le build, pas modifiable après
2. **Runtime** (config DB/Redis) : modifiable sans redeploy, rollout progressif
3. **Per-user** (experimentation) : A/B testing, beta users, activation par utilisateur
</details>

---

## Analogie — Le plan de l'architecte vs construire a l'intuition

- **Click-ops** (configurer à la main dans la console AWS) : c'est comme construire une maison sans plan — tu sais ce que tu as fait, mais personne d'autre ne peut reproduire, et si ça brule, tu recommences de zero.
- **IaC** (Infrastructure as Code) : c'est le plan d'architecte — tout est documente, versionne, reproductible. Si la maison brule, tu reconstruis a l'identique en 1 heure.

---

## Théorie

### 1. IaC — pourquoi ?

| Sans IaC | Avec IaC |
|---|---|
| Configuration manuelle (console) | Code versionne (git) |
| Non reproductible | `terraform apply` identique partout |
| Pas de review | Pull request = review avant apply |
| Drift invisible | Drift détection automatique |
| Rollback ? Bon courage | `git revert` + `apply` |
| Documentation ? "Je sais ou j'ai clique" | Le code EST la documentation |

### 2. Terraform vs Pulumi vs CDK

| | Terraform | Pulumi | AWS CDK |
|---|---|---|---|
| Langage | HCL (declaratif) | TypeScript, Python, Go | TypeScript, Python |
| State | Remote backend (S3) | Pulumi Cloud / self-hosted | CloudFormation |
| Multi-cloud | Oui (AWS, GCP, Azure) | Oui | AWS uniquement |
| Learning curve | Faible | Moyenne | Moyenne |
| Maturite | Très mature | Mature | Mature (AWS) |

### 3. Concepts fondamentaux Terraform

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   .tf files  │────>│  terraform   │────>│   Cloud      │
│   (desired)  │     │  plan/apply  │     │   (actual)   │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                     ┌──────▼──────┐
                     │   State     │
                     │   (known)   │
                     │   .tfstate  │
                     └─────────────┘

Plan : compare desired vs known → genere les changements
Apply : execute les changements → met a jour le state
Destroy : supprime tout ce qui est dans le state
```

### 4. State management

```
JAMAIS de state local en equipe !

Remote backend (S3 + DynamoDB lock) :
  terraform {
    backend "s3" {
      bucket         = "myapp-terraform-state"
      key            = "production/terraform.tfstate"
      region         = "eu-west-1"
      dynamodb_table = "terraform-locks"  # Locking
      encrypt        = true
    }
  }

Le state contient des secrets (DB passwords, API keys) → chiffrement obligatoire
Le DynamoDB table empeche 2 personnes d'appliquer en meme temps
```

### 5. Modules réutilisables

```
modules/
  ├── vpc/
  │   ├── main.tf
  │   ├── variables.tf
  │   └── outputs.tf
  ├── rds/
  │   ├── main.tf
  │   ├── variables.tf
  │   └── outputs.tf
  └── ecs/
      ├── main.tf
      ├── variables.tf
      └── outputs.tf

environments/
  ├── production/
  │   └── main.tf     → module "vpc" { source = "../../modules/vpc" }
  └── staging/
      └── main.tf     → module "vpc" { source = "../../modules/vpc" }
```

### 6. GitOps

```
Git Repository (source of truth)
      │
      │  Push / Merge
      ▼
┌─────────────────┐
│  ArgoCD / Flux   │  Watch git repo
│                  │  Detect changes
│  Sync desired   │  Apply to cluster
│  state → actual │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Kubernetes      │
│  Cluster         │
└─────────────────┘

Principe : le cluster converge TOUJOURS vers l'etat dans git
Avantage : audit trail complet, rollback = git revert
```

### 7. Immutable infrastructure

```
Mutable (bad) :
  Server v1 ──[SSH + apt upgrade]──> Server v1.1 ──[patch]──> Server v1.2
  Configuration drift, etat inconnu

Immutable (good) :
  Image v1 → Deploy → Running
  Image v2 → Deploy → Running (v1 detruit)
  Jamais de modification in-place — toujours un nouveau container/VM
```

---

## Pratique

### Module Terraform pour un service NestJS

```hcl
# modules/api-service/main.tf
resource "aws_ecs_service" "api" {
  name            = var.service_name
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100  # Zero-downtime
  }
}

resource "aws_ecs_task_definition" "api" {
  family = var.service_name

  container_definitions = jsonencode([
    {
      name  = "api"
      image = "${var.image_repo}:${var.image_tag}"
      portMappings = [{ containerPort = 3000 }]

      environment = [
        { name = "NODE_ENV", value = var.environment },
        { name = "DATABASE_URL", value = var.database_url },
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3000/health/liveness || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"  = "/ecs/${var.service_name}"
          "awslogs-region" = var.region
        }
      }
    }
  ])
}

# modules/api-service/variables.tf
variable "service_name" { type = string }
variable "cluster_id" { type = string }
variable "image_repo" { type = string }
variable "image_tag" { type = string }
variable "desired_count" { type = number, default = 2 }
variable "environment" { type = string }
variable "database_url" { type = string, sensitive = true }
variable "region" { type = string, default = "eu-west-1" }
```

### Drift détection

```bash
# Detecter les differences entre le state et l'infra reelle
terraform plan -detailed-exitcode

# Exit codes :
# 0 = pas de changement
# 1 = erreur
# 2 = changements detectes (drift !)

# En CI : alerter si drift
if terraform plan -detailed-exitcode; then
  echo "No drift detected"
else
  echo "DRIFT DETECTED — manual changes found"
  # Envoyer une alerte Slack
fi
```

### ArgoCD application manifest

```yaml
# argocd/application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: api
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/myorg/infrastructure.git
    targetRevision: main
    path: k8s/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true      # Supprimer les ressources absentes du git
      selfHeal: true   # Corriger le drift automatiquement
    syncOptions:
      - CreateNamespace=true
```

---

## Résumé

1. **IaC** : l'infra est du code versionne — reproductible, reviewable, rollback via `git revert`
2. **State remote** : S3 + DynamoDB lock — jamais de state local en équipe, chiffrement obligatoire
3. **Modules réutilisables** : même module pour staging et production, seuls les variables changent
4. **GitOps** (ArgoCD/Flux) : le cluster converge vers l'état dans git — audit trail complet, self-healing
5. **Immutable infrastructure** : jamais de modification in-place — nouveau container/VM à chaque deploy, pas de drift

---

> **Prochain cours** : [Cours 73 — Pyramide de tests & Accessibilité](../11-testing-architecture/01-pyramide-tests-a11y.md)

---

> **Lien fil rouge — ShopArch**
>
> - Documente l'infrastructure ShopArch en IaC (Terraform ou Helm chart)
> - Configure les health checks (liveness, readiness, startup probes)
> - Exercice(s) associé(s) : `exercices/49-blue-green-deploy/`
> - Checkpoint : Module 10, critère 5

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Exercice** : [46-pipeline-observabilité](../../exercices/46-pipeline-observabilite/ENONCE)
2. **Exercice** : [47-slos-error-budgets](../../exercices/47-slos-error-budgets/ENONCE)
3. **Exercice** : [48-cicd-feature-flags](../../exercices/48-cicd-feature-flags/ENONCE)
4. **Exercice** : [49-blue-green-deploy](../../exercices/49-blue-green-deploy/ENONCE)
:::
