Pod::Spec.new do |s|
  s.name = 'react-native-ssl-manager'
  s.version = '1.0.0'
  s.summary = 'SSL Pinning Module for React Native and Expo'
  s.author = 'Huy Tran'
  s.homepage = 'https://github.com/huytdps13400/react-native-ssl-manager'
  s.platforms = { :ios => '13.0' }
  s.source = { :git => 'https://github.com/huytdps13400/react-native-ssl-manager' }
  # Default to CLI files only for React Native CLI environment  
  s.source_files = [
    'ios/SharedLogic.swift',
    'ios/cli/**/*.{h,m,swift}',
    'ios/UseSslPinning.h'
  ]
  
  # Only include Expo files if ExpoModulesCore is available
  begin
    require 'expo_modules_core'
    s.source_files += ['ios/expo/**/*.{h,m,swift}']
    s.dependency 'ExpoModulesCore'
  rescue LoadError
    # ExpoModulesCore not available, stick with CLI files only
  end
  
  s.dependency 'TrustKit'
  s.dependency 'React-Core'
end 