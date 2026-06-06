// React Native SSL Manager
//
// Native linking is handled automatically:
//  - The Nitro Module autolinks via nitro.json + the generated autolinking
//    files (iOS podspec / Android Gradle + CMake), so no manual package
//    registration is required.
//  - The bundled `ssl_config.json` is wired by the Gradle script (Android) and
//    the podspec script phase (iOS), or by the Expo config plugin (app.plugin.js).
//
// An empty config lets React Native CLI use its default platform autolinking.
module.exports = {};
