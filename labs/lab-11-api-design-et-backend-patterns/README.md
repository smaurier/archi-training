# Lab 11 — API design et backend patterns

> **Outcome :** à la fin, tu sais prendre un pêle-mêle d'opérations backend et en **concevoir le contrat d'API** : modéliser les **ressources**, choisir **verbes + codes**, exprimer une **action non-CRUD**, spécifier un **contrat d'erreur structuré**, poser la **validation en couches** et **choisir le pattern d'accès aux données**.
> **Vrai outil :** papier / tableau blanc / fichier `.md` — c'est un exercice de **conception**, pas d'implémentation. Tu produis un tableau de contrat (endpoints + codes), un contrat d'erreur, un mini-ADR de patterns. Aucun code à exécuter.
> **Feedback :** le coach valide le raisonnement en session (grille ci-dessous). Pas de test-runner.

---

## Énoncé

L'équipe TribuZen veut exposer la gestion des **familles**, des **co-référents** et de leurs **invitations**. Un contributeur pressé a listé les opérations en style RPC, tout en `POST`, avec des erreurs improvisées. Voici le brouillon livré (tu le lis, tu n'as rien à exécuter) :

```
POST /createFamily              { name, ownerId }
POST /getFamily                 { familyId }
POST /getFamilyMembers          { familyId }
POST /renameFamily              { familyId, name }
POST /inviteCoReferent          { familyId, email, role }
POST /acceptInvitation          { token }
POST /revokeCoReferent          { familyId, memberId }
POST /getInvitationStatus       { invitationId }
GET  /familyError               → { "error": "oops" }
```

Contexte métier (règles TribuZen à respecter) :
- Une famille a **au plus 8 co-référents**.
- Un `role` valide ∈ `{ owner, coreferent, reader }`.
- Une invitation a un **statut** (`sent` / `accepted` / `expired`) et un **token**.
- On ne peut pas inviter une adresse **déjà membre** de la famille.
- L'app mobile qui consommera cette API est **déployée** (clients non contrôlés) et fonctionne parfois **hors-ligne** (elle rejoue une file d'actions au retour réseau).

**Ta mission (conception uniquement) :**

