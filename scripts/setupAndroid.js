const fs = require('fs');
const path = require('path');

// Path to AndroidManifest.xml
const manifestPath = path.resolve(
  __dirname,
  '../android/app/src/main/AndroidManifest.xml'
);

// Function to extract the package name from AndroidManifest.xml
function getPackageName() {
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  const match = manifestContent.match(/package="(.+?)"/);
  if (match && match[1]) {
    return match[1];
  }
  throw new Error('Package name not found in AndroidManifest.xml');
}

const packageName = getPackageName();

// Construct the path to MainApplication.kt
const mainApplicationPath = path.resolve(
  __dirname,
  `../android/app/src/main/java/${packageName.replace(/\./g, '/')}/MainApplication.kt`
);

// Read the MainApplication.kt file
let mainApplicationContent = fs.readFileSync(mainApplicationPath, 'utf8');

// Check if the OkHttpClientProvider import is already there
if (
  !mainApplicationContent.includes(
    'import com.facebook.react.modules.network.OkHttpClientProvider'
  )
) {
  mainApplicationContent = mainApplicationContent.replace(
    'import android.app.Application',
    `import android.app.Application
import com.facebook.react.modules.network.OkHttpClientProvider
import com.yourcompany.sslpinning.SSLPinnerFactory`
  );
}

// Check if the line to set the OkHttpClientFactory is already there
if (
  !mainApplicationContent.includes(
    'OkHttpClientProvider.setOkHttpClientFactory(SSLPinnerFactory(this))'
  )
) {
  mainApplicationContent = mainApplicationContent.replace(
    'super.onCreate()',
    `super.onCreate()

        // Set the custom OkHttpClientFactory
        OkHttpClientProvider.setOkHttpClientFactory(SSLPinnerFactory(this))`
  );
}

// Write the modified content back to MainApplication.kt
fs.writeFileSync(mainApplicationPath, mainApplicationContent, 'utf8');

console.log('MainApplication.kt has been updated successfully.');
