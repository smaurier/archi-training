# Lab 13 — Architecture des données

> **Outcome :** à la fin, tu sais prendre un besoin produit, **tracer sa carte de stockage** (quel store possède quelle donnée), **décider polyglot ou mono-store** en justifiant par le coût opérationnel, et **planifier une migration de schéma non-cassante** (expand-contract).
> **Vrai outil :** papier / tableau blanc / fichier `.md` — c'est un exercice de **décision d'architecture**, pas d'implémentation. Tu produis une carte de stockage + un mini-ADR + un plan de migration en étapes. Aucun code à faire tourner, aucune base à installer.
> **Feedback :** le coach valide le raisonnement en session (grille ci-dessous). Pas de test-runner auto-correcteur.

---

## Énoncé

TribuZen ajoute un module produit : **le Journal de famille** (feature V1 basique → V2 complet). Voici le besoin, tel qu'il ressort de la spec :

- Un parent peut écrire des **notes de journal** (texte libre) et attacher des **photos**, rattachées à un enfant et à une date.
- Le journal contient des données **très sensibles** : prénoms exacts d'enfants, photos, parfois des remarques sur la santé ou le comportement.
- L'app est **mobile-first (React Native)** avec un **mode hors-ligne** : on doit pouvoir écrire une note sans réseau, elle part quand la connexion revient.
- Plus tard (V2), on veut une **recherche** dans les notes (« retrouve la note où on parlait de la rentrée »).
- Le tout est maintenu par **une seule personne**, avec le principe non négociable : *le produit ne doit jamais devenir une charge mentale ni financière.*
- Contrainte RGPD (Art. 9) : **les données identifiantes/santé ne doivent jamais atteindre le serveur.**

Un contributeur propose d'emblée : *« MongoDB pour les notes (schéma flexible), S3 pour les photos, Elasticsearch pour la recherche, et Redis pour la file offline. »*

**Ta mission (décision uniquement) :**