1. **Modélise les ressources** cachées derrière ces opérations (noms du domaine, hiérarchie d'URL, imbrication ≤ 2 niveaux).
2. **Écris le tableau du contrat** : pour chaque opération → endpoint (verbe + URL versionnée), code de succès, et pourquoi ce verbe/code.
3. **Traite les actions non-CRUD** (inviter, accepter, révoquer) : ressource cachée ou endpoint d'action ? Justifie chaque choix.
4. **Spécifie le contrat d'erreur** de « inviter un co-référent » : liste les échecs possibles, mappe chacun à un **code HTTP** et à un objet **Problem Details** (type/title/status/detail/violations).
5. **Pose la validation en 3 couches** pour l'invitation : qu'est-ce qui est format (DTO), règle métier (domaine), contrainte de persistance ?
6. **Choisis le pattern d'accès aux données** (Active Record vs Data Mapper + Repository ; Unit of Work ?) et écris un **mini-ADR** de 6-8 lignes qui le justifie.

**Contrainte de portée :** on conçoit **le contrat et les patterns**. N'écris **pas** d'implémentation NestJS (cours 09), pas de SQL/Prisma (cours 10), pas de mécanique ETag/cache HTTP (cours 11). Tu décides la **forme**, pas le code.

---

## Étapes (en friction)

1. **Chasse aux ressources.** Souligne, dans le brouillon, chaque **verbe** dans une URL (`createFamily`, `getFamilyMembers`…). Pour chacun, écris le **nom** de la ressource qu'il manipule. Regroupe : combien de ressources distinctes ? (`Family`, `Member`, `Invitation`.)
2. **Hiérarchie d'URL.** Décide qui est sous qui : un membre appartient-il à une famille ? une invitation ? Écris les chemins, sans dépasser 2 niveaux d'imbrication.
3. **Verbe + code.** Pour chaque opération, choisis le verbe (GET/POST/PATCH/DELETE) et le code de succès (200/201/204). À chaque ligne, note **sûr ?** et **idempotent ?** — et ce que ça change pour le client offline.
4. **Actions non-CRUD.** « Inviter » : ressource cachée (`POST /families/{{id}}/invitations`, on **crée** une invitation) ou action ? « Accepter » : que se passe-t-il si on la modélise comme un changement d'état d'invitation vs un endpoint `/accept` ? « Révoquer » : DELETE d'un membre ou action ? Tranche et justifie.
5. **Contrat d'erreur de l'invitation.** Liste les échecs : famille introuvable, famille pleine (max 8), rôle invalide, adresse déjà membre, non authentifié, pas le droit d'inviter. Mappe chacun à un code (401/403/404/409/422) et écris l'objet Problem Details correspondant.
6. **Validation en couches.** Range chaque vérification : `email` bien formé (format ?) ; `role` est une string (format ?) ; `role ∈ {owner,coreferent,reader}` (format ou règle ?) ; « max 8 » (règle) ; « déjà membre » (règle ou persistance ?). Attention au piège format-vs-règle.
7. **Patterns de données + ADR.** La famille et l'invitation ont-elles de vraies règles ? Faut-il isoler le domaine ? Y a-t-il une écriture multi-entités atomique (créer invitation + notifier) ? Choisis Active Record ou Data Mapper + Repository, et si un Unit of Work est utile. Rédige le mini-ADR.
8. **Auto-contrôle.** Repasse la grille ci-dessous avant de montrer ta copie au coach.

---

## Corrigé complet commenté

> Le corrigé porte sur **le contrat et les décisions de patterns**, pas sur du code exécutable. Les extraits sont des squelettes qui montrent la **forme**, pas l'implémentation.

### 1. Ressources et hiérarchie

Trois ressources du domaine : **Family**, **Member** (co-référent), **Invitation**.

```
/families                                   collection de familles
/families/{{familyId}}                        une famille
/families/{{familyId}}/members                les co-référents d'une famille
/families/{{familyId}}/members/{{memberId}}     un co-référent
/families/{{familyId}}/invitations            les invitations d'une famille
/invitations/{{id}}                           une invitation (accès direct par id/token)
```

Les membres et invitations sont **sous** la famille (relation d'appartenance), imbrication à 2 niveaux max. On expose aussi `/invitations/{{id}}` à plat pour l'accès direct (accepter via token sans connaître la famille).

### 2. Tableau du contrat (versionné par URL)

| Opération (brouillon) | Endpoint | Succès | Sûr | Idemp. | Pourquoi |
|-----------------------|----------|:------:|:---:|:------:|----------|
| createFamily | `POST /v1/families` | 201 | non | non | création |
| getFamily | `GET /v1/families/{{id}}` | 200 | oui | oui | lecture |
| getFamilyMembers | `GET /v1/families/{{id}}/members` | 200 | oui | oui | lecture d'une sous-collection |
| renameFamily | `PATCH /v1/families/{{id}}` | 200 | non | non | modif partielle d'un champ |
| inviteCoReferent | `POST /v1/families/{{id}}/invitations` | 201 | non | non | **crée une invitation** |
| acceptInvitation | `PATCH /v1/invitations/{{id}}` `{status:"accepted"}` | 200 | non | oui | **transition d'état** de l'invitation |
| revokeCoReferent | `DELETE /v1/families/{{id}}/members/{{memberId}}` | 204 | non | oui | suppression d'un membre |
| getInvitationStatus | `GET /v1/invitations/{{id}}` | 200 | oui | oui | lecture |

`/v1` d'emblée : l'app mobile est déployée (clients non contrôlés) → un futur breaking change vivra sur `/v2` sans casser les apps installées.

### 3. Actions non-CRUD — les décisions clés

- **Inviter** → **ressource cachée** : une invitation **est** une ressource (token, statut, email, id). Donc `POST /families/{{id}}/invitations` (201), pas `POST /inviteCoReferent`. Bénéfice : on peut ensuite lister, lire le statut, accepter — tout devient CRUD sur `Invitation`.
- **Accepter** → **transition d'état** de l'invitation : `PATCH /invitations/{{id}}` avec `{ status: "accepted" }` (idempotent : ré-accepter une invitation déjà acceptée aboutit au même état). Alternative acceptable : `POST /invitations/{{id}}/accept` si l'acceptation déclenche des effets de bord complexes — à assumer explicitement.
- **Révoquer** → **DELETE d'un membre** : `DELETE /families/{{id}}/members/{{memberId}}` (204, idempotent). Ce n'est pas un endpoint d'action, c'est la suppression d'une ressource `Member`.

> Le piège évité : ne PAS créer `/acceptInvitation`, `/revokeCoReferent`, `/inviteCoReferent` comme trois RPC. Derrière chaque action, on a trouvé la ressource (`Invitation`, `Member`) et le verbe standard.

### 4. Contrat d'erreur de `POST /families/{{id}}/invitations`

| Situation | Code | Le client doit | Problem Details (extrait) |
|-----------|:----:|----------------|----------------------------|
| Non authentifié | 401 | se (ré)authentifier | `type: .../unauthorized` |
| Authentifié mais pas le droit d'inviter | 403 | abandonner | `type: .../forbidden` |
| Famille introuvable | 404 | ne pas réessayer | `type: .../family-not-found` |
| Famille pleine (max 8) | 422 | afficher la règle | `type: .../family-full`, `detail: "max 8 co-référents"` |
| Rôle invalide (hors enum métier) | 422 | corriger | `violations: [{field:"role", message:"rôle non autorisé"}]` |
| Adresse déjà membre | 409 | rafraîchir / considérer fait | `type: .../already-member` |

```json
{
  "type": "https://api.tribuzen.app/problems/family-full",
  "title": "Famille pleine",
  "status": 422,
  "detail": "Une famille ne peut pas dépasser 8 co-référents.",
  "instance": "/v1/families/f-123/invitations"
}
```

Pourquoi ces codes précis : le client mobile offline qui **rejoue** sa file d'actions distingue « famille introuvable » (404 → abandonner l'action) de « déjà membre » (409 → considérer comme fait) de « famille pleine » (422 → remonter le message à l'utilisateur). Un `{ "error": "oops" }` unique rendrait la synchro incapable de décider.

### 5. Validation en 3 couches (invitation)

| Vérification | Couche | Pourquoi |
|--------------|--------|----------|
| `email` bien formé, `role` présent et string | **Format** (DTO / présentation) | forme de l'entrée, indépendante du métier → collecte des violations, 422/400 |
| `role ∈ {owner, coreferent, reader}` | **Règle métier** (domaine) | les rôles autorisés sont une décision TribuZen, pas un simple format |
| « famille pleine si ≥ 8 membres » | **Règle métier** (domaine) | invariant protégé par l'entité `Family` |
| « adresse pas déjà membre » | **Règle métier** (domaine), confortée par | invariant d'unicité métier… |
| unicité `(familyId, email)` en base | **Persistance** (infra) | …+ garde-fou par contrainte d'unicité DB → 409 |

> Piège classique : « role est une string » (format) ≠ « role est un rôle autorisé » (règle). Le premier va au DTO, le second au domaine. Idem « déjà membre » : règle métier **et** contrainte de persistance (défense en profondeur), pas seulement l'un des deux.

### 6. Mini-ADR — patterns d'accès aux données

```
ADR-11 — Accès aux données du module Familles/Invitations
Contexte : Family et Invitation portent de vraies règles (max 8, rôles autorisés,
  unicité, statut d'invitation). L'app mobile est déployée et fonctionne offline.
Décision :
  - Data Mapper + Repository : entités Family/Invitation PURES (règles testables
    sans base) ; interfaces FamilyRepository / InvitationRepository DANS le domaine,
    implémentées dans l'infrastructure. On écarte Active Record (couplerait les
    règles à l'ORM et empêcherait de tester sans base).
  - Unit of Work (via la transaction de l'ORM) pour « inviter » : créer l'Invitation
    et journaliser l'événement doivent être atomiques (tout ou rien).
  - Un repository par AGRÉGAT (Family, Invitation), pas par table.
Conséquence : les règles (max 8, rôles, unicité) sont testables sans HTTP ni base ;
  le jour où des données passent en Level 1 (device-only chiffré), on change
  l'implémentation du repository, le domaine ne bouge pas.
```

**Pourquoi ce corrigé est correct :** chaque opération est modélisée comme une **ressource + verbe standard** (aucun RPC résiduel), les codes de retour **instruisent** le client (401/403/404/409/422 distincts), les actions non-CRUD ont trouvé leur ressource cachée, la validation est **rangée par couche** (format ≠ règle), et le pattern de données **isole le domaine** tout en garantissant l'atomicité — le tout sans écrire une ligne d'implémentation.

---

## Grille d'évaluation (coach)

| Critère | Attendu | ✅ / ❌ |
|---|---|---|
| Ressources modélisées | 3 ressources identifiées (Family, Member, Invitation) + hiérarchie d'URL ≤ 2 niveaux | |
| Verbe + code justes | Chaque opération a le bon verbe et le bon code (201 création, 204 delete, 200 lecture) avec justification sûr/idempotent | |
| Actions non-CRUD | Inviter = créer une invitation ; accepter = transition d'état ; révoquer = DELETE membre — ressource cachée trouvée, pas de RPC | |
| Versioning | `/v1` justifié par les clients mobiles déployés non contrôlés | |
| Contrat d'erreur | ≥ 5 échecs de l'invitation mappés à des codes distincts (401/403/404/409/422) + Problem Details structuré | |
| Validation en couches | Distingue format (DTO) / règle métier (domaine) / persistance — notamment le rôle et « déjà membre » | |
| Pattern de données | Data Mapper + Repository justifiés vs Active Record ; Unit of Work pour l'atomicité ; un repo par agrégat | |
| Portée respectée | Reste au niveau contrat/patterns ; pas d'impl NestJS, pas de SQL, pas d'ETag/cache HTTP | |

Seuil : **6/8** pour valider. En dessous, reprends la modélisation des ressources (étapes 1-2) avant de spécifier les erreurs et les patterns.

---

## Variante J+30 (fading)

**Même exercice, contraintes ajoutées :**

1. **En 25 minutes, de mémoire**, sans relire ce corrigé ni le module 11.
2. On te donne un **nouveau** pêle-mêle : la gestion des **journaux de gratitude** d'une famille — `POST /createEntry`, `POST /getEntries`, `POST /editEntry`, `POST /deleteEntry`, `POST /exportFamilyJournalPdf`, `POST /markEntryFavorite`. Conçois le contrat : ressources, verbes, codes, versioning.
3. **Contrainte supplémentaire n°1 :** `exportFamilyJournalPdf` est un **piège de modélisation** — export long, résultat asynchrone. Est-ce un GET, un POST qui crée une ressource « export », ou un endpoint d'action ? Justifie en une phrase (indice : le pattern d'export asynchrone touche au **module 12**, à ne pas dérouler ici — mais nomme la ressource `Export` si tu la crées).
4. **Contrainte supplémentaire n°2 :** `markEntryFavorite` — transition d'état (`PATCH`) ou sous-ressource (`PUT/DELETE /entries/{{id}}/favorite`) ? Tranche et justifie l'idempotence.

**Critère de réussite :** tableau de contrat (verbes + codes) + contrat d'erreur d'une opération + choix de pattern de données, produits en 25 min, avec `exportPdf` correctement traité comme **création d'une ressource Export** (et non un GET qui bloque) et la distinction format/règle tenue.

---

## Application TribuZen

Ce lab prépare la conception réelle de l'API du backend NestJS de TribuZen (repo `smaurier/tribuzen-api`).

- Le contrat conçu ici (`/v1/families`, `/routines`, `/invitations`, `/completions`) est le **point de départ** de l'API que consommera l'app mobile React Native.
- Les règles (« max 8 co-référents », rôles autorisés, statut d'invitation) vivront dans le **domaine** (`Family`, `Invitation`), derrière des repositories — testables sans HTTP ni base.
- Le contrat d'erreur en Problem Details est la fondation de la **synchro offline** (React Query + file d'actions rejouée) : chaque code guide le comportement de rejeu.

**Commit cible :**
```
docs(api): contrat d'API v1 TribuZen — ressources, codes, erreurs structurées, patterns d'accès données
```
