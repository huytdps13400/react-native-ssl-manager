#!/bin/bash

# Build script for react-native-ssl-manager
# This script helps build and test the library

set -e

echo "🚀 Building react-native-ssl-manager..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf lib/
rm -rf build/

# Install dependencies
echo "📦 Installing dependencies..."
yarn install

# Type check
echo "🔍 Running type check..."
yarn typecheck

# Build TypeScript
echo "🔨 Building TypeScript..."
yarn build

# Run tests
echo "🧪 Running tests..."
yarn test

echo "✅ Build completed successfully!"

# Optional: Build examples
if [ "$1" = "--with-examples" ]; then
    echo "📱 Building examples..."
    
    # Build React Native CLI example
    echo "Building React Native CLI example..."
    cd example
    yarn install
    cd ..
    
    # Build Expo example
    echo "Building Expo example..."
    cd example-expo
    yarn install
    cd ..
    
    echo "✅ Examples built successfully!"
fi

echo "🎉 All done! The library is ready for use." 