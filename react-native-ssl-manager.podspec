Pod::Spec.new do |s|
  s.name = 'react-native-ssl-manager'
  s.version = '1.0.0'
  s.summary = 'SSL Pinning Module for React Native and Expo'
  s.author = 'Huy Tran'
  s.homepage = 'https://github.com/huytdps13400/react-native-ssl-manager'
  s.platforms = { :ios => '13.0' }
  s.source = { :git => 'https://github.com/huytdps13400/react-native-ssl-manager' }
  

  
  # RNBootSplash pattern - single implementation for all architectures  
  s.source_files = "ios/**/*.{h,m,mm,swift}"
  
  s.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }
  
  if ENV['RCT_NEW_ARCH_ENABLED'] == '1' then
    # New Architecture dependencies would go here if needed
    s.dependency "React-Core"
  else
    s.dependency "React-Core"
  end
  
  # Use script phase to copy ssl_config.json during app build
  s.script_phases = [
    {
      :name => 'Copy SSL Config to App Bundle',
      :script => '
        echo "🔧 SSL Manager: Copying ssl_config.json to app bundle..."
        
        # Look for ssl_config.json in parent directories of SRCROOT
        SSL_CONFIG_SOURCE=""
        
        # Check common locations and verify content is not empty
        if [ -f "${SRCROOT}/../ssl_config.json" ]; then
          CONTENT=$(cat "${SRCROOT}/../ssl_config.json" | tr -d " \\n\\r")
          if [ "$CONTENT" != "{}" ]; then
            SSL_CONFIG_SOURCE="${SRCROOT}/../ssl_config.json"
            echo "📄 Found ssl_config.json at: $SSL_CONFIG_SOURCE"
          fi
        fi
        
        if [ -z "$SSL_CONFIG_SOURCE" ] && [ -f "${SRCROOT}/../../ssl_config.json" ]; then
          CONTENT=$(cat "${SRCROOT}/../../ssl_config.json" | tr -d " \\n\\r")
          if [ "$CONTENT" != "{}" ]; then
            SSL_CONFIG_SOURCE="${SRCROOT}/../../ssl_config.json"
            echo "📄 Found ssl_config.json at: $SSL_CONFIG_SOURCE"
          fi
        fi
        
        if [ -z "$SSL_CONFIG_SOURCE" ] && [ -f "${SRCROOT}/../../../ssl_config.json" ]; then
          CONTENT=$(cat "${SRCROOT}/../../../ssl_config.json" | tr -d " \\n\\r")
          if [ "$CONTENT" != "{}" ]; then
            SSL_CONFIG_SOURCE="${SRCROOT}/../../../ssl_config.json"
            echo "📄 Found ssl_config.json at: $SSL_CONFIG_SOURCE"
          fi
        fi
        
        if [ -n "$SSL_CONFIG_SOURCE" ]; then
          # Copy to app bundle resources
          cp "$SSL_CONFIG_SOURCE" "${BUILT_PRODUCTS_DIR}/${PRODUCT_NAME}.app/"
          echo "✅ SSL config copied to app bundle"
        else
          echo "⚠️ ssl_config.json not found in common locations"
          echo "🔍 Searching for ssl_config.json with content..."
          
          # Search for any ssl_config.json with content
          for path in $(find "${SRCROOT}/../.." -name "ssl_config.json" -type f 2>/dev/null); do
            CONTENT=$(cat "$path" | tr -d " \\n\\r")
            if [ "$CONTENT" != "{}" ]; then
              SSL_CONFIG_SOURCE="$path"
              echo "📄 Found ssl_config.json with content at: $SSL_CONFIG_SOURCE"
              cp "$SSL_CONFIG_SOURCE" "${BUILT_PRODUCTS_DIR}/${PRODUCT_NAME}.app/"
              echo "✅ SSL config copied to app bundle"
              break
            fi
          done
          
          if [ -z "$SSL_CONFIG_SOURCE" ]; then
            echo "💡 SRCROOT: $SRCROOT"
            echo "💡 Create ssl_config.json at project root for SSL pinning to work"
            exit 0
          fi
        fi
      ',
      :execution_position => :before_compile
    }
  ]
  
  s.dependency 'TrustKit'
  s.dependency 'React-Core'
end 