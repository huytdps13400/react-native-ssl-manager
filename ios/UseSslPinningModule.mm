#import <React/RCTBridgeModule.h>

#if RCT_NEW_ARCH_ENABLED
// New Architecture - TurboModule will be handled by Swift
#else
// Legacy Architecture - Bridge exports for Swift module
@interface RCT_EXTERN_MODULE(UseSslPinning, NSObject)

RCT_EXTERN_METHOD(setUseSSLPinning:(BOOL)usePinning
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getUseSSLPinning:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
#endif
