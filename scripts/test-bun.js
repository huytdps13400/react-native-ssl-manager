#!/usr/bin/env bun

// Test script to verify Bun compatibility with react-native-ssl-manager

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

console.log('🧪 Testing Bun compatibility...');

// Test 1: Check if bunfig.toml exists
const bunfigPath = join(process.cwd(), 'bunfig.toml');
if (existsSync(bunfigPath)) {
  console.log('✅ bunfig.toml found');
} else {
  console.log('❌ bunfig.toml not found');
}

// Test 2: Check package.json for Bun support
const packageJsonPath = join(process.cwd(), 'package.json');
if (existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

  if (packageJson.engines?.bun) {
    console.log(`✅ Bun engine requirement: ${packageJson.engines.bun}`);
  } else {
    console.log('❌ No Bun engine requirement in package.json');
  }

  if (packageJson.scripts['bun:install']) {
    console.log('✅ Bun install script found');
  } else {
    console.log('❌ Bun install script not found');
  }
} else {
  console.log('❌ package.json not found');
}

// Test 3: Check if Bun postinstall script exists
const bunPostinstallPath = join(process.cwd(), 'scripts', 'bun-postinstall.js');
if (existsSync(bunPostinstallPath)) {
  console.log('✅ Bun postinstall script found');
} else {
  console.log('❌ Bun postinstall script not found');
}

// Test 4: Check source files for Bun compatibility
const sourceFiles = [
  'src/index.tsx',
  'src/NativeUseSslPinning.ts',
  'src/UseSslPinning.types.ts',
];

for (const file of sourceFiles) {
  const filePath = join(process.cwd(), file);
  if (existsSync(filePath)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} not found`);
  }
}

console.log('\n🎉 Bun compatibility test completed!');
console.log('💡 Run "bun install" to test installation');
console.log('💡 Run "bun run build" to test build process');
