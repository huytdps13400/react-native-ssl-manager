# pnpm monorepo fixture

Minimal **pnpm** workspace used to validate `react-native-ssl-manager` in the
layout customers hit:

```text
fixtures/pnpm-monorepo/
  pnpm-workspace.yaml
  apps/mobile/          ← Expo-style app package
    package.json        ← depends on file:../../.. (this library)
    app.json            ← config plugin registered
    ssl_config.json
    metro.config.js     ← singleton react / RN / nitro
    android/app/        ← stub gradle for path tests
```

## Quick validate (no full install)

From the **library repo root**:

```bash
npm run test:monorepo
# or
node scripts/monorepo-setup.js --app fixtures/pnpm-monorepo/apps/mobile
```

## Full pnpm install (optional, network)

```bash
cd fixtures/pnpm-monorepo
SSL_MANAGER_SKIP_POSTINSTALL=1 pnpm install
pnpm --filter @fixture/mobile exec node ../../../scripts/monorepo-setup.js
```

## Consumer checklist

1. Install **in the app package**, not only the workspace root  
   `pnpm add react-native-ssl-manager react-native-nitro-modules --filter @your/app`
2. `ssl_config.json` next to that app’s `app.json`
3. Expo plugin in `app.json` → `npx expo prebuild --clean` from the app dir
4. Set `SSL_MANAGER_SKIP_POSTINSTALL=1` in CI / shell
5. Bare Android: run `npx react-native-ssl-manager monorepo-setup` and paste the apply line
