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
            do {
                return try SharedLogic.initializeSslPinning(configJsonString)
            } catch let error as SSLPinningError {
                NSLog("❌ SSL Pinning Error: %@", error.message)
                throw Exception(name: "SSL_PINNING_ERROR", description: error.message)
            } catch {
                NSLog("❌ Unexpected Error: %@", error.localizedDescription)
                throw Exception(name: "SSL_PINNING_ERROR", description: "Unexpected error during SSL pinning initialization")
            }
        }
    }
} 