1. **Trace la carte de stockage** du Journal : pour chaque donnée (note texte, photo, métadonnée date/enfant, index de recherche, file d'écritures offline), indique **quel store la possède**, à **quel niveau de confidentialité** (device chiffré / serveur pseudonymisé / agrégat), et **pourquoi**.
2. **Tranche la proposition du contributeur** store par store : gardé, rejeté, ou reporté — avec la justification par le **coût opérationnel** et le principe low-effort.
3. **Décide : polyglot ou mono-store ?** Distingue le polyglot *serveur* (plusieurs moteurs serveur) du polyglot *device ↔ serveur* (imposé par la contrainte offline + confidentialité). Justifie.
4. **Écris un mini-ADR** (8-12 lignes) qui acte la carte de stockage et la décision polyglot.
5. **Planifie une migration** : en V2, on veut découper le champ `note.body` (un gros texte) pour en extraire un champ structuré `note.tags` (mots-clés). Des **apps mobiles installées** lisent encore l'ancien format. Écris le plan **expand-contract** en étapes, et dis **ce qui déclenche l'étape CONTRACT**.

**Contrainte de portée :** on reste au niveau **décision d'architecture de données**. Tu n'écris **pas** de schéma Prisma, pas de SQL, pas de code de chiffrement (c'est le cours 10 et le module de sécurité). Tu décides *quel store possède quoi* et *comment le schéma évolue sans casser la prod*.

---

## Étapes (en friction)

1. **Classe chaque donnée par sensibilité d'abord.** Avant de penser « moteur », demande-toi pour chaque donnée : peut-elle légalement toucher le serveur ? (prénom, photo, note intime = non → niveau 1 device). C'est la confidentialité qui pilote la carte, pas la performance.
2. **Attribue un store à chaque donnée.** Pour les données device : stockage local chiffré (+ file offline). Pour les données serveur : que reste-t-il de pseudonymisé ? (UUID, date, référence enfant pseudonyme). Piège : la photo — device ou S3 serveur ?
3. **Passe la proposition du contributeur à la grille.** Pour chaque store proposé : PostgreSQL/jsonb ne couvre-t-il pas déjà ? Le besoin paie-t-il le coût opérationnel d'un store en plus ? Le produit peut-il rester low-effort avec ce store ?
4. **Sépare les deux sens du « polyglot ».** Le polyglot serveur (Mongo+ES+Redis+PG) est-il justifié ? Le polyglot device↔serveur (store local + PostgreSQL) l'est-il, et pourquoi (offline + RGPD) ?
5. **Rédige l'ADR.** Carte de stockage + décision polyglot + une conséquence assumée (ex : « la recherche V2 restera device-only, donc pas d'index serveur »).
6. **Plan de migration.** Écris les 3 étapes expand-contract pour extraire `note.tags`. Identifie **le signal hors-base** qui autorise CONTRACT (indice : le parc d'apps mobiles installées).
7. **Auto-contrôle.** Repasse la grille ci-dessous sur ta copie avant de la montrer au coach.

---

## Corrigé complet commenté

> Le corrigé porte sur les **décisions de stockage et de migration**, pas sur du code. Les « stores » sont nommés par leur rôle, pas par une config.

### 1. Carte de stockage du Journal

| Donnée | Niveau | Store propriétaire | Pourquoi |
|---|---|---|---|
| Texte de la note (contenu libre) | **1 — device chiffré** | stockage local du téléphone, chiffré | contenu potentiellement identifiant/intime → RGPD Art. 9, jamais sur le serveur |
| Photos attachées | **1 — device chiffré** | fichiers locaux chiffrés sur l'appareil | photos d'enfants = données les plus sensibles → jamais de S3 serveur en V1 |
| Métadonnée « note créée » (existence, date, compteur) | **2 — serveur pseudonymisé** | **PostgreSQL** | permet stats/sync d'état SANS contenu : `note_id (UUID)`, `child_ref (pseudonyme)`, `created_at`. Aucun texte, aucune photo. |
| File d'écritures offline | **1 — device** | store clé-valeur local + file de sync | mode hors-ligne : les notes écrites sans réseau sont mises en file, envoyées (côté device→device chiffré) au retour de connexion |
| Index de recherche (V2) | **1 — device** | index local sur les notes déchiffrées | le serveur ne voit jamais le texte → l'index doit vivre **sur l'appareil**, sinon il fuiterait le contenu |
| Agrégats d'usage (nb de notes/semaine, anonyme) | **3 — agrégat** | outil d'analytics | non ré-identifiable, découplé du métier |

**Le déclic :** la sensibilité décide **avant** le moteur. Presque tout le Journal est niveau 1 (device). Le serveur ne détient que des **métadonnées pseudonymisées**. Conséquence forte : **la recherche V2 ne peut PAS être un Elasticsearch serveur** — le serveur n'a pas le texte. La recherche est **device-only**.

### 2. Verdict sur la proposition du contributeur

| Store proposé | Verdict | Raison |
|---|---|---|
| **MongoDB** pour les notes | **rejeté** | le contenu est niveau 1 (device), il ne va pas sur un serveur — quel qu'il soit. Et côté serveur, les métadonnées pseudonymisées sont relationnelles → PostgreSQL. Le « schéma flexible » ne résout aucun problème réel ici. |
| **S3** pour les photos | **rejeté en V1** | photos = niveau 1, chiffrées sur l'appareil. Les mettre sur S3 (même chiffré) ajoute un store à opérer et rapproche la donnée du serveur. Non justifié tant que le device suffit. |
| **Elasticsearch** pour la recherche | **rejeté** | double faute : (a) le serveur n'a pas le texte à indexer ; (b) même s'il l'avait, la volumétrie (notes d'une famille) ne justifie jamais un cluster ES. Recherche = index **local** sur device. |
| **Redis** pour la file offline | **rejeté (mauvais niveau)** | la file offline vit **sur l'appareil** (store local + file de sync), pas sur un Redis serveur. Un parent hors-réseau ne peut pas écrire dans un Redis distant, par définition. |

### 3. Polyglot ou mono-store ?

- **Polyglot serveur : NON.** Côté serveur, **mono-store PostgreSQL**. Aucun des besoins ne sort du relationnel, et chaque store en plus violerait le principe « jamais une charge mentale ». C'est un polyglot **refusé sciemment**.
- **Polyglot device ↔ serveur : OUI, et il est imposé.** Le vrai découpage n'est pas « quel moteur serveur » mais « device vs serveur », dicté par (a) la confidentialité (le contenu ne peut pas monter) et (b) l'offline (il faut un store local qui marche sans réseau). Ce polyglot-là est **justifié par des contraintes**, pas par un confort — c'est la bonne sorte.

### 4. Mini-ADR (exemple attendu)

```
ADR-13 — Stockage du module Journal de famille
Contexte : le Journal contient des données Art. 9 (prénoms, photos, notes intimes),
  fonctionne offline, et est maintenu par une personne (principe : jamais une charge).
Décision :
  - Contenu (texte, photos) → niveau 1, device uniquement, chiffré. Jamais sur le serveur.
  - Métadonnées pseudonymisées (UUID note, ref enfant pseudonyme, date) → PostgreSQL (niveau 2).
  - File d'écritures offline + index de recherche → stores LOCAUX sur l'appareil.
  - Agrégats anonymes → analytics (niveau 3).
Polyglot : mono-store PostgreSQL côté serveur (refus assumé de Mongo/ES/Redis serveur).
  Polyglot device↔serveur assumé (imposé par offline + confidentialité).
Conséquence : la recherche V2 est device-only (le serveur n'a pas le texte).
  → pas d'index serveur, pas d'Elasticsearch, coût opérationnel serveur minimal.
```

### 5. Plan de migration expand-contract (extraction de `note.tags`)

Contexte : en V2 on veut un champ structuré `note.tags` (mots-clés) à côté du `note.body` existant. Des **apps mobiles installées** lisent encore le format sans `tags`.

```
Déploiement 1 — EXPAND
  - le schéma accepte les notes AVEC ou SANS `tags` (champ optionnel, défaut vide)
  - l'ancien code ignore `tags`, le nouveau sait le lire → rien ne casse
  - (rétro-remplissage éventuel des anciennes notes fait progressivement, pas bloquant)

Déploiement 2 — MIGRATE
  - la nouvelle version mobile écrit `tags` en plus de `body`
  - anciens et nouveaux clients coexistent : les deux formats circulent
  - le backend reste tolérant aux deux

Déploiement 3 — CONTRACT
  - on retire la tolérance à l'ancien format (ou on supprime un champ devenu inutile)
  - NE se fait QUE lorsque le parc d'apps installées lisant l'ancien format est négligeable
```

**Signal qui déclenche CONTRACT :** pas la base — le **taux d'adoption de la nouvelle version mobile** (télémétrie de versions d'app en circulation). Tant qu'un nombre non négligeable de téléphones lit l'ancien format, on **ne contracte pas**. C'est le cœur de la décision : la migration est une **coordination schéma ↔ déploiements ↔ clients installés**, pas un simple `ALTER`.

