import Foundation
import React

/**
 * React Native SSL Pinning module - supports both architectures
 * Uses conditional compilation for New Architecture vs Legacy
 */
@objc(UseSslPinning)
class UseSslPinning: NSObject {

    override init() {
        super.init()

        // Redundant safety net: the primary initialization happens at app launch
        // via the Objective-C +load bootstrap (see UseSslPinningModule.mm). This
        // covers cases where the bootstrap object was not linked/loaded.
        SharedLogic.bootstrapIfEnabled()
    }

    // MARK: - Shared Implementation Methods

    private func setUseSSLPinningImpl(_ usePinning: Bool, resolve: @escaping RCTPromiseResolveBlock) {
        SharedLogic.setUseSSLPinning(usePinning)
        resolve(nil)
    }

    private func getUseSSLPinningImpl(_ resolve: @escaping RCTPromiseResolveBlock) {
        resolve(SharedLogic.getUseSSLPinning())
    }

    private func setSSLConfigImpl(_ config: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        do {
            try SharedLogic.setSSLConfig(config)
            resolve(nil)
        } catch let error as SSLPinningError {
            reject(error.code, error.message, error)
        } catch {
            reject("SSL_CONFIG_ERROR", error.localizedDescription, error)
        }
    }

    private func getPinnedDomainsImpl(_ resolve: @escaping RCTPromiseResolveBlock) {
        resolve(SharedLogic.getPinnedDomains())
    }

    // MARK: - Architecture-specific exports

#if RCT_NEW_ARCH_ENABLED

    // New Architecture (TurboModule) - no @objc needed
    func setUseSSLPinning(_ usePinning: Bool, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        setUseSSLPinningImpl(usePinning, resolve: resolve)
    }

    func getUseSSLPinning(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        getUseSSLPinningImpl(resolve)
    }

    func setSSLConfig(_ config: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        setSSLConfigImpl(config, resolve: resolve, reject: reject)
    }

    func getPinnedDomains(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        getPinnedDomainsImpl(resolve)
    }

#else

    // Legacy Architecture (Bridge) - needs @objc
    @objc
    func setUseSSLPinning(_ usePinning: Bool, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        setUseSSLPinningImpl(usePinning, resolve: resolve)
    }

    @objc
    func getUseSSLPinning(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        getUseSSLPinningImpl(resolve)
    }

    @objc
    func setSSLConfig(_ config: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        setSSLConfigImpl(config, resolve: resolve, reject: reject)
    }

    @objc
    func getPinnedDomains(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        getPinnedDomainsImpl(resolve)
    }

#endif

}
