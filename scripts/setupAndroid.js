const fs = require('fs');
const path = require('path');

// Path to build.gradle
const projectRoot = path.resolve(__dirname, '../..');

// Resolve the path to the build.gradle file
const gradlePath = path.join(projectRoot, 'android/app/build.gradle');

// Function to extract the package name from build.gradle
function getPackageNameFromGradle() {
  if (!fs.existsSync(gradlePath)) {
    throw new Error(`build.gradle not found at ${gradlePath}`);
  }

  const gradleContent = fs.readFileSync(gradlePath, 'utf8');
  const match = gradleContent.match(/applicationId\s+"(.+?)"/);
  if (match && match[1]) {
    return match[1];
  }
  throw new Error('Package name not found in build.gradle');
}

// Get the package name
const packageName = getPackageNameFromGradle();

// Construct the path to MainApplication.kt
const mainApplicationPath = path.resolve(
  __dirname,
  `../android/app/src/main/java/${packageName.replace(/\./g, '/')}/MainApplication.kt`
);

if (!fs.existsSync(mainApplicationPath)) {
  throw new Error(`MainApplication.kt not found at ${mainApplicationPath}`);
}

let mainApplicationContent = fs.readFileSync(mainApplicationPath, 'utf8');

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
