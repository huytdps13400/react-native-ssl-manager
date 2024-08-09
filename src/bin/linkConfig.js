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

// Here you can add code to link the config to your native module
// For example, writing it to a specific location or applying it directly

console.log('Successfully linked config.json.');
