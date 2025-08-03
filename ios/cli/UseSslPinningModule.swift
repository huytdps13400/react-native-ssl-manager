import Foundation
import React

/**
 * React Native CLI module for SSL Pinning
 * Uses the shared logic for common functionality
 */
@objc(UseSslPinning)
class UseSslPinning: NSObject {
    
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
    
    @objc
    func initializeSslPinning(_ configJsonString: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        do {
            let result = try SharedLogic.initializeSslPinning(configJsonString)
            resolve(result)
        } catch let error as SSLPinningError {
            NSLog("❌ SSL Pinning Error: %@", error.message)
            reject("SSL_PINNING_ERROR", error.message, error)
        } catch {
            NSLog("❌ Unexpected Error: %@", error.localizedDescription)
            reject("SSL_PINNING_ERROR", "Unexpected error during SSL pinning initialization", error)
        }
    }
}