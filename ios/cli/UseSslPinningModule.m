#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(UseSslPinning, NSObject)

RCT_EXTERN_METHOD(setUseSSLPinning:(BOOL)usePinning
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getUseSSLPinning:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Removed initializeSslPinning method for consistency with workflow
// SSL pinning is auto-initialized in init() method

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end