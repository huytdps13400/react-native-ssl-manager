import Foundation
import React

/**
 * React Native CLI module for SSL Pinning
 * Uses the shared logic for common functionality
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

            }
        } else {

        }
    }
    
    @objc
    func setUseSSLPinning(_ usePinning: Bool, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        SharedLogic.setUseSSLPinning(usePinning)
        resolve(nil)
    }
    
    @objc
    func getUseSSLPinning(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let usePinning = SharedLogic.getUseSSLPinning()
        resolve(usePinning)
    }
    
    
}