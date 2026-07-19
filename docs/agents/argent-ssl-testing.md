# Argent MCP — SSL pin testing recipe (example-expo)

## Prerequisites

```bash
# Terminal 1 — Metro
cd example-expo && npx expo start --dev-client --port 8081

# Terminal 2 — rebuild when ssl_config.json changes
cd .. && npm run test:rebuild
```

- Simulator booted
- Bundle id: `com.huymobilekyanondigital.exampleexpo`
- `ssl_config.json` should contain **only demo/placeholder pins** in git

## Argent flow

1. `list-devices` → pick iOS `udid`
2. `boot-device` with that `udid`
3. `launch-app` `com.huymobilekyanondigital.exampleexpo`
4. Connect Metro (dev-client deep link)
5. `debugger-connect` port `8081`
6. `describe` → tap by label / `testID`:
   - `btn-feature-suite`
   - `btn-mitm-direct` / `btn-mitm-proxy`
   - public HTTPS smoke buttons
7. Wait for Log lines; optional `native-network-logs`

## Pass criteria (demo app)

| Check | Expected |
|-------|----------|
| Native status | Nitro: **linked** |
| SSL Pinning | **ENABLED** after cold start (default) |
| Feature suite | all green |
| MITM direct | app steps OK |
| Public HTTPS | HTTP 200 (demo host) |

## Proxyman (manual)

Use **your** pinned production hosts from a private `ssl_config.json` (not committed).

1. Pin OFF → restart → request → body visible  
2. Pin ON → restart → TLS fail under MITM  
3. Pin ON, no proxy → 200 when pins match live certs  

## CLI

```bash
npm run test:rebuild:verify
npm run test:rebuild
```
