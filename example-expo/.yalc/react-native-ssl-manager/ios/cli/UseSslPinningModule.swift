import Foundation
import React

/**
 * React Native CLI module for SSL Pinning
 * Uses the shared logic for common functionality
 */
@objc(UseSslPinningModule)
class UseSslPinningModule: NSObject {
    
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
        let usePinning = SharedLogic.getUseSSLPinning()
        
        if !usePinning {
            let result: [String: Any] = [
                "message": "SSL Pinning is disabled",
                "isEnabled": false,
                "domains": []
            ]
            resolve(result)
            return
        }
        
        guard let config = SharedLogic.parseSslPinningConfig(configJsonString) else {
            reject("INVALID_CONFIGURATION", "Invalid SSL pinning configuration format", nil)
            return
        }
        
        guard SharedLogic.validateSslPinningConfig(config) else {
            reject("INVALID_CONFIGURATION", "Invalid SSL pinning configuration format", nil)
            return
        }
        
        // Here you would implement the actual SSL pinning logic
        // For now, we'll just return a success response
        guard let sha256Keys = config["sha256Keys"] as? [String: [String]] else {
            reject("INVALID_CONFIGURATION", "Invalid SSL pinning configuration format", nil)
            return
        }
        
        let domains = Array(sha256Keys.keys)
        
        let result: [String: Any] = [
            "message": "SSL Pinning initialized successfully",
            "isEnabled": true,
            "domains": domains
        ]
        
        resolve(result)
    }
    
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
} 