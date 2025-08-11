import React, { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getUseSSLPinning, setUseSSLPinning } from 'react-native-ssl-manager';

export default function App() {
  const [imageUri, setImageUri] = useState<string>('');
  const [isSSLEnabled, setIsSSLEnabled] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<string>('');

  useEffect(() => {
    getUseSSLPinning()
      .then((value: boolean) => {
        console.log('value', value);
        setIsSSLEnabled(value);
      })
      .catch(console.error);
  }, []);

  // Initialize SSL Pinning status
  useEffect(() => {
    setTimeout(() => {
      getMoviesFromApiAsync();
    }, 500);
  }, []);

  // Handle SSL Pinning toggle
  const toggleSSLPinning = async (value: boolean) => {
    setIsSSLEnabled(value);
    setUseSSLPinning(value);
  };

  const getMoviesFromApiAsync = async () => {
    try {
      const response = await fetch(
        'https://sbkh.wrapper.sbuxkh.com/ms-customer/api/home/home-banner'
      );
      const json = await response.json();
      console.log('JSON', json);
      setImageUri(json?.data?.banner_uri);
      return json.data;
    } catch (error) {
      console.error(error);
    }
  };

  // Test ContentProvider initialization

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={styles.title}>🧪 SSL Manager Test App</Text>

      <View style={styles.sslContainer}>
        <Text style={styles.label}>SSL Pinning</Text>
        <Switch
          value={isSSLEnabled}
          onValueChange={toggleSSLPinning}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={isSSLEnabled ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={getMoviesFromApiAsync}
          style={[styles.button, styles.primaryButton]}
        >
          <Text style={styles.buttonText}>🌐 Test API Call</Text>
        </TouchableOpacity>
      </View>

      {imageUri !== '' && (
        <View style={styles.imageContainer}>
          <Text style={styles.sectionTitle}>📸 API Response Image:</Text>
          <Image source={{ uri: imageUri }} style={styles.image} />
        </View>
      )}

      {testResults !== '' && (
        <View style={styles.resultsContainer}>
          <Text style={styles.sectionTitle}>📊 Test Results:</Text>
          <Text style={styles.resultsText}>{testResults}</Text>
        </View>
      )}

      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>📝 Hướng dẫn:</Text>
        <Text style={styles.instructionsText}>
          • Bật SSL Pinning và test API call để kiểm tra hoạt động
        </Text>
        <Text style={styles.instructionsText}>
          • Test ContentProvider để xem việc khởi tạo sớm (chỉ Android)
        </Text>
        <Text style={styles.instructionsText}>
          • Kiểm tra console log để xem chi tiết
        </Text>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  sslContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  button: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  resultsContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultsText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  instructionsContainer: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#1976D2',
  },
  instructionsText: {
    fontSize: 14,
    color: '#424242',
    marginBottom: 5,
  },
});
