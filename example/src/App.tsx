import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Switch, Text, View } from 'react-native';
import {
  getUseSSLPinning,
  initializeSslPinning,
  setUseSSLPinning,
} from 'react-native-use-ssl-pinning';
import config from '../ssl_config.json';

export default function App() {
  const [imageUri, setImageUri] = useState<string>('');
  const [isSSLEnabled, setIsSSLEnabled] = useState<boolean>(false);

  useEffect(() => {
    getUseSSLPinning()
      .then((value) => setIsSSLEnabled(value))
      .catch(console.error);
  }, []);

  // Initialize SSL Pinning status
  useEffect(() => {
    const initSSLStatus = () => {
      initializeSslPinning(JSON.stringify(config))
        .then((result) => {
          console.log('SSL Pinning Initialized:', result);
        })
        .catch((error) => {
          console.log('SSL Pinning Error:', error);
        })
        .finally(() => {
          getMoviesFromApiAsync();
        });
    };

    initSSLStatus();
  }, []);

  // Handle SSL Pinning toggle
  const toggleSSLPinning = async (value: boolean) => {
    setIsSSLEnabled(value);
    setUseSSLPinning(value);
  };

  const getMoviesFromApiAsync = async () => {
    try {
      const response = await fetch(
        'https://api.example.com/api/home/home-banner'
      );
      const json = await response.json();
      console.log('JSON', json);
      setImageUri(json?.data?.banner_uri);
      return json.data;
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.sslContainer}>
        <Text>SSL Pinning</Text>
        <Switch
          value={isSSLEnabled}
          onValueChange={toggleSSLPinning}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={isSSLEnabled ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>
      <Image
        source={{ uri: imageUri ?? '' }}
        style={{ width: 300, height: 200 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sslContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  box: {
    width: 60,
    height: 60,
    marginVertical: 20,
  },
});
