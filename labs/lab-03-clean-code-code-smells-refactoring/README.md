# Lab 03 — Diagnostiquer les smells et planifier le refactoring

> **Outcome :** à la fin, tu sais lire un extrait TribuZen malade, **nommer** chaque code smell (avec sa famille), l'**associer** à la technique de refactoring adéquate, et **écrire le plan** de nettoyage en petits pas sûrs à comportement constant — plus la décision « refactorer ou pas ».
> **Vrai outil :** ta tête + le catalogue [refactoring.guru/refactoring](https://refactoring.guru/refactoring) (smells + techniques) et **Refactoring** de Fowler. C'est un exercice de **conception et de décision**, pas d'exécution.
> **Feedback :** le coach valide en session. **Aucun harnais, aucun test-runner, aucun code à faire tourner** : ici le refactoring se **raisonne** (on planifie), il ne s'exécute pas. Le geste d'exécution en petits pas verts appartiendra au cours 06 — testing.

---

## Énoncé

TribuZen a un module « invitations » : quand un membre invite un proche à rejoindre la tribu, le service décide s'il peut, envoie le mail, calcule un bonus de parrainage et journalise. Le code ci-dessous **fonctionne en production**, mais l'équipe met une demi-journée à ajouter la moindre règle et casse régulièrement autre chose.

Tu ne réécris **pas** le code dans ce lab. Tu produis **trois livrables écrits** (voir *Étapes*) : un diagnostic, un plan, une décision.

```typescript
// invitation.service.ts — le code fourni (à diagnostiquer, PAS à exécuter)
class InvitationService {
  db: any;
  mailer: any;

  constructor(db: any, mailer: any) {
    this.db = db;
    this.mailer = mailer;
  }

  // envoie une invitation et retourne un code : 0 ok, -1 quota, -2 déjà membre, -3 email invalide
  invite(inviter: any, email: string, kind: number): number {
    // kind : 1 = famille, 2 = ami, 3 = pro
    if (email.indexOf('@') > 0 && email.indexOf('.') > 0) {
      if (this.db.getTribe(inviter.tribeId).getMembers().getCount() < 50) {
        let already = false;
        const members = this.db.getTribe(inviter.tribeId).getMembers().getAll();
        for (let i = 0; i < members.length; i++) {
          if (members[i].email == email) { already = true; }
        }
        if (already == false) {
          let bonus = 0;
          if (kind == 1) { bonus = 100; }
          else if (kind == 2) { bonus = 50; }
          else if (kind == 3) { bonus = 20; }
          if (inviter.premium == true) { bonus = bonus * 2; }
          // envoi
          const subject = 'Rejoins ' + this.db.getTribe(inviter.tribeId).name + ' sur TribuZen';
          this.mailer.send(email, subject, 'Clique ici ...');
          this.db.saveInvitation({ email: email, by: inviter.id, k: kind, b: bonus, ts: Date.now() });
          inviter.pendingBonus = inviter.pendingBonus + bonus;
          this.db.saveUser(inviter);
          this.log('invite ok ' + email + ' bonus ' + bonus);
          return 0;
        } else {
          return -2;
        }
      } else {
        return -1;
      }
    } else {
      return -3;
    }
  }

  log(m: string) { console.log('[INVITATION] ' + m); }
}
```

**Contexte pour la décision :** ce module est touché **presque chaque sprint** (nouveaux types d'invitation, nouvelles règles de quota selon l'offre, futur système de bonus à paliers). Il n'a **aucun test** aujourd'hui.

---

## Étapes (en friction — tu produis les livrables, ne les lis pas passivement)

1. **Livrable A — Table de diagnostic.** Repère **au moins 6 smells distincts**. Pour chacun, remplis une ligne : `Ligne(s) | Symptôme observé | Smell nommé | Famille (Bloaters / OO Abusers / Change Preventers / Dispensables / Couplers) | Refactoring visé`. Interdiction d'écrire « code moche » : nomme précisément (ex. *Message Chains*, pas « trop de points »).
2. **Livrable B — Plan de refactoring en petits pas.** Ordonne tes refactorings en une **séquence numérotée** où chaque pas :
   - est **une seule** technique nommée (Extract Method, Replace Magic Number…),
   - préserve le comportement (mêmes codes de retour 0/-1/-2/-3 en sortie),
   - est suivi d'un « ✅ tests verts → commit ».
   Précise **le pas 0** : que fais-tu *avant* de toucher au code, sachant qu'il n'y a aucun test ?
3. **Livrable C — Décision « refactorer ou pas ? ».** En 3-5 lignes, tranche : faut-il refactorer ce module maintenant ? Justifie avec les critères du module (règle de trois, avant-feature, deadline, code réécrit/figé, ROI, dette technique).
4. **Contrainte casquettes :** ton plan ne doit **ajouter aucune fonctionnalité** ni corriger aucun bug de comportement. Si tu repères un vrai bug (il y en a un potentiel dans la validation d'email), tu le **notes à part** comme « feature/fix séparé, autre casquette » — tu ne le corriges pas dans le plan de refactoring.

---

## Grille d'évaluation (auto-éval + coach)

| Critère | Insuffisant | Attendu | Excellent |
|---|---|---|---|
| **Diagnostic (A)** | < 4 smells, familles absentes/fausses | ≥ 6 smells nommés + familles correctes | Repère aussi les couples-miroirs et hiérarchise par gravité |
| **Couplage smell→refactoring** | remèdes vagues ou inadaptés | chaque smell a une technique nommée pertinente | alternatives justifiées (ex. table vs polymorphisme) |
| **Plan en petits pas (B)** | pas géants ou multi-techniques | séquence de pas atomiques, ordre sûr, pas 0 = filet | ordre optimisé (renommage/typage d'abord, structure ensuite) |
| **Comportement constant** | le plan change des sorties | codes de retour préservés à chaque pas | golden master explicitement décrit comme filet |
| **Une casquette à la fois** | mélange refactoring + fix/feature | refactoring pur ; le bug noté à part | explique *pourquoi* séparer (test rouge indéchiffrable) |
| **Décision (C)** | « toujours refactorer » sans critère | tranche avec ≥ 2 critères du module | pèse ROI vs dette, propose un périmètre (ce sprint / plus tard) |

**Smells attendus dans un bon diagnostic (référence coach — ne pas montrer avant l'auto-éval) :**
- `email.indexOf('@') > 0 && indexOf('.') > 0` → validation fragile + **Primitive Obsession** (email est un `string` nu) → *Replace Data Value with Object* (`Email` value object). (Le vrai défaut : la validation est **trop laxiste** — elle exige juste un `@` et un `.` présents, donc laisse passer des invalides comme `"a.@b"` ou `"a@.b"` ; ce fix se note **à part**.)
- `db.getTribe(...).getMembers().getCount()` et `.getAll()` → **Message Chains** (Couplers, loi de Demeter violée) → *Hide Delegate* / méthode sur `Tribe`.
- Boucle `for` + flag `already` → **Duplicate/awkward logic** + control flag → *Remove Control Flag* / `members.some(m => ...)`, ou mieux une query `tribe.hasMember(email)`.
- `kind == 1/2/3`, `bonus = 100/50/20`, `< 50` → **Magic Numbers** + **Switch Statements** (chaîne d'`else if` sur un type) → *Replace Magic Number with Symbolic Constant* + table/polymorphisme.
- `invite()` valide + vérifie quota + déduplique + calcule bonus + envoie mail + persiste + journalise → **Long Method** (Bloaters) + **Divergent Change** (plusieurs raisons de changer) → *Extract Method* ×N + SRP (module 01).
- Imbrication `if/else` profonde → *Replace Nested Conditional with Guard Clauses* (Fail Fast).
- `return 0/-1/-2/-3` → **codes d'erreur** → *Replace Error Code with Exception* (à ranger : change la signature → frontière entre refactoring et petite évolution d'API, à discuter).
- `db: any`, `mailer: any`, `k`, `b`, `ts` → typage absent + noms abrégés → *Rename* + typage.

---

## Coach — comment mener la session

- **Fais nommer avant de laisser refactorer.** Si Sylvain saute au « je réécrirais ça comme… », ramène-le au diagnostic : *quel smell, quelle famille ?* Le vocabulaire précis est l'objectif du lab.
- **Sonde le pas 0.** « Il n'y a aucun test. Ton premier pas, c'est quoi ? » Réponse visée : écrire un **golden master** qui fige les sorties (0/-1/-2/-3) pour les cas actuels *avant* de toucher au code. S'il commence à refactorer sans filet → drapeau rouge, c'est le piège n°2 du module.
- **Traque le mélange de casquettes.** La validation `indexOf('@') > 0 && indexOf('.') > 0` cache un bug : elle est **trop laxiste** (elle vérifie seulement la *présence* d'un `@` et d'un `.`, jamais leur position), donc elle **accepte** des emails mal formés comme `"a.@b"` ou `"a@.b"`. Vérifie qu'il le **note comme fix séparé** et ne le glisse pas dans le plan de refactoring.
- **Challenge la décision C.** S'il répond « on refactore toujours », rappelle le ROI : ici le module est touché chaque sprint → refactorer se justifie **fort** (avant-feature + règle de trois largement dépassée). Contre-exemple à lui faire formuler : un module figé jamais retouché → on laisse.
- **Relance si silence.** Questions d'amorce : « Combien de raisons *différentes* de modifier `invite()` vois-tu ? » (→ Divergent Change) ; « Combien de points d'affilée dans `db.getTribe().getMembers().getCount()` ? » (→ Message Chains).
- **Signaux de maîtrise :** il hiérarchise (renommer/typer d'abord car sans risque, structure ensuite), il cite les couples-miroirs, il sépare spontanément refactoring et fix.

---

## Variante J+30 (fading)

Sans rouvrir ce lab ni tes notes, en **25 minutes** :

1. On te donne **un extrait différent** (le service `DigestService` qui construit le récap hebdomadaire de la tribu : agrège les events, formate un HTML, choisit une fréquence selon l'offre, envoie). Produis directement la **table de diagnostic** (≥ 5 smells + familles) **de mémoire**, sans le catalogue ouvert.
2. Écris le plan en **exactement 5 pas** maximum, chacun une seule technique, pas 0 inclus.
3. **Contrainte ajoutée :** l'un des pas doit être *Introduce Parameter Object* **ou** *Replace Conditional with Polymorphism* — repère où il s'applique et justifie.
4. Tranche la décision « refactorer maintenant ? » en **2 phrases**, un seul critère décisif.

**Réussi si :** familles correctes sans support, plan à comportement constant, pas 0 = filet de test, et la décision cite un critère précis (pas « c'est plus propre »).

---

## Application TribuZen

Dans le repo `smaurier/tribuzen`, ce lab prépare le vrai nettoyage du module invitations :

```
tribuzen/
  api/src/invitations/invitation.service.ts     # cible du refactoring (après golden master)
  api/src/invitations/email.vo.ts               # Value Object Email (sortie de Primitive Obsession)
  api/test/invitation.golden.spec.ts            # golden master : fige 0/-1/-2/-3 avant de toucher au code
```

**Ordre de travail réel :** (1) écrire le golden master → (2) exécuter le plan pas-à-pas, commit à chaque pas vert → (3) *ensuite seulement*, dans un commit séparé (autre casquette), corriger la validation d'email et faire évoluer les codes de retour vers des exceptions.

**Commit cible (refactoring pur, sans changement de comportement) :**
```
refactor(invitations): extract methods + Email VO + table de bonus, comportement constant (golden master vert)
```