**Pourquoi ce corrigé est correct :** la carte est pilotée par la **confidentialité d'abord** (presque tout en device niveau 1) ; le serveur reste **mono-store PostgreSQL** avec un coût opérationnel minimal, cohérent avec le principe low-effort ; le polyglot est refusé côté serveur mais assumé sur l'axe device↔serveur là où des contraintes l'imposent ; et la migration V2 est **non-cassante** avec une bascule pilotée par le parc client, pas par la base.

---

## Grille d'évaluation (coach)

| Critère | Attendu | ✅ / ❌ |
|---|---|---|
| Sensibilité avant moteur | Chaque donnée est classée par niveau de confidentialité AVANT de choisir un store | |
| Carte de stockage complète | Note, photo, métadonnée, file offline, index recherche, agrégats — chacun a un store et une raison | |
| Contenu jamais sur le serveur | Texte + photos placés en niveau 1 device ; seules des métadonnées pseudonymisées côté serveur | |
| Verdict contributeur justifié | Chaque store proposé (Mongo/S3/ES/Redis) tranché avec la raison (coût ops, mauvais niveau, PG suffit) | |
| Deux sens du polyglot distingués | Polyglot serveur (refusé) vs polyglot device↔serveur (assumé, imposé par offline+RGPD) | |
| Recherche device-only | A repéré que le serveur n'a pas le texte → pas d'ES serveur, index local | |
| Migration expand-contract | 3 étapes correctes ET compatibilité N/N-1 explicitée | |
| Signal de CONTRACT | La bascule dépend du parc d'apps installées, pas de la base | |

Seuil : **6/8** pour valider. En dessous, refais la carte de stockage (étapes 1-2) en classant la sensibilité **avant** de nommer un moteur.

---

## Variante J+30 (fading)

**Même type d'exercice, contraintes ajoutées :**

1. **En 25 minutes, de mémoire**, sans relire ce corrigé ni le module 13.
2. **Nouveau besoin :** TribuZen ajoute la **Gazette hebdomadaire** (V2) — un récapitulatif généré chaque dimanche à partir des complétions de routines de la semaine, envoyé aux co-référents. Il faut : lire beaucoup de complétions (agrégation), générer un document, le stocker, l'envoyer.
3. **Contrainte supplémentaire :** ici les lectures d'agrégats sont lourdes et périodiques. **Justifie** si une **vue matérialisée** ou un **cache** se justifie — ou si un simple `SELECT` planifié suffit (attention à ne pas sur-architecturer un job hebdomadaire). Décide, et dis pourquoi tu **n'ajoutes pas** de store.
4. **Piège à traiter en une phrase :** la Gazette manipule-t-elle des données niveau 1 (prénoms) ? Si oui, où doit se faire l'assemblage final avec les prénoms — serveur ou device ?

**Critère de réussite :** carte de stockage + décision « vue matérialisée / cache / rien » justifiée par la fréquence (hebdo) et la charge, + placement correct de l'assemblage des prénoms (device), produits en 25 min, avec au moins une décision de **non-ajout** de store argumentée.

---

## Application TribuZen

Ce lab prépare les décisions de stockage réelles du backend `smaurier/tribuzen-api` et de l'app `smaurier/tribuzen`.

- La **carte de stockage à 3 niveaux** (device chiffré / serveur pseudonymisé / agrégats) est la décision d'architecture de données **centrale** de TribuZen, dérivée de la spec (§6 Architecture confidentialité, §7 Data model).
- Le **mono-store PostgreSQL serveur** est acté : il matérialise le principe « jamais une charge mentale ni financière » (un seul store à opérer sur un VPS frugal).
- Le plan **expand-contract** servira à chaque évolution de schéma serveur, car des apps mobiles installées liront l'API pendant des mois — la compatibilité N/N-1 n'est pas optionnelle.

**Commit cible (doc d'archi) :**
```
docs(data): carte de stockage Journal — device chiffré + PG mono-store + plan de migration V2
```
