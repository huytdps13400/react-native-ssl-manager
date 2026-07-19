# Autonomous test report — example-expo SSL pinning (sanitized)

Demo/public hosts only. **No customer API URLs or production pins** are stored in this repo.

## What is verified in CI / local automation

| Check | How |
|-------|-----|
| Unit / contract tests | `jest` |
| Rebuild pipeline script | `npm run test:rebuild:verify` |
| Demo app UI | Maestro / Argent against example-expo |
| Live pin match | Only when `ssl_config.json` uses real pins **locally** (do not commit) |

## Secrets policy

- Commit only **placeholder** pins (`api.example.com`, etc.)
- Keep real `ssl_config.json` / GraphQL endpoints out of git
- Prefer `SSL_MANAGER_SKIP_POSTINSTALL=1` in customer monorepos
