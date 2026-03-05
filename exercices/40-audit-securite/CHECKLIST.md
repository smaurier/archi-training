# Checklist — Exercice 40 : Audit de sécurité

- [ ] npm audit exécuté, CVE triees par sévérité
- [ ] Plan de remediation pour chaque CVE critique
- [ ] Scan de secrets (trufflehog ou gitleaks)
- [ ] Cookies : HttpOnly, Secure, SameSite verifies
- [ ] CORS : pas de wildcard *
- [ ] TLS 1.2+ uniquement
- [ ] Review code : SQL injection (concatenation)
- [ ] Review code : XSS (innerHTML, v-html)
- [ ] Review code : secrets hardcodes
- [ ] Review code : PII dans les logs
- [ ] Rapport d'audit avec executive summary
- [ ] Findings classes par sévérité (Critical/High/Medium/Low)
- [ ] Remediation + effort pour chaque finding

## Bonus
- [ ] OWASP ZAP scan
- [ ] Checks sécurité dans CI/CD
- [ ] SBOM généré
