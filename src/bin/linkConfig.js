#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Path to the config file
const configFilePath = path.resolve(process.cwd(), 'config.json');

if (!fs.existsSync(configFilePath)) {
  console.error('config.json file not found in the project root.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));

// Define the path to save the config on the Android side
const androidConfigPath = path.resolve(
  process.cwd(),
  'android/app/src/main/assets/ssl_config.json'
);

// Ensure the assets directory exists
const assetsDir = path.dirname(androidConfigPath);
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Write the config to the assets directory for Android
fs.writeFileSync(androidConfigPath, JSON.stringify(config, null, 2));

console.log('Successfully linked config.json to Android assets.');
