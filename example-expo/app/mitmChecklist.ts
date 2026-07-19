/**
 * In-app MITM / pin ON-OFF checklist for rebuild testing.
 * Uses a public demo host only — no customer API URLs or pins.
 */

import { Platform } from 'react-native';
import {
  getUseSSLPinning,
  isSSLManagerAvailable,
  setUseSSLPinning,
} from 'react-native-ssl-manager';

export type MitmStepId =
  | 'linked'
  | 'pinOff'
  | 'fetchOff'
  | 'pinOn'
  | 'fetchOn'
  | 'fetchOnHappy';

export type MitmStepResult = {
  id: MitmStepId;
  title: string;
  ok: boolean;
  detail: string;
  needsRestart?: boolean;
};

/** Public demo URL (not a customer API). */
const DEMO_URL = 'https://jsonplaceholder.typicode.com/posts/1';

export async function fetchDemoHttps(): Promise<{
  ok: boolean;
  status?: number;
  ms: number;
  summary: string;
}> {
  const start = Date.now();
  try {
    const response = await fetch(DEMO_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const ms = Date.now() - start;
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      ms,
      summary: text.slice(0, 120),
    };
  } catch (error) {
    return {
      ok: false,
      ms: Date.now() - start,
      summary: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Automated half of the MITM matrix (app-side only).
 * Proxyman still requires a human for SSL-proxy intercept tests.
 */
export async function runMitmAppSteps(options: {
  mode: 'proxy' | 'direct';
}): Promise<MitmStepResult[]> {
  const results: MitmStepResult[] = [];
  const restartHint =
    Platform.OS === 'ios'
      ? 'iOS: force-quit and reopen the app for TrustKit toggle to fully apply'
      : 'Android: next request should use the new pin state';

  const linked = isSSLManagerAvailable();
  results.push({
    id: 'linked',
    title: 'Nitro module linked',
    ok: linked,
    detail: linked ? 'isSSLManagerAvailable() = true' : 'Rebuild required',
  });
  if (!linked) {
    return results;
  }

  await setUseSSLPinning(false);
  const off = await getUseSSLPinning();
  results.push({
    id: 'pinOff',
    title: 'setUseSSLPinning(false)',
    ok: off === false,
    detail: off === false ? `flag=${off}` : `flag still ${off}`,
    needsRestart: Platform.OS === 'ios',
  });

  const fetchOff = await fetchDemoHttps();
  results.push({
    id: 'fetchOff',
    title: `Demo HTTPS with pin flag OFF (${options.mode})`,
    ok: fetchOff.ok,
    detail: fetchOff.ok
      ? `HTTP ${fetchOff.status} ${fetchOff.ms}ms`
      : `FAIL ${fetchOff.ms}ms — ${fetchOff.summary} (${restartHint})`,
    needsRestart: Platform.OS === 'ios' && !fetchOff.ok,
  });

  await setUseSSLPinning(true);
  const on = await getUseSSLPinning();
  results.push({
    id: 'pinOn',
    title: 'setUseSSLPinning(true)',
    ok: on === true,
    detail: on === true ? `flag=${on}` : `flag still ${on}`,
    needsRestart: Platform.OS === 'ios',
  });

  const fetchOn = await fetchDemoHttps();
  if (options.mode === 'direct') {
    results.push({
      id: 'fetchOnHappy',
      title: 'Demo HTTPS pin ON, no MITM (expect 200 for non-enforced host)',
      ok: fetchOn.ok,
      detail: fetchOn.ok
        ? `HTTP ${fetchOn.status} ${fetchOn.ms}ms`
        : `FAIL ${fetchOn.ms}ms — ${fetchOn.summary}`,
    });
  } else {
    results.push({
      id: 'fetchOn',
      title: 'Demo HTTPS pin ON + MITM (confirm in Proxyman after restart)',
      ok: true,
      detail: fetchOn.ok
        ? `Still HTTP ${fetchOn.status} this process — ${restartHint}`
        : `Blocked/failed: ${fetchOn.summary}`,
      needsRestart: fetchOn.ok && Platform.OS === 'ios',
    });
  }

  return results;
}

export function mitmHumanSteps(): string[] {
  return [
    '1. Run: npm run test:rebuild (from library root) — verifies pins + rebuilds app',
    '2. Install Proxyman cert on simulator; SSL Proxying for your pinned host(s)',
    '3. App: Pin OFF → kill app → reopen → request → Proxyman shows body',
    '4. App: Pin ON → kill app → reopen → request → TLS fail in Proxyman',
    '5. Disable Proxyman SSL → Pin ON → request → HTTP 200 when pins match live certs',
  ];
}
