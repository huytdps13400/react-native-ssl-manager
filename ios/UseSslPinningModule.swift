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
        
        // Early initialization - setup SSL pinning if enabled
        let isEnabled = SharedLogic.getUseSSLPinning()
        if isEnabled {
            do {
                let _ = try SharedLogic.initializeSslPinningFromBundle()
            } catch {
                // SSL config not found or invalid - continue silently
            }
        }
    }
    
    // MARK: - Shared Implementation Methods
    
    private func setUseSSLPinningImpl(_ usePinning: Bool, resolve: @escaping RCTPromiseResolveBlock) {
        SharedLogic.setUseSSLPinning(usePinning)
        resolve(nil)
    }
    
    private func getUseSSLPinningImpl(_ resolve: @escaping RCTPromiseResolveBlock) {
        let usePinning = SharedLogic.getUseSSLPinning()
        resolve(usePinning)
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
    
#endif
    
}