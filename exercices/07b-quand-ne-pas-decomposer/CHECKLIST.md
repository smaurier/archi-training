# Checklist — Exercice 07b : Quand NE PAS decomposer

## Cas A — Startup MVP

- [ ] J'ai recommande de NE PAS passer en microservices
- [ ] J'ai cite le ratio équipe/services (3 devs pour N services = non viable)
- [ ] J'ai cite le cout operationnel vs le gain (500 users = pas de problème de scale)
- [ ] J'ai propose un monolithe modulaire comme alternative

## Cas B — Scale-up en croissance

- [ ] J'ai recommande une decomposition progressive (pas Big Bang)
- [ ] J'ai identifie les symptomes reels (deploy lent, conflits de merge, équipes bloquees)
- [ ] J'ai propose de commencer par un monolithe modulaire avant les microservices
- [ ] J'ai propose un ordre de migration (modules les plus independants d'abord)

## Cas C — Feature isolee haute performance

- [ ] J'ai recommande d'extraire UNIQUEMENT le search (pas tout decomposer)
- [ ] J'ai justifie par les besoins de scaling différents (search = CPU intensive)
- [ ] J'ai note que le reste peut rester monolithe
- [ ] J'ai propose un modèle "monolithe + 1 service" au lieu de "full microservices"

## Decision framework

- [ ] J'ai applique le framework aux 3 cas de manière cohérente
- [ ] J'ai pris en compte le cout operationnel pour chaque cas
- [ ] J'ai pris en compte l'expertise DevOps de l'équipe
- [ ] Mes decisions ne sont pas dogmatiques ("microservices = bien" ou "monolithe = bien")
