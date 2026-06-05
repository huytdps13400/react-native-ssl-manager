#import <Foundation/Foundation.h>
#import <objc/message.h>
#import <objc/runtime.h>

/**
 * Eager bootstrap: initialize SSL pinning at app launch, independent of the
 * React Native / Nitro module lifecycle (which is lazy). +load runs at image
 * load, before main(), which is early enough to initialize TrustKit before any
 * URLSession is created.
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
