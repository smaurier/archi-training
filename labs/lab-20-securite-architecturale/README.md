<!-- FLAG-REVIEW: SÉCURITÉ (archi) — à valider par Sylvain -->

# Lab 20 — Sécurité architecturale

> **Outcome :** à la fin, tu sais prendre une feature TribuZen, en dérouler le **threat model STRIDE** à partir d'un data flow diagram, **placer les contrôles de sécurité** à la bonne frontière (défense en profondeur), et appliquer la **privacy by design** sur des données sensibles.
> **Vrai outil :** papier / tableau blanc / fichier `.md` — c'est un exercice de **conception**, pas d'implémentation. Tu produis un DFD annoté, un tableau STRIDE, une carte de contrôles et un mini-ADR privacy. **Aucun code à faire tourner.**
> **Feedback :** le coach valide le raisonnement en session (grille ci-dessous). Pas de test-runner, pas de harnais.
>
> **Portée :** on reste au niveau **architecture** (où placer les contrôles, quelles menaces). On **ne** code **pas** de guard, de crypto ni de CSP — ça, c'est le **cours 14**. Ici on décide la topologie de la sécurité.

---

## Énoncé

TribuZen ajoute la feature **« Album photo partagé »**. Voici le comportement voulu (données sensibles : **photos d'enfants**) :

- Un membre d'une famille **upload** une photo dans l'album de sa famille : `POST /families/:familyId/album`.
- Tout membre de la famille peut **lister / voir** les photos : `GET /families/:familyId/album`.
- Chaque photo a un `authorId` (qui l'a postée) et une **légende** libre.
- Les enfants (rôle `reader`) peuvent **voir** mais pas **uploader** ni **supprimer**.
- Les photos sont stockées dans un **object storage** (S3-like) ; les métadonnées (auteur, légende, familyId) dans **PostgreSQL**.

Un contributeur pressé propose cette archi « on sécurisera plus tard » :

```
[App mobile] ──▶ [API NestJS] ──┬──▶ [PostgreSQL]  (métadonnées)
                                 └──▶ [Object storage] (fichiers photo)

- L'app envoie { familyId, authorId, role, caption, file } dans le body.
- L'API insère en base et pousse le fichier au storage. Pas de vérification.
- L'URL du storage renvoyée est publique et devinable : /album/<familyId>/<n>.jpg
```

**Ta mission (conception uniquement) :**

1. **Dessine le data flow diagram** de la feature avec ses **trust boundaries** (au moins : client↔API, API↔DB, API↔object storage).
2. **Déroule STRIDE** : pour **chacune** des 6 catégories, écris **au moins une menace concrète** de cette feature et le **contrôle** qui la traite (et **à quelle couche/frontière** il vit).
3. **Trace la carte des contrôles en défense en profondeur** : liste les contrôles superposés du bord réseau jusqu'aux données, en précisant contre quelle(s) menace(s) chacun protège.
4. **Repère les 3 défauts** de l'archi proposée (indice : données du client de confiance, URL devinable, absence d'autorisation) et corrige le placement.
5. **Écris un mini-ADR privacy by design** (5-8 lignes) : minimisation, opt-in par défaut, et une décision de placement de la donnée sensible (Level 1 vs Level 2 de la spec).

**Contrainte de portée :** tu **décides** où vivent les contrôles et contre quoi. Tu n'écris **aucun** guard NestJS, aucune crypto, aucune config de headers — ce deep est déféré au cours 14. Reste sur la **topologie**.

---

## Étapes (en friction)

1. **DFD d'abord.** Dessine processus (API), stockages (DB, object storage), entité externe (app mobile) et **trace les lignes de trust boundary**. Une donnée devient-elle « de confiance » en franchissant l'API ? Non — d'où viennent `authorId` et `role` dans le body ? (piège central)
2. **STRIDE par élément.** Prends chaque frontière et pose-toi les 6 questions. Force-toi à trouver **une menace par lettre**, même celles auxquelles tu ne penses pas (Repudiation, DoS). Pour chacune : quel contrôle, et **où** ?
3. **Le piège du body.** `authorId` et `role` viennent du **client** (zone non fiable). Que se passe-t-il si l'app ment (`role: 'admin'`, `authorId: <un autre membre>`) ? Rattache ça à Tampering + Elevation of Privilege et corrige la **source** de ces valeurs.
4. **L'URL devinable.** `/album/<familyId>/<n>.jpg` publique = Information Disclosure (Broken Access Control) : un inconnu énumère les photos d'enfants d'autres familles. Quel contrôle, à quelle couche ? (indice : URL signée à durée limitée / accès médié par l'API + autorisation d'appartenance — décris la **décision**, pas le code).
5. **Carte de défense en profondeur.** Empile les contrôles : bord réseau → entrée API → application/domaine → données/storage. Pour chaque, note la menace couverte. Vérifie qu'aucun contrôle n'est un point de défaillance unique.
6. **Privacy by design.** Décide : les photos d'enfants sont-elles Level 1 (device-only) ou Level 2 (partagé famille, chiffré) ? Quelle donnée peux-tu **ne pas** collecter (minimisation) ? Le partage est-il opt-in ? Rédige le mini-ADR.
7. **Auto-contrôle.** Repasse la grille ci-dessous sur ta copie avant de la montrer au coach.

---

## Corrigé complet commenté

> Le corrigé porte sur le **raisonnement de conception** (menaces, placement, privacy), pas sur du code exécutable.

### 1. Data flow diagram + trust boundaries

```
┌─ ZONE NON FIABLE ──────────────────────────────────────┐
│  [App mobile]  — body: { familyId, authorId, role,       │
│                          caption, file }  ← TOUT hostile │
└───────────────────────────┬────────────────────────────┘
=========== TB1 : bord réseau (client ↔ API) =============
┌───────────────────────────▼────────────────────────────┐
│  [API NestJS]                                            │
│   authN (token) · validation format · authZ appartenance│
│   + rôle · dérive authorId DU TOKEN                      │
└───────────┬───────────────────────────┬─────────────────┘
==== TB2 : réseau interne (API ↔ DB) ==== TB3 : (API ↔ storage) ==
┌───────────▼──────────┐        ┌────────▼─────────────────┐
│ [PostgreSQL]         │        │ [Object storage]         │
│ métadonnées, chiffré │        │ fichiers, accès médié /  │
│ au repos, compte     │        │ URL signée courte durée  │
│ moindre privilège    │        │ (pas d'URL publique      │
└──────────────────────┘        │  devinable)              │
                                └──────────────────────────┘
```

> Point clé : franchir TB1 **ne rend pas** les données de confiance. `authorId` et `role` du body sont **ignorés** ; l'API les **dérive du token**.

### 2. Threat model STRIDE

| Menace | Scénario concret « Album photo » | Contrôle (et OÙ) |
|--------|----------------------------------|------------------|
| **S** Spoofing | Un inconnu appelle l'API sans être membre | AuthN par token à la **frontière d'entrée** (TB1) |
| **T** Tampering | L'app envoie `authorId` d'un autre membre pour lui attribuer une photo | `authorId` **dérivé du token**, jamais du body → règle **domaine/application** |
| **R** Repudiation | Un membre nie avoir supprimé une photo partagée | **Audit log** applicatif (qui, quoi, quand) → couche **application** |
| **I** Information Disclosure | URL `/album/43/2.jpg` publique et devinable → photos d'enfants d'autres familles | **Autorisation d'appartenance** (application) + **URL signée courte durée** / accès médié (storage) + **chiffrement au repos** (données) |
| **D** Denial of Service | Upload massif de fichiers énormes / énumération | **Rate limiting** + **limite de taille** au **bord réseau / gateway** |
| **E** Elevation of Privilege | Un enfant (`reader`) envoie `role: 'admin'` dans le body pour uploader/supprimer | Le **rôle vient du token/serveur** ; contrôle de rôle (least privilege) en couche **application** |

> On a **une menace par lettre**. La plus grave = **I** (accès aux photos d'enfants d'autres familles) : c'est du **Broken Access Control (A01)**, exactement le défaut de l'URL publique.

### 3. Carte de défense en profondeur

```
POST/GET /families/:familyId/album
  │
  ├─[bord réseau]         rate limiting + limite taille upload   ← D
  │
  ├─[entrée API / guard]  authN token valide                     ← S
  │                       validation format (caption, type MIME) ← T (entrée malformée)
  │
  ├─[application/domaine] authorId ← token (pas le body)          ← T
  │                       user ∈ membres(familyId)                ← I / A01
  │                       rôle autorise l'action (reader ≠ write) ← E
  │                       audit log (upload / delete)             ← R
  │
  ├─[données PostgreSQL]  chiffrement au repos + compte moindre   ← I (assume breach)
  │                       privilège
  │
  └─[object storage]      URL signée à durée limitée, pas d'URL   ← I
                          publique devinable ; accès médié par API
```

**Pourquoi c'est robuste :** contrôles **indépendants** superposés. Si l'autorisation d'appartenance a un bug (couche application), l'URL signée + le chiffrement au repos limitent encore la fuite. Aucun contrôle n'est le point de défaillance unique. Chaque contrôle est **à la couche dont c'est la responsabilité** (module 05).

### 4. Les 3 défauts de l'archi proposée

| Défaut | Menace | Correction (placement) |
|--------|--------|------------------------|
| `authorId` / `role` viennent du **body** (client de confiance) | T + E | Les **dériver du token** côté serveur ; ignorer le body pour ces champs |
| URL storage **publique et devinable** (`/album/<familyId>/<n>.jpg`) | I / A01 | **URL signée à durée limitée** ou accès médié par l'API + autorisation d'appartenance |
| **Aucune autorisation** d'appartenance / de rôle | I + E | AuthZ **en couche application/domaine** : appartenance famille + rôle avant tout accès |

### 5. Mini-ADR privacy by design (exemple attendu)

```
ADR-20 — Privacy by design de l'Album photo (données d'enfants)
Contexte : album de photos d'enfants partagé dans le cercle famille.
Décision :
  - Classification : Level 2 (partagé famille, serveur) — chiffré au repos ;
    les photos ne sont PAS Level 1 car le partage entre membres est la feature même.
  - Minimisation : on stocke familyId + authorId + caption ; PAS de géoloc EXIF
    (on strippe les métadonnées EXIF à l'upload — pas de localisation d'enfant).
  - Opt-in par défaut : l'album est privé à la famille ; aucun partage externe
    (lien public) sans action explicite du membre. Défaut = le plus fermé.
  - Purge : suppression d'une photo = purge du fichier storage ET des métadonnées ;
    droit à l'effacement propagé au storage (pas juste un soft-delete en base).
Conséquence : la surface de fuite est minimale (pas d'EXIF, accès médié, chiffré),
  et l'autorisation d'appartenance vit dans le domaine — testable sans HTTP.
```

**Pourquoi ce corrigé est correct :** chaque menace STRIDE a un contrôle **placé à la bonne frontière** ; les valeurs sensibles (identité, rôle) viennent du **serveur**, jamais du client ; la défense est **en profondeur** (aucun point de défaillance unique) ; et la privacy est traitée comme une **contrainte d'architecture** (minimisation EXIF, opt-in, purge réelle), pas une rustine.

---

## Grille d'évaluation (coach)

| Critère | Attendu | ✅ / ❌ |
|---|---|---|
| DFD + trust boundaries | Schéma avec au moins 3 frontières (client↔API, API↔DB, API↔storage) tracées | |
| STRIDE complet | **Une** menace concrète **par lettre** (S,T,R,I,D,E), pas de catégorie oubliée | |
| Placement des contrôles | Chaque contrôle à la bonne couche/frontière (authN entrée, authZ domaine, chiffrement données…) | |
| Piège du body | Identifie que `authorId`/`role` du client sont hostiles → dérivés du token serveur | |
| Broken Access Control | Repère l'URL publique devinable comme Information Disclosure + corrige (URL signée / accès médié + appartenance) | |
| Défense en profondeur | Contrôles indépendants superposés ; aucun point de défaillance unique | |
| Privacy by design | ADR avec minimisation (EXIF), opt-in par défaut, purge réelle, classification Level 1/2 justifiée | |
| Portée respectée | Reste en topologie/placement ; ne code pas de guard/crypto/CSP (déféré cours 14) | |

Seuil : **6/8** pour valider. En dessous, reprends le DFD (étape 1) et le tableau STRIDE (étape 2) avant la carte de contrôles.

---

## Variante J+30 (fading)

**Même exercice, contraintes ajoutées :**

1. **En 25 minutes, de mémoire**, sans relire ce corrigé ni le module 20.
2. On te donne une **nouvelle** feature : **« Partage d'un lien d'invitation public »** — un parent génère un lien que n'importe qui avec l'URL peut ouvrir pour rejoindre la famille (`GET /join/:token`). Déroule STRIDE, place les contrôles, et écris l'ADR privacy.
3. **Contrainte supplémentaire :** identifie la menace **la plus grave** de cette feature (indice : un lien public = frontière de confiance très fine) et propose **deux** contrôles indépendants (défense en profondeur) pour la même menace — par exemple token à usage/durée limités **et** validation d'un second facteur à l'acceptation.

**Critère de réussite :** DFD + tableau STRIDE des 6 catégories + carte de contrôles + ADR de 5 lignes, produits en 25 min, avec la menace dominante (Elevation of Privilege / accès non autorisé via le lien) correctement traitée par **deux** contrôles superposés.

---

## Application TribuZen

Ce lab prépare la conception sécurité réelle de TribuZen (repo `smaurier/tribuzen-api`).

- La feature **Album photo** (ou Journal familial) existera vraiment ; son threat model STRIDE sera fait **avant** le code, en conception.
- Le modèle de confidentialité par niveaux (**Level 1 device-only** / **Level 2 partagé famille**, cf. spec §8) décide **physiquement** où vit la donnée sensible — le placement le plus haut possible est le meilleur contrôle (la donnée qui n'atteint jamais le serveur ne peut pas fuir côté serveur).
- L'implémentation (guards NestJS, chiffrement, URL signées, strip EXIF, conformité RGPD) sera faite au **cours 14** ; ce lab en fixe la **topologie** : quelles menaces, quels contrôles, à quelles frontières.

**Commit cible :**
```
docs(security): threat model STRIDE + carte de contrôles + ADR privacy — feature Album photo
```
