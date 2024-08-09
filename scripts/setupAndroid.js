const fs = require('fs');
const path = require('path');

// Adjust the path based on your project structure
const manifestPath = path.resolve(
  __dirname,
  '../node_modules/android/app/src/main/AndroidManifest.xml'
);

function getPackageName() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `AndroidManifest.xml not found at ${manifestPath}${__dirname}`
    );
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
  __dirname,
  `../node_modules/android/app/src/main/java/${packageName.replace(/\./g, '/')}/MainApplication.kt`
);

if (!fs.existsSync(mainApplicationPath)) {
  throw new Error(`MainApplication.kt not found at ${mainApplicationPath}`);
}

let mainApplicationContent = fs.readFileSync(mainApplicationPath, 'utf8');

// Check if the OkHttpClientProvider import is already there

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
