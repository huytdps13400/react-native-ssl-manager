#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// This script switches the podspec for Expo projects
// It's called by the Expo config plugin

const projectRoot = process.cwd();
const libraryPath = path.join(projectRoot, 'node_modules/react-native-ssl-manager');

if (fs.existsSync(libraryPath)) {
  const packageJsonPath = path.join(libraryPath, 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // For Expo projects, use the Expo module podspec
    if (packageJson['react-native'] && packageJson['react-native'].ios) {
      packageJson['react-native'].ios.podspec = 'ios/UseSslPinningModule.podspec';
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('✅ Switched to Expo module podspec for iOS');
    }
  }
} 