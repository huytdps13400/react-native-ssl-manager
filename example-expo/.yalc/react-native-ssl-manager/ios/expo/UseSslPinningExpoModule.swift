import ExpoModulesCore
import TrustKit

/**
 * Expo module for SSL Pinning
 * Uses Expo Modules API and shared logic for common functionality
 */
public class UseSslPinningExpoModule: Module {
    
    public func definition() -> ModuleDefinition {
        Name("UseSslPinning")
        
        AsyncFunction("setUseSSLPinning") { (usePinning: Bool) in
            SharedLogic.setUseSSLPinning(usePinning)
        }
        
        AsyncFunction("getUseSSLPinning") { () -> Bool in
            return SharedLogic.getUseSSLPinning()
        }
        
        AsyncFunction("initializeSslPinning") { (configJsonString: String) -> [String: Any] in
            let usePinning = SharedLogic.getUseSSLPinning()
            
            if !usePinning {
                return [
                    "message": "SSL Pinning is disabled",
                    "isEnabled": false,
                    "domains": []
                ]
            }
            
            guard let config = SharedLogic.parseSslPinningConfig(configJsonString) else {
                throw Exception(name: "INVALID_CONFIGURATION", description: "Invalid SSL pinning configuration format")
            }
            
            guard SharedLogic.validateSslPinningConfig(config) else {
                throw Exception(name: "INVALID_CONFIGURATION", description: "Invalid SSL pinning configuration format")
            }
            
            guard let trustKitConfig = SharedLogic.createTrustKitConfig(from: config) else {
                throw Exception(name: "INVALID_CONFIGURATION", description: "Failed to create TrustKit configuration")
            }
            
            guard let sha256Keys = config["sha256Keys"] as? [String: [String]] else {
                throw Exception(name: "INVALID_CONFIGURATION", description: "Invalid SSL pinning configuration format")
            }
            
            let domains = Array(sha256Keys.keys)
            
            DispatchQueue.main.async {
                TrustKit.initSharedInstance(withConfiguration: trustKitConfig)
            }
            
            return [
                "message": "SSL Pinning initialized successfully",
                "isEnabled": true,
                "domains": domains
            ]
        }
    }
} 