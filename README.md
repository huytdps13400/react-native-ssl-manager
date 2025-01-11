# react-native-use-ssl-pinning

React Native SSL Pinning provides seamless SSL certificate pinning integration for enhanced network security in React Native apps. This module enables developers to easily implement and manage certificate pinning, protecting applications against man-in-the-middle (MITM) attacks. With dynamic configuration options and the ability to toggle SSL pinning, it's particularly useful for development and testing scenarios.

## Features

- 🔒 Easy SSL certificate pinning implementation
- 🔄 Dynamic enabling/disabling of SSL pinning
- ⚡ Optimized for development and testing workflows
- 📱 Cross-platform support (iOS & Android)
- 🛠️ Simple configuration using JSON
- 🚀 Performance-optimized implementation

## Installation

```sh
npm install react-native-use-ssl-pinning
```

## Usage

### Basic Setup

```typescript
import { 
  initializeSslPinning, 
  setUseSSLPinning, 
  getUseSSLPinning 
} from 'react-native-use-ssl-pinning';

// Initialize SSL pinning with configuration
const sslConfig = {
  "domains": {
    "development": "api.dev.example.com",
    "production": "api.example.com"
  },
  "sha256Keys": {
    "api.dev.example.com": [
      "sha256/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX=",
      "sha256/YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY="
    ],
    "api.example.com": [
      "sha256/ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ=",
      "sha256/WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW="
    ]
  }
};

// Initialize the SSL pinning
await initializeSslPinning(JSON.stringify(sslConfig));

// Enable SSL pinning
await setUseSSLPinning(true);

// Check if SSL pinning is enabled
const isEnabled = await getUseSSLPinning();
console.log('SSL Pinning enabled:', isEnabled);
```

### Configuration File (ssl_config.json)

Create a configuration file with your domain certificates. Example structure:

```json
{
  "domains": {
    "development": "api.dev.example.com",
    "production": "api.example.com"
  },
  "sha256Keys": {
    "api.dev.example.com": [
      "sha256/certificate-hash-1=",
      "sha256/certificate-hash-2="
    ],
    "api.example.com": [
      "sha256/certificate-hash-3=",
      "sha256/certificate-hash-4="
    ]
  }
}
```

### API Reference

#### `initializeSslPinning(configJsonString: string): Promise<any>`
Initializes the SSL pinning configuration with the provided JSON string configuration.

```typescript
await initializeSslPinning(JSON.stringify(sslConfig));
```

#### `setUseSSLPinning(usePinning: boolean): void`
Enables or disables SSL pinning dynamically.

```typescript
await setUseSSLPinning(true); // Enable SSL pinning
await setUseSSLPinning(false); // Disable SSL pinning
```

#### `getUseSSLPinning(): Promise<boolean>`
Retrieves the current state of SSL pinning.

```typescript
const isEnabled = await getUseSSLPinning();
```

## Important Notes ⚠️

### Restarting After SSL Pinning Changes

When using `setUseSSLPinning`, a restart of the application is required for changes to take effect. This is because SSL pinning is implemented at the native level.

#### Using React Native Restart

First, install react-native-restart:

```sh
# Using npm
npm install react-native-restart

# Using yarn
yarn add react-native-restart
```

For iOS, run pod install:
```sh
cd ios && pod install
```

Then use it in your code:
```typescript
import RNRestart from 'react-native-restart';

const toggleSSLPinning = async (enabled: boolean) => {
  await setUseSSLPinning(enabled);
  // Restart the app to apply changes
  RNRestart.Restart();
};

// Example with user confirmation
const handleSSLToggle = async (enabled: boolean) => {
  // Save any necessary state
  await saveAppState();
  
  // Update SSL pinning
  await setUseSSLPinning(enabled);
  
  // Show user message
  Alert.alert(
    'Restart Required',
    'The app needs to restart to apply security changes.',
    [
      {
        text: 'Restart Now',
        onPress: () => RNRestart.Restart()
      }
    ]
  );
};
```

## Development and Testing Benefits

### For Developers
- **Quick Toggling**: Easily switch SSL pinning on/off during development
- **Performance Optimization**: Minimize SSL verification overhead during development
- **Flexible Configuration**: Support multiple environments with different certificates

### For QA Teams
- **Efficient Testing**: Quickly verify API behavior with and without SSL pinning
- **Issue Investigation**: Easily isolate SSL-related issues
- **Environment Switching**: Seamlessly test across different environments

## Best Practices

1. **Environment Management**
   - Keep separate configurations for development and production
   - Store production certificates securely

2. **Performance Optimization**
   - Enable SSL pinning only when necessary during development
   - Use development certificates for testing environments

3. **Security Considerations**
   - Always enable SSL pinning in production
   - Regularly update certificates before expiration
   - Maintain multiple backup certificates

## Roadmap 🗺️

We're actively working on expanding the capabilities of react-native-use-ssl-pinning. Here are our planned features:

### Upcoming Features

- 📱 **Expo Plugin Integration**
  - Native SSL pinning support for Expo projects
  - Seamless configuration through expo-config-plugin
  - Auto-linking capabilities for Expo development builds
  - Support for Expo's development client

## Testing with Proxyman 🔍

Proxyman is a powerful tool for testing SSL pinning implementation. Here's how you can verify your SSL pinning configuration:

### Setup Verification

1. **Install Proxyman**
   - Download and install [Proxyman](https://proxyman.io/)
   - Install Proxyman's SSL certificate on your device/simulator

2. **Testing SSL Pinning**
   ```typescript
   // Enable SSL Pinning
   await setUseSSLPinning(true);
   
   // Make API requests through your app
   // If SSL pinning is working correctly:
   // - Requests will fail when Proxyman tries to intercept them
   // - You'll see SSL/TLS handshake errors
   
   // Disable SSL Pinning for debugging
   await setUseSSLPinning(false);
   // Now you can intercept and inspect API calls with Proxyman
   ```

### Common Test Scenarios

1. **Verify SSL Pinning is Active**
   - Enable SSL pinning
   - Attempt to intercept traffic with Proxyman
   - Requests should fail with SSL handshake errors

2. **Debug API Calls**
   - Disable SSL pinning temporarily
   - Use Proxyman to inspect API requests/responses
   - Helpful for QA testing and development

3. **Certificate Validation**
   - Verify your SSL configuration matches the certificates in ssl_config.json
   - Test against both development and production endpoints

### Troubleshooting Tips

- If requests succeed with Proxyman while SSL pinning is enabled, check your configuration
- Verify that the SHA256 hashes in your config match your server certificates
- Test both development and production environments separately

This integration with Proxyman makes it easy to:
- Verify SSL pinning implementation
- Debug API communications
- Validate security configurations
- Speed up development and testing workflows

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

For open source projects, say how it is licensed.

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
