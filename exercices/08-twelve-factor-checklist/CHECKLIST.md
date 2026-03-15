# Checklist — Exercice 08 : 12-Factor Checklist

## Audit

- [ ] J'ai identifie la violation du facteur III (Config) : secrets hardcodes
- [ ] J'ai identifie la violation du facteur VI (Processes) : fichiers sur le serveur (`uploadDir`)
- [ ] J'ai identifie la violation du facteur XI (Logs) : logs dans un fichier au lieu de stdout
- [ ] J'ai identifie la violation du facteur V (Build/Release/Run) : deploy = git pull + build sur le serveur
- [ ] J'ai identifie la violation du facteur VIII (Concurrency) : cron dans le même process que l'API
- [ ] J'ai identifie la violation du facteur XII (Admin) : cleanup dans le process principal

## Corrections

- [ ] Config via `process.env` (où `@nestjs/config` avec `.env` non commite)
- [ ] Fichiers uploades vers S3 (pas sur le filesystem local)
- [ ] Logs en stdout JSON (pas de fichier log)
- [ ] Build via CI/CD (Docker image immutable, pas de git pull en prod)
- [ ] Cron job dans un process séparé (worker, pas dans l'API)
- [ ] Processes stateless (rien en mémoire entre les requêtes)

## Checklist complete

- [ ] J'ai rempli les 12 lignes du tableau
- [ ] Chaque violation à une correction concrete
- [ ] Les corrections sont applicables (pas juste théoriques)

## Bonus

- [ ] J'ai propose un Dockerfile multi-stage
- [ ] J'ai ajoute une idempotency key pour le paiement
