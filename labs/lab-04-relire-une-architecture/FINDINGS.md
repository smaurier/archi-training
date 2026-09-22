# Findings — revue de `NotificationPolicy.ts`

À remplir en lisant UNIQUEMENT `src/domain/NotificationPolicy.ts` et
`src/infrastructure/EmailGateway.ts` — rien d'autre, pas encore les tests. Le correcteur lit
ce fichier avant ton code.

1. **`NotificationPolicy.ts` vit dans `domain/`.** Liste, avant de répondre à la question
   suivante, ce qu'un fichier de `domain/` a le droit d'importer (relis le module 06 si
   besoin — architecture hexagonale — et le lab 01 de ce cours).

2. **Que voit `shouldNotify` que le domaine ne devrait normalement pas savoir ?** Sois
   précis : quelle ligne, quel import.

3. **Deux conséquences concrètes de ce problème** (pas des généralités — des cas précis) :
   - Comment testerais-tu `shouldNotify` en isolation, aujourd'hui, sans toucher à
     `EmailGateway` ? Est-ce possible tel quel ?
   - Le produit veut notifier par SMS en plus de l'email. `shouldNotify` peut-elle servir
     pour ce nouveau canal sans modification ?

4. **La correction que tu proposes**, en une phrase : qu'est-ce qui change de forme (pas
   juste "je répare"), et où va la responsabilité qui quitte le domaine ?
