import ExpoModulesCore
import TrustKit

/**
 * Expo module for SSL Pinning
 * Uses Expo Modules API and shared logic for common functionality
 * Auto-initializes SSL pinning like CLI module for consistency
 */
public class UseSslPinningExpoModule: Module {
    
    public override init() {
        super.init()
        
        // Early initialization - setup SSL pinning if enabled (same as CLI module)
        let isEnabled = SharedLogic.getUseSSLPinning()
        if isEnabled {
            do {
                let _ = try SharedLogic.initializeSslPinningFromBundle()
                NSLog("✅ SSL Pinning early initialization successful (Expo)")
            } catch {
                NSLog("❌ SSL Pinning early initialization failed (Expo): %@", error.localizedDescription)
            }
        } else {
            NSLog("🔓 SSL Pinning disabled on startup (Expo)")
        }
    }
    
    public func definition() -> ModuleDefinition {
        Name("UseSslPinning")
        
        AsyncFunction("setUseSSLPinning") { (usePinning: Bool) in
            SharedLogic.setUseSSLPinning(usePinning)
        }
        
        AsyncFunction("getUseSSLPinning") { () -> Bool in
            return SharedLogic.getUseSSLPinning()
        }
        
        // Removed initializeSslPinning function for consistency with CLI module
        // SSL pinning is auto-initialized from bundle in init() method
    }
} 