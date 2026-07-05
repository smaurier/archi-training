# Lab 05 — Architecture en couches

> **Outcome :** à la fin, tu sais prendre un module TribuZen où tout est empilé, le **découper en couches** (présentation / métier / données), tracer son **graphe de dépendances**, et **repérer + corriger** les violations de la règle de dépendance.
> **Vrai outil :** papier / tableau blanc / fichier `.md` — c'est un exercice de **conception**, pas d'implémentation. Tu produis un schéma de couches + une liste de violations + un plan de rangement. Aucun code à faire tourner.
> **Feedback :** le coach valide le raisonnement en session (grille ci-dessous). Pas de test-runner.

---

## Énoncé

TribuZen a un endpoint « inviter un co-référent dans une famille ». Un contributeur pressé a tout mis dans un seul controller NestJS. Voici le code livré (le lis, tu n'as pas à l'exécuter) :

```ts
// invitations.controller.ts — TOUT est ici
@Controller('families')
export class InvitationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  @Post(':familyId/invitations')
  async invite(
    @Param('familyId') familyId: string,
    @Body() body: { email: string; role: string },
  ) {
    // a. Lecture directe de la base depuis le controller
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      include: { members: true },
    });
    if (!family) throw new NotFoundException('famille introuvable');

    // b. Règles métier écrites en dur dans la méthode HTTP
    if (family.members.length >= 8) {
      throw new BadRequestException('famille pleine (max 8 co-référents)');
    }
    if (body.role !== 'coreferent' && body.role !== 'reader') {
      throw new BadRequestException('rôle invalide');
    }
    const already = family.members.find((m) => m.email === body.email);
    if (already) throw new BadRequestException('déjà membre');

    // c. Génération de token + persistance mélangées
    const token = Math.random().toString(36).slice(2);
    const invite = await this.prisma.invitation.create({
      data: { familyId, email: body.email, role: body.role, token },
    });

    // d. Effet de bord infra (email) piloté depuis le controller
    await this.mailer.send(body.email, 'Invitation TribuZen', `token: ${token}`);

    return { id: invite.id, status: 'sent' };
  }
}
```

**Ta mission (conception uniquement) :**

1. **Classe chaque responsabilité** (a, b, c, d et sous-parties) dans la bonne couche : **présentation**, **métier/domaine**, **application** (orchestration), **accès aux données / infrastructure**.
2. **Dessine le schéma de couches cible** du module `invitations` (arborescence de fichiers + une phrase par fichier sur sa responsabilité).
3. **Trace le graphe de dépendances** de la version *actuelle* (qui appelle/importe quoi) et **entoure les violations** de la règle de dépendance.
4. **Écris un mini-ADR** (5-8 lignes) : quelle règle vit où, et **une** décision strict-vs-relâché que tu prends explicitement, avec sa justification.

**Contrainte de portée :** on reste en **architecture en couches** (module 05). Ne bascule PAS en hexagonale/ports-adapters (module 06) ni clean (module 07) — même si tu connais. Le but est de maîtriser le socle : couches + sens des dépendances.

---

## Étapes (en friction)

