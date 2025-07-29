import { withAndroidManifest, withInfoPlist } from '@expo/config-plugins';
const withUseSslPinning = (config, options = {}) => {
    const { enableAndroid = true, enableIOS = true } = options;
    if (enableAndroid) {
        config = withAndroidManifest(config, (config) => {
            const { manifest } = config.modResults;
            // Add required permissions
            if (!manifest['uses-permission']) {
                manifest['uses-permission'] = [];
            }
            const permissions = Array.isArray(manifest['uses-permission'])
                ? manifest['uses-permission']
                : [manifest['uses-permission']];
            // Add INTERNET permission if not exists
            if (!permissions.find((p) => p.$['android:name'] === 'android.permission.INTERNET')) {
                permissions.push({
                    $: {
                        'android:name': 'android.permission.INTERNET',
                    },
                });
            }
            // Add ACCESS_NETWORK_STATE permission if not exists
            if (!permissions.find((p) => p.$['android:name'] === 'android.permission.ACCESS_NETWORK_STATE')) {
                permissions.push({
                    $: {
                        'android:name': 'android.permission.ACCESS_NETWORK_STATE',
                    },
                });
            }
            manifest['uses-permission'] = permissions;
            return config;
        });
    }
    if (enableIOS) {
        config = withInfoPlist(config, (config) => {
            // Add any iOS-specific configurations if needed
            return config;
        });
    }
    return config;
};
export default withUseSslPinning;
