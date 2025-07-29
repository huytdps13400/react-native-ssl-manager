Pod::Spec.new do |s|
    s.name = 'UseSslPinningModule'
    s.version = '1.0.0'
    s.summary = 'SSL Pinning Module for React Native and Expo'
    s.author = 'Huy Tran'
    s.homepage = 'https://github.com/huytdps13400/react-native-ssl-manager'
    s.platforms = { :ios => '13.0' }
    s.source = { :git => 'https://github.com/huytdps13400/react-native-ssl-manager' }
    s.source_files = [
      'SharedLogic.swift',
      'cli/**/*.{h,m,swift}',
      'expo/**/*.{h,m,swift}'
    ]
    s.dependency 'ExpoModulesCore'
    s.dependency 'TrustKit'
  end