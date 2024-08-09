const fs = require('fs');
const path = require('path');

// Path to AndroidManifest.xml
const manifestPath = path.resolve(
  process.cwd(),
  'android/app/src/main/AndroidManifest.xml'
);

// Function to extract the package name from AndroidManifest.xml
function getPackageName() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`AndroidManifest.xml not found at ${manifestPath}`);
  }

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
  process.cwd(),
  `android/app/src/main/java/${packageName.replace(/\./g, '/')}/MainApplication.kt`
);

// Read the MainApplication.kt file
if (!fs.existsSync(mainApplicationPath)) {
  throw new Error(`MainApplication.kt not found at ${mainApplicationPath}`);
}

let mainApplicationContent = fs.readFileSync(mainApplicationPath, 'utf8');

// Check if the OkHttpClientProvider import is already there
if (
  !mainApplicationContent.includes(
    'import com.facebook.react.modules.network.OkHttpClientProvider'
  )
) {
  const importStatements = `
import com.facebook.react.modules.network.OkHttpClientProvider
import com.yourcompany.sslpinning.SSLPinnerFactory`;

  mainApplicationContent = mainApplicationContent.replace(
    'import android.app.Application',
    `import android.app.Application${importStatements}`
  );
}

// Check if the line to set the OkHttpClientFactory is already there
if (
  !mainApplicationContent.includes(
    'OkHttpClientProvider.setOkHttpClientFactory(SSLPinnerFactory(this))'
  )
) {
  const onCreateIndex = mainApplicationContent.indexOf('super.onCreate()');
  if (onCreateIndex !== -1) {
    const beforeOnCreate = mainApplicationContent.substring(
      0,
      onCreateIndex + 'super.onCreate()'.length
    );
    const afterOnCreate = mainApplicationContent.substring(
      onCreateIndex + 'super.onCreate()'.length
    );

    mainApplicationContent = `
${beforeOnCreate}

// Set the custom OkHttpClientFactory
OkHttpClientProvider.setOkHttpClientFactory(SSLPinnerFactory(this));

${afterOnCreate}`;
  }
}

// Write the modified content back to MainApplication.kt
fs.writeFileSync(mainApplicationPath, mainApplicationContent, 'utf8');

console.log('MainApplication.kt has been updated successfully.');
