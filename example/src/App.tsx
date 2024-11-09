import * as React from 'react';

import { StyleSheet, View, Image } from 'react-native';
import {
  setUseSSLPinning,
  initializeSslPinning,
  getUseSSLPinning,
} from 'react-native-use-ssl-pinning';
import config from '../ssl_config.json';
export default function App() {
  const [imageUri, setImageUri] = React.useState<string>('');
  setUseSSLPinning(true);

  initializeSslPinning(JSON.stringify(config))
    .then(() => {
      console.log('Suceess');
    })
    .catch(() => {
      console.log('Error');
    });
  const getMoviesFromApiAsync = async () => {
    try {
      const a = await getUseSSLPinning();
      console.log('jajaja', a);
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

  React.useEffect(() => {
    getMoviesFromApiAsync();
    // setUseSSLPinning(true);
  }, []);

  return (
    <View style={styles.container}>
      <Image source={{ uri: imageUri }} style={{ width: 300, height: 200 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 60,
    height: 60,
    marginVertical: 20,
  },
});
