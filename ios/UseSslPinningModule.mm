#import <React/RCTBridgeModule.h>
#import <objc/message.h>
#import <objc/runtime.h>

/**
 * Eager bootstrap: initialize SSL pinning at app launch, independent of the
 * React Native module lifecycle (which is lazy under the New Architecture and
 * on iOS in general). +load runs at image load, before main(), which is early
 * enough to initialize TrustKit before any URLSession is created.
 *
 * We dispatch into Swift via NSClassFromString to avoid depending on the
 * generated "<module>-Swift.h" header name, which varies by module name. The
 * Swift class is annotated @objc(SharedLogic) so its runtime name is stable.
 */
@interface RNSSLManagerBootstrap : NSObject
@end

@implementation RNSSLManagerBootstrap

+ (void)load {
  Class sharedLogic = NSClassFromString(@"SharedLogic");
  SEL bootstrap = NSSelectorFromString(@"bootstrapIfEnabled");
  if (sharedLogic != nil && [sharedLogic respondsToSelector:bootstrap]) {
    ((void (*)(id, SEL))objc_msgSend)(sharedLogic, bootstrap);
  }
}

@end

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

RCT_EXTERN_METHOD(setSSLConfig:(NSString *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getPinnedDomains:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
#endif
