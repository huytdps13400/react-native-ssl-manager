# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2024-12-19

### Added
- ✨ **Expo Plugin Support** - Full integration with Expo config plugins
- 🏗️ **New Architecture Support** - TurboModule implementation for React Native 0.68+
- 🔄 **Legacy Architecture Compatibility** - Backward compatibility with older React Native versions
- 📦 **Bun Package Manager Support** - Full support for Bun with dedicated scripts and configuration
- 🧪 **Enhanced Example App** - Improved UI for testing SSL pinning functionality
- 🔧 **Auto-setup Scripts** - Post-install scripts for automatic configuration

### Changed
- 🎯 **Production Optimizations** - Removed debug logs and improved performance
- 📚 **Documentation** - Comprehensive README with installation and usage guides
- 🔧 **Build System** - Improved TypeScript compilation and build process

### Fixed
- 🐛 **Swift Compilation** - Fixed empty switch case compilation errors
- 🐛 **TypeScript Errors** - Resolved unused parameter warnings
- 🐛 **Expo Integration** - Fixed plugin configuration and auto-linking issues

### Technical Details
- **New Architecture**: Full TurboModule implementation with automatic detection
- **Expo Plugin**: Auto-configuration for both Android and iOS projects
- **Bun Support**: Native Bun scripts and configuration files
- **Build Output**: Optimized for production with clean codebase

## [1.0.0] - 2024-12-18

### Added
- 🔒 **SSL Certificate Pinning** - Core SSL pinning functionality
- 📱 **Cross-platform Support** - iOS and Android native implementations
- 🔄 **Dynamic SSL Control** - Enable/disable SSL pinning at runtime
- 📋 **JSON Configuration** - Simple configuration using ssl_config.json
- 🛠️ **Basic API** - setUseSSLPinning and getUseSSLPinning methods

### Initial Release
- Basic SSL pinning implementation
- Native modules for iOS and Android
- Simple configuration system
- Core API functionality
