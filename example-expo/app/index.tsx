import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getUseSSLPinning, setUseSSLPinning } from 'react-native-ssl-manager';

interface TestResult {
  url: string;
  status: 'success' | 'error' | 'loading';
  message: string;
  timestamp: string;
  sslEnabled: boolean;
}

export default function App() {
  const [imageUri, setImageUri] = useState<string>('');
  const [isSSLEnabled, setIsSSLEnabled] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentTest, setCurrentTest] = useState<string>('');

  useEffect(() => {
    initializeSSLStatus();
  }, []);

  const initializeSSLStatus = async () => {
    try {
      const value = await getUseSSLPinning();
      setIsSSLEnabled(value);
      addTestResult({
        url: 'SSL Manager Initialization',
        status: 'success',
        message: `SSL Pinning is ${value ? 'ENABLED' : 'DISABLED'}`,
        timestamp: new Date().toLocaleTimeString(),
        sslEnabled: value,
      });
    } catch (error) {
      addTestResult({
        url: 'SSL Manager Initialization',
        status: 'error',
        message: `Failed to get SSL status: ${error}`,
        timestamp: new Date().toLocaleTimeString(),
        sslEnabled: false,
      });
    }
  };

  const addTestResult = (result: TestResult) => {
    setTestResults((prev) => [result, ...prev.slice(0, 9)]); // Keep last 10 results
  };

  // Handle SSL Pinning toggle
  const toggleSSLPinning = async (value: boolean) => {
    try {
      setIsSSLEnabled(value);
      await setUseSSLPinning(value);

      addTestResult({
        url: 'SSL Setting Change',
        status: 'success',
        message: `SSL Pinning ${value ? 'ENABLED' : 'DISABLED'} successfully`,
        timestamp: new Date().toLocaleTimeString(),
        sslEnabled: value,
      });

      Alert.alert(
        'SSL Pinning Updated',
        `SSL Pinning is now ${value ? 'ENABLED' : 'DISABLED'}.\nTry making API calls to see the difference!`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      addTestResult({
        url: 'SSL Setting Change',
        status: 'error',
        message: `Failed to update SSL setting: ${error}`,
        timestamp: new Date().toLocaleTimeString(),
        sslEnabled: isSSLEnabled,
      });
    }
  };

  // Test API calls with different URLs
  const testApiCall = async (url: string, description: string) => {
    setIsLoading(true);
    setCurrentTest(description);

    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      const responseTime = Date.now() - startTime;
      const json = await response.json();

      // Set image if available
      if (json?.data?.banner_uri) {
        setImageUri(json.data.banner_uri);
      }

      addTestResult({
        url: description,
        status: 'success',
        message: `✅ SUCCESS (${responseTime}ms)\nStatus: ${response.status}\nSSL: ${isSSLEnabled ? 'ENABLED' : 'DISABLED'}\nResponse: ${JSON.stringify(json).substring(0, 100)}...`,
        timestamp: new Date().toLocaleTimeString(),
        sslEnabled: isSSLEnabled,
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;

      addTestResult({
        url: description,
        status: 'error',
        message: `❌ FAILED (${responseTime}ms)\nSSL: ${isSSLEnabled ? 'ENABLED' : 'DISABLED'}\nError: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toLocaleTimeString(),
        sslEnabled: isSSLEnabled,
      });
    } finally {
      setIsLoading(false);
      setCurrentTest('');
    }
  };

  const clearResults = () => {
    setTestResults([]);
    setImageUri('');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={styles.title}>🔒 SSL Manager Test App</Text>

      {/* SSL Control Panel */}
      <View style={styles.controlPanel}>
        <Text style={styles.panelTitle}>🎛️ SSL Control Panel</Text>
        <View style={styles.sslContainer}>
          <View style={styles.sslInfo}>
            <Text style={styles.label}>SSL Pinning</Text>
            <Text
              style={[
                styles.status,
                isSSLEnabled ? styles.enabled : styles.disabled,
              ]}
            >
              {isSSLEnabled ? '🔒 ENABLED' : '🔓 DISABLED'}
            </Text>
          </View>
          <Switch
            value={isSSLEnabled}
            onValueChange={toggleSSLPinning}
            trackColor={{ false: '#FF6B6B', true: '#4ECDC4' }}
            thumbColor={isSSLEnabled ? '#45B7B8' : '#FF7979'}
            disabled={isLoading}
          />
        </View>
      </View>

      {/* Test Buttons */}
      <View style={styles.testSection}>
        <Text style={styles.sectionTitle}>🧪 API Tests</Text>

        <View style={styles.buttonGrid}>
          <TouchableOpacity
            onPress={() =>
              testApiCall(
                'https://sbkh.wrapper.sbuxkh.com/ms-customer/api/home/home-banner',
                'Pinned API (Should Work)'
              )
            }
            style={[styles.button, styles.successButton]}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>✅ Test Pinned API</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              testApiCall(
                'https://jsonplaceholder.typicode.com/posts/1',
                'Non-Pinned API (Should Fail if SSL ON)'
              )
            }
            style={[styles.button, styles.warningButton]}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>⚠️ Test Non-Pinned API</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              testApiCall('https://httpbin.org/json', 'HTTP Test API')
            }
            style={[styles.button, styles.infoButton]}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>🌐 Test HTTP API</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={clearResults}
            style={[styles.button, styles.clearButton]}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>🗑️ Clear Results</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <Text style={styles.loadingText}>Testing: {currentTest}</Text>
        </View>
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <View style={styles.resultsSection}>
          <Text style={styles.sectionTitle}>
            📊 Test Results ({testResults.length})
          </Text>
          {testResults.map((result, index) => (
            <View
              key={index}
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
              <View style={styles.resultFooter}>
                <Text
                  style={[
                    styles.sslBadge,
                    result.sslEnabled ? styles.sslOn : styles.sslOff,
                  ]}
                >
                  SSL: {result.sslEnabled ? 'ON' : 'OFF'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Image Display */}
      {imageUri !== '' && (
        <View style={styles.imageContainer}>
          <Text style={styles.sectionTitle}>📸 API Response Image</Text>
          <Image source={{ uri: imageUri }} style={styles.image} />
        </View>
      )}

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>📝 How to Test</Text>
        <Text style={styles.instructionsText}>
          1. 🔓 Turn OFF SSL Pinning → Test all APIs (should work)
        </Text>
        <Text style={styles.instructionsText}>
          2. 🔒 Turn ON SSL Pinning → Test Pinned API (should work)
        </Text>
        <Text style={styles.instructionsText}>
          3. 🔒 Test Non-Pinned API (should fail with SSL error)
        </Text>
        <Text style={styles.instructionsText}>
          4. 📊 Check results below to see SSL Pinning in action!
        </Text>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#2C3E50',
    letterSpacing: 0.5,
  },

  // Control Panel
  controlPanel: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#34495E',
    marginBottom: 15,
    textAlign: 'center',
  },
  sslContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sslInfo: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 5,
  },
  status: {
    fontSize: 14,
    fontWeight: '700',
  },
  enabled: {
    color: '#27AE60',
  },
  disabled: {
    color: '#E74C3C',
  },

  // Test Section
  testSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 15,
    textAlign: 'center',
  },
  buttonGrid: {
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  successButton: {
    backgroundColor: '#27AE60',
  },
  warningButton: {
    backgroundColor: '#F39C12',
  },
  infoButton: {
    backgroundColor: '#3498DB',
  },
  clearButton: {
    backgroundColor: '#95A5A6',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Loading
  loadingContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#7F8C8D',
    fontWeight: '600',
  },

  // Results
  resultsSection: {
    marginBottom: 20,
  },
  resultCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
  },
  successCard: {
    borderLeftColor: '#27AE60',
  },
  errorCard: {
    borderLeftColor: '#E74C3C',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    flex: 1,
    marginRight: 10,
  },
  resultTime: {
    fontSize: 12,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  resultMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  successText: {
    color: '#27AE60',
  },
  errorText: {
    color: '#E74C3C',
  },
  resultFooter: {
    alignItems: 'flex-end',
  },
  sslBadge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sslOn: {
    backgroundColor: '#D5EDDA',
    color: '#155724',
  },
  sslOff: {
    backgroundColor: '#F8D7DA',
    color: '#721C24',
  },

  // Image
  imageContainer: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    resizeMode: 'cover',
  },

  // Instructions
  instructionsContainer: {
    backgroundColor: '#EBF3FD',
    borderRadius: 15,
    padding: 20,
    borderLeftWidth: 5,
    borderLeftColor: '#3498DB',
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 15,
    color: '#2980B9',
    textAlign: 'center',
  },
  instructionsText: {
    fontSize: 15,
    color: '#34495E',
    marginBottom: 8,
    lineHeight: 22,
    fontWeight: '500',
  },
});
