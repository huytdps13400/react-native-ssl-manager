import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getPinnedDomains,
  getUseSSLPinning,
  isSSLManagerAvailable,
  setUseSSLPinning,
} from 'react-native-ssl-manager';
import {
  runFeatureSuite,
  summarizeSuite,
  type FeatureCaseResult,
} from './featureSuite';
import {
  mitmHumanSteps,
  runMitmAppSteps,
  type MitmStepResult,
} from './mitmChecklist';

interface TestResult {
  url: string;
  status: 'success' | 'error' | 'loading';
  message: string;
  timestamp: string;
  sslEnabled: boolean;
}

export default function App() {
  const [isSSLEnabled, setIsSSLEnabled] = useState(false);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [featureResults, setFeatureResults] = useState<FeatureCaseResult[]>([]);
  const [mitmResults, setMitmResults] = useState<MitmStepResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTest, setCurrentTest] = useState('');

  const addTestResult = useCallback((result: TestResult) => {
    setTestResults((prev) => [result, ...prev.slice(0, 14)]);
  }, []);

  const refreshNativeStatus = useCallback(async () => {
    const available = isSSLManagerAvailable();
    setNativeAvailable(available);
    if (!available) {
      setIsSSLEnabled(false);
      setDomains([]);
      return;
    }
    try {
      const [enabled, pinned] = await Promise.all([
        getUseSSLPinning(),
        getPinnedDomains(),
      ]);
      setIsSSLEnabled(enabled);
      setDomains(pinned);
    } catch (error) {
      addTestResult({
        url: 'Refresh status',
        status: 'error',
        message: String(error),
        timestamp: new Date().toLocaleTimeString(),
        sslEnabled: false,
      });
    }
  }, [addTestResult]);

  useEffect(() => {
    (async () => {
      await refreshNativeStatus();
      const available = isSSLManagerAvailable();
      addTestResult({
        url: 'SSL Manager Initialization',
        status: available ? 'success' : 'error',
        message: available
          ? `Nitro linked. Pinning ${
              (await getUseSSLPinning().catch(() => false))
                ? 'ENABLED'
                : 'DISABLED'
            }`
          : 'Native module NOT available — rebuild the app',
        timestamp: new Date().toLocaleTimeString(),
        sslEnabled: false,
      });
    })();
  }, [addTestResult, refreshNativeStatus]);

  const toggleSSLPinning = async (value: boolean) => {
    try {
      setIsSSLEnabled(value);
      await setUseSSLPinning(value);
      addTestResult({
        url: 'SSL Setting Change',
        status: 'success',
        message: `SSL Pinning ${value ? 'ENABLED' : 'DISABLED'}`,
        timestamp: new Date().toLocaleTimeString(),
        sslEnabled: value,
      });
      if (Platform.OS === 'ios') {
        Alert.alert(
          'iOS: restart required',
          'TrustKit applies pin on/off on the next cold start.\n\nForce-quit this app and reopen before testing with Proxyman.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      addTestResult({
        url: 'SSL Setting Change',
        status: 'error',
        message: `Failed: ${error}`,
        timestamp: new Date().toLocaleTimeString(),
        sslEnabled: isSSLEnabled,
      });
    }
  };

  const testApiCall = async (url: string, description: string) => {
    setIsLoading(true);
    setCurrentTest(description);
    const startTime = Date.now();
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const responseTime = Date.now() - startTime;
      const text = await response.text();
      addTestResult({
        url: description,
        status: response.ok ? 'success' : 'error',
        message: `HTTP ${response.status} (${responseTime}ms)\nSSL: ${
          isSSLEnabled ? 'ON' : 'OFF'
        }\n${text.slice(0, 120)}…`,
        timestamp: new Date().toLocaleTimeString(),
        sslEnabled: isSSLEnabled,
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      addTestResult({
        url: description,
        status: 'error',
        message: `FAILED (${responseTime}ms)\nSSL: ${
          isSSLEnabled ? 'ON' : 'OFF'
        }\n${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toLocaleTimeString(),
        sslEnabled: isSSLEnabled,
      });
    } finally {
      setIsLoading(false);
      setCurrentTest('');
    }
  };

  const onRunFeatureSuite = async () => {
    setIsLoading(true);
    setCurrentTest('Feature Suite');
    try {
      const results = await runFeatureSuite();
      setFeatureResults(results);
      const { passed, failed, total } = summarizeSuite(results);
      await refreshNativeStatus();
      addTestResult({
        url: 'Feature Suite',
        status: failed === 0 ? 'success' : 'error',
        message: `${passed}/${total} passed` + (failed ? ` (${failed} failed)` : ''),
        timestamp: new Date().toLocaleTimeString(),
        sslEnabled: isSSLEnabled,
      });
      Alert.alert(
        'Feature Suite',
        `${passed}/${total} passed` +
          (failed
            ? `\nFailed: ${results
                .filter((r) => !r.ok)
                .map((r) => r.title)
                .join(', ')}`
            : '\nAll automated in-app checks green.')
      );
    } catch (error) {
      addTestResult({
        url: 'Feature Suite',
        status: 'error',
        message: String(error),
        timestamp: new Date().toLocaleTimeString(),
        sslEnabled: isSSLEnabled,
      });
    } finally {
      setIsLoading(false);
      setCurrentTest('');
    }
  };

  const onRunMitmDirect = async () => {
    setIsLoading(true);
    setCurrentTest('MITM direct (no proxy)');
    try {
      const results = await runMitmAppSteps({ mode: 'direct' });
      setMitmResults(results);
      await refreshNativeStatus();
      const failed = results.filter((r) => !r.ok).length;
      addTestResult({
        url: 'MITM checklist (direct)',
        status: failed === 0 ? 'success' : 'error',
        message: `${results.length - failed}/${results.length} app steps OK`,
        timestamp: new Date().toLocaleTimeString(),
        sslEnabled: true,
      });
      Alert.alert(
        'MITM direct path',
        failed === 0
          ? 'Pin ON + real cert: GraphQL OK.\n\nNext: enable Proxyman and use "MITM + proxy steps".'
          : results
              .filter((r) => !r.ok)
              .map((r) => `• ${r.title}: ${r.detail}`)
              .join('\n')
      );
    } catch (error) {
      addTestResult({
        url: 'MITM checklist (direct)',
        status: 'error',
        message: String(error),
        timestamp: new Date().toLocaleTimeString(),
        sslEnabled: isSSLEnabled,
      });
    } finally {
      setIsLoading(false);
      setCurrentTest('');
    }
  };

  const onShowMitmProxyGuide = () => {
    Alert.alert(
      'MITM + Proxyman (manual)',
      mitmHumanSteps().join('\n\n'),
      [
        {
          text: 'Run app steps (proxy mode)',
          onPress: async () => {
            setIsLoading(true);
            setCurrentTest('MITM proxy mode');
            try {
              const results = await runMitmAppSteps({ mode: 'proxy' });
              setMitmResults(results);
              await refreshNativeStatus();
              Alert.alert(
                'App steps done',
                'If iOS: force-quit + reopen with Proxyman SSL ON, then tap UAT GraphQL again.\n\n' +
                  results
                    .map(
                      (r) =>
                        `${r.ok ? '✓' : '✗'} ${r.title}${
                          r.needsRestart ? ' [restart]' : ''
                        }`
                    )
                    .join('\n')
              );
            } finally {
              setIsLoading(false);
              setCurrentTest('');
            }
          },
        },
        { text: 'OK', style: 'cancel' },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={styles.title}>SSL Manager Test App</Text>

      <View style={styles.controlPanel}>
        <Text style={styles.panelTitle}>Native status</Text>
        <Text style={styles.meta}>
          Nitro:{' '}
          <Text style={nativeAvailable ? styles.enabled : styles.disabled}>
            {nativeAvailable ? 'linked' : 'NOT linked'}
          </Text>
        </Text>
        <Text style={styles.meta}>
          Domains: {domains.length ? domains.join(', ') : '(none yet)'}
        </Text>
        <View style={styles.sslContainer}>
          <View style={styles.sslInfo}>
            <Text style={styles.label}>SSL Pinning</Text>
            <Text
              style={[
                styles.status,
                isSSLEnabled ? styles.enabled : styles.disabled,
              ]}
            >
              {isSSLEnabled ? 'ENABLED' : 'DISABLED'}
            </Text>
          </View>
          <Switch
            value={isSSLEnabled}
            onValueChange={toggleSSLPinning}
            trackColor={{ false: '#FF6B6B', true: '#4ECDC4' }}
            thumbColor={isSSLEnabled ? '#45B7B8' : '#FF7979'}
            disabled={isLoading || !nativeAvailable}
          />
        </View>
      </View>

      <View style={styles.testSection}>
        <Text style={styles.sectionTitle}>Feature suite</Text>
        <TouchableOpacity
          onPress={onRunFeatureSuite}
          style={[styles.button, styles.primaryButton]}
          disabled={isLoading}
          accessibilityLabel="Run Feature Suite"
          accessibilityRole="button"
          testID="btn-feature-suite"
        >
          <Text style={styles.buttonText}>Run Feature Suite</Text>
        </TouchableOpacity>
        {featureResults.length > 0 && (
          <View style={styles.suiteList}>
            {featureResults.map((r) => (
              <View
                key={r.id}
                style={[
                  styles.suiteRow,
                  r.ok ? styles.suiteOk : styles.suiteFail,
                ]}
              >
                <Text style={styles.suiteTitle}>
                  {r.ok ? 'PASS' : 'FAIL'} · {r.title}
                </Text>
                <Text style={styles.suiteDetail}>{r.detail}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.testSection}>
        <Text style={styles.sectionTitle}>MITM checklist (rebuild test)</Text>
        <Text style={styles.hint}>
          Use public demo HTTPS only. Point Proxyman at your own pinned hosts
          from ssl_config.json after npm run test:rebuild.
        </Text>
        <View style={styles.buttonGrid}>
          <TouchableOpacity
            onPress={onRunMitmDirect}
            style={[styles.button, styles.successButton]}
            disabled={isLoading}
            accessibilityLabel="MITM direct path"
            accessibilityRole="button"
            testID="btn-mitm-direct"
          >
            <Text style={styles.buttonText}>1. Pin ON happy path (no proxy)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onShowMitmProxyGuide}
            style={[styles.button, styles.warningButton]}
            disabled={isLoading}
            accessibilityLabel="MITM proxy guide"
            accessibilityRole="button"
            testID="btn-mitm-proxy"
          >
            <Text style={styles.buttonText}>2. Proxyman ON/OFF guide</Text>
          </TouchableOpacity>
        </View>
        {mitmResults.length > 0 && (
          <View style={styles.suiteList}>
            {mitmResults.map((r) => (
              <View
                key={r.id}
                style={[
                  styles.suiteRow,
                  r.ok ? styles.suiteOk : styles.suiteFail,
                ]}
              >
                <Text style={styles.suiteTitle}>
                  {r.ok ? 'PASS' : 'FAIL'} · {r.title}
                  {r.needsRestart ? ' · restart iOS' : ''}
                </Text>
                <Text style={styles.suiteDetail}>{r.detail}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.testSection}>
        <Text style={styles.sectionTitle}>API smoke</Text>
        <View style={styles.buttonGrid}>
          <TouchableOpacity
            onPress={() =>
              testApiCall(
                'https://jsonplaceholder.typicode.com/posts/1',
                'Unpinned public API'
              )
            }
            style={[styles.button, styles.successButton]}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Test public HTTPS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              testApiCall('https://httpbin.org/json', 'httpbin JSON')
            }
            style={[styles.button, styles.infoButton]}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Test httpbin</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setTestResults([]);
              setFeatureResults([]);
            }}
            style={[styles.button, styles.clearButton]}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Clear results</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <Text style={styles.loadingText}>Running: {currentTest}</Text>
        </View>
      )}

      {testResults.length > 0 && (
        <View style={styles.resultsSection}>
          <Text style={styles.sectionTitle}>
            Log ({testResults.length})
          </Text>
          {testResults.map((result, index) => (
            <View
              key={`${result.url}-${index}`}
              style={[
                styles.resultCard,
                result.status === 'success'
                  ? styles.successCard
                  : styles.errorCard,
              ]}
            >
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>{result.url}</Text>
                <Text style={styles.resultTime}>{result.timestamp}</Text>
              </View>
              <Text
                style={[
                  styles.resultMessage,
                  result.status === 'success'
                    ? styles.successText
                    : styles.errorText,
                ]}
              >
                {result.message}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>How to test features</Text>
        <Text style={styles.instructionsText}>
          1. Confirm Nitro shows “linked” (rebuild if not).
        </Text>
        <Text style={styles.instructionsText}>
          2. Tap “Run Feature Suite” — covers availability, toggle, setSSLConfig,
          domains, failure listener, OTA helper, fetch.
        </Text>
        <Text style={styles.instructionsText}>
          3. From repo: `npm run test:features` for the unit matrix.
        </Text>
        <Text style={styles.instructionsText}>
          4. MITM / wrong-pin block still needs Charles/Proxyman (manual).
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { padding: 16, paddingBottom: 30 },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#2C3E50',
  },
  controlPanel: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#34495E',
    marginBottom: 8,
  },
  meta: { fontSize: 13, color: '#566573', marginBottom: 4 },
  sslContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  sslInfo: { flex: 1 },
  label: { fontSize: 16, fontWeight: '600', color: '#2C3E50' },
  status: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  enabled: { color: '#27AE60' },
  disabled: { color: '#E74C3C' },
  testSection: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 12,
  },
  buttonGrid: { gap: 10 },
  button: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: { backgroundColor: '#6C5CE7' },
  successButton: { backgroundColor: '#27AE60' },
  infoButton: { backgroundColor: '#3498DB' },
  clearButton: { backgroundColor: '#95A5A6' },
  warningButton: { backgroundColor: '#E67E22' },
  buttonText: { color: 'white', fontSize: 15, fontWeight: '700' },
  hint: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 10,
    lineHeight: 18,
  },
  suiteList: { marginTop: 12, gap: 8 },
  suiteRow: {
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    backgroundColor: 'white',
  },
  suiteOk: { borderLeftColor: '#27AE60' },
  suiteFail: { borderLeftColor: '#E74C3C' },
  suiteTitle: { fontWeight: '700', color: '#2C3E50', marginBottom: 4 },
  suiteDetail: { fontSize: 12, color: '#566573', fontFamily: 'monospace' },
  loadingContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: { marginTop: 8, color: '#7F8C8D', fontWeight: '600' },
  resultsSection: { marginBottom: 16 },
  resultCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  successCard: { borderLeftColor: '#27AE60' },
  errorCard: { borderLeftColor: '#E74C3C' },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resultTitle: { fontSize: 15, fontWeight: '600', color: '#2C3E50', flex: 1 },
  resultTime: { fontSize: 12, color: '#7F8C8D' },
  resultMessage: { fontSize: 13, lineHeight: 18, fontFamily: 'monospace' },
  successText: { color: '#1E8449' },
  errorText: { color: '#C0392B' },
  instructionsContainer: {
    backgroundColor: '#EBF3FD',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3498DB',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    color: '#2980B9',
  },
  instructionsText: {
    fontSize: 14,
    color: '#34495E',
    marginBottom: 6,
    lineHeight: 20,
  },
});
