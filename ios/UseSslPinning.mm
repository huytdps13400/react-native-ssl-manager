#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(UseSslPinning, NSObject)

RCT_EXTERN_METHOD(setUseSSLPinning:(BOOL)usePinning)

RCT_EXTERN_METHOD(getUseSSLPinning:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(initializeSslPinning:(NSString *)configJsonString
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
    return NO;
}

@end