1. **Inventaire des responsabilités.** Relis le controller et liste chaque chose qu'il fait (lire la famille, vérifier la capacité, valider le rôle, vérifier le doublon, générer le token, persister, envoyer l'email, formater la réponse HTTP). Pour chacune : **quelle est sa raison de changer ?**
2. **Attribution.** Range chaque responsabilité dans une couche. Piège : « valider le rôle » — est-ce de la validation de **format** HTTP (présentation, DTO) ou une **règle** métier ? Justifie. Idem pour « famille pleine (max 8) » : format ou règle ?
3. **Schéma cible.** Écris l'arborescence `invitations/presentation|application|domain|infrastructure/…` avec un fichier par responsabilité et une phrase de rôle.
4. **Graphe actuel + violations.** Dessine les flèches d'import de la version livrée. Marque chaque flèche : descendante OK, saut de couche, ou remontée. Compte les violations.
5. **Où vivent les règles ?** Décide quelle entité/objet du domaine porte « max 8 membres » et « statut d'invitation ». Le controller doit finir en pur passe-plat HTTP.
6. **Mini-ADR.** Rédige la décision : règles → domaine, orchestration (token + persistance + email) → application, email/Prisma → infrastructure. Ajoute **une** décision strict/relâché assumée (ex : « la lecture d'une liste de rôles de référence pourra sauter le métier — relâché assumé »).
7. **Auto-contrôle.** Repasse la grille ci-dessous sur ta copie avant de la montrer au coach.

---

## Corrigé complet commenté

> Le corrigé porte sur le **découpage et les dépendances**, pas sur du code exécutable. Les extraits sont des squelettes pour montrer *où* vit chaque responsabilité.

### 1. Attribution des responsabilités

| Responsabilité (code) | Couche | Pourquoi |
|---|---|---|
| Parser `familyId` / `body`, formater la réponse `{ id, status }` | **Présentation** | Contrat HTTP, change si l'API change |
| Valider que `role` est une string non vide, email bien formé | **Présentation** (DTO) | Validation de **format** d'entrée, pas une règle métier |
| Règle « famille pleine si ≥ 8 membres » | **Domaine** | Vraie **invariant** métier, doit être protégée par l'entité `Family` |
| Règle « rôle ∈ {coreferent, reader} » | **Domaine** | Le domaine décide des rôles valides métier (le format seul ne suffit pas) |
| Règle « email pas déjà membre » | **Domaine** | Invariant d'unicité métier |
| Orchestrer : générer token → persister → envoyer email | **Application** | Coordination d'un cas d'usage + transaction |
| `prisma.family.findUnique`, `prisma.invitation.create` | **Infrastructure** (données) | Détail de persistance, change si on change d'ORM |
| `mailer.send(...)` | **Infrastructure** | Effet de bord I/O externe |

> Le point qui piège : « valider le rôle » a **deux facettes**. « est-ce une string » = présentation (DTO). « est-ce un rôle autorisé par les règles TribuZen » = domaine. Ne pas confondre validation de *format* et validation de *règle*.

### 2. Schéma de couches cible

```
invitations/
  presentation/
    invitations.controller.ts   ← HTTP seulement : reçoit la requête, appelle le service, formate la réponse
    create-invitation.dto.ts     ← validation de FORMAT (email, présence du role)
  application/
    invite-coreferent.service.ts ← orchestre : charge la famille, applique la règle, persiste, notifie
  domain/
    family.entity.ts             ← porte les invariants : capacité max 8, unicité email, rôles autorisés
    invitation.entity.ts         ← création d'invitation + token, statut (sent/accepted/expired)
    family.repository.ts         ← INTERFACE (contrat de persistance), aucune impl
    notification.port.ts         ← INTERFACE d'envoi de notification (contrat)
  infrastructure/
    prisma-family.repository.ts  ← implémente family.repository.ts avec Prisma
    mailer-notification.ts       ← implémente notification.port.ts avec MailerService
```

> Note : le domaine déclare des **interfaces** (`family.repository.ts`, `notification.port.ts`) que l'infrastructure implémente. En **couches classiques**, l'application appelle ces interfaces vers le bas. (L'inversion complète de dépendance — le domaine ne dépendant plus DU TOUT de l'infra — c'est le module 06. Ici, on se contente d'un contrat propre et du flux descendant.)

### 3. Squelette du controller rangé (présentation = passe-plat)

```ts
@Controller('families')
export class InvitationsController {
  constructor(private readonly invite: InviteCoreferentService) {}

  @Post(':familyId/invitations')
  async invite(
    @Param('familyId') familyId: string,
    @Body() dto: CreateInvitationDto, // validation de format ici
  ) {
    // Aucune règle, aucune base, aucun email : on délègue au métier
    const result = await this.invite.execute(familyId, dto.email, dto.role);
    return { id: result.id, status: 'sent' };
  }
}
```

### 4. Où vivent les règles (domaine riche)

```ts
class Family {
  private constructor(
    readonly id: string,
    private readonly members: Member[],
  ) {}

  // La règle de capacité + d'unicité est PROTÉGÉE par l'entité
  invite(email: string, role: Role): Invitation {
    if (this.members.length >= 8) {
      throw new DomainError('Famille pleine (max 8 co-référents)');
    }
    if (this.members.some((m) => m.email === email)) {
      throw new DomainError('Cette adresse est déjà membre');
    }
    return Invitation.create(this.id, email, role);
  }
}
```

### 5. Graphe de dépendances — version LIVRÉE (violations)

```
InvitationsController ──▶ PrismaService     (V1) saut de couche : présentation → données
InvitationsController ──▶ MailerService     (V2) saut de couche : présentation → infra
InvitationsController ── porte les règles    (V3) SoC violée : la règle métier vit dans la présentation
```

**Trois violations.** Le controller parle directement à la base (V1) et à l'infra email (V2) en sautant le métier, et contient les règles (V3). C'est un **fat controller** manuel.

### Graphe CIBLE (conforme)

```
InvitationsController ──▶ InviteCoreferentService        (présentation → application, OK)
InviteCoreferentService ──▶ Family (entité)              (application → domaine, OK)
InviteCoreferentService ──▶ FamilyRepository (interface) (application → contrat domaine, OK)
PrismaFamilyRepository  ──▶ FamilyRepository (implémente) (infra → contrat, OK)
MailerNotification      ──▶ NotificationPort (implémente) (infra → contrat, OK)
```

Toutes les flèches descendent (ou implémentent un contrat). Aucune remontée, aucun saut non assumé.

### 6. Mini-ADR (exemple attendu)

```
ADR-05 — Découpage en couches du module Invitations
Contexte : le endpoint d'invitation empile HTTP, règles et I/O dans un controller.
Décision :
  - Règles (capacité max 8, unicité email, rôles valides) → entité Family (domaine).
  - Orchestration (token + persistance + notification) → InviteCoreferentService (application).
  - Prisma et Mailer → infrastructure, derrière FamilyRepository et NotificationPort.
  - Le controller devient un passe-plat HTTP.
Layering : STRICT pour ce cas d'usage (il porte de vraies règles).
  Exception RELÂCHÉE assumée : la future lecture de la liste des rôles de référence
  (lecture seule, sans règle) pourra appeler directement l'infra sans passer par le métier.
Conséquence : la règle « max 8 » est testable sans HTTP ni base et réutilisable
  par un futur import batch de co-référents.
```

**Pourquoi ce corrigé est correct :** chaque responsabilité a **une** raison de changer isolée dans sa couche ; toutes les dépendances descendent ; les règles sont protégées par le domaine (plus de règle orpheline dans le controller) ; et la seule entorse (relâché) est **explicitement décidée**, pas subie.

---

## Grille d'évaluation (coach)

| Critère | Attendu | ✅ / ❌ |
|---|---|---|
| Attribution des couches | Chaque responsabilité (a→d) dans la bonne couche, avec justification par « raison de changer » | |
| Format vs règle | Distingue validation de format (DTO/présentation) et règle métier (domaine) — notamment le rôle et la capacité | |
| Règle de dépendance | Trace le graphe et identifie les **3** violations de la version livrée (2 sauts + 1 SoC) | |
| Graphe cible correct | Toutes les flèches descendent ou implémentent un contrat ; aucune remontée | |
| Domaine riche | La règle « max 8 » / unicité est portée par l'entité, pas par le service ni le controller | |
| Controller passe-plat | Le controller final ne fait que HTTP (aucun import ORM/mailer, aucune règle) | |
| Décision strict/relâché | Une décision explicite et justifiée (pas de relâché subi) | |
| Portée respectée | Reste en couches, ne bascule pas en hexagonale/clean | |

Seuil : **6/8** pour valider. En dessous, refais l'attribution des responsabilités (étapes 1-2) avant de retracer le graphe.

---

## Variante J+30 (fading)

**Même exercice, contraintes ajoutées :**

1. **En 20 minutes, de mémoire**, sans relire ce corrigé ni le module 05.
2. On te donne un **nouveau** module en pêle-mêle : « exporter le journal d'une famille en PDF » (le controller lit la base, vérifie le droit d'accès Level 1, génère le PDF via une lib externe, upload sur le stockage, renvoie l'URL). Découpe-le en couches, trace le graphe, liste les violations.
3. **Contrainte supplémentaire :** identifie **une** responsabilité qui est un **piège d'attribution** (ex : « génération PDF » — est-ce du domaine ou de l'infrastructure ?) et justifie ton choix en une phrase.

**Critère de réussite :** schéma de couches + graphe sans remontée + ADR de 5 lignes, produits en 20 min, avec la règle métier (droit d'accès Level 1) correctement placée dans le domaine et non dans le controller.

---

## Application TribuZen

Ce lab prépare le refactor réel du backend NestJS de TribuZen (repo `smaurier/tribuzen-api`).

- Le module **Invitations** existera vraiment (gestion des co-référents, jusqu'à 8 par famille — voir modèle éco « Famille »).
- Le découpage en couches produit ici est le **point de départ** ; les modules 06 (hexagonale) et 07 (clean) viendront **inverser** les dépendances domaine↔infra sur ce même module.
- La règle « max 8 co-référents » et la révocation d'un co-référent (séparation → rotation de clé, cf. spec §8) vivront dans le **domaine** `Family`, testables sans HTTP.

**Commit cible :**
```
refactor(invitations): découpage en couches — controller passe-plat, règles dans le domaine
```
