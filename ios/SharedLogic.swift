import Foundation
import TrustKit

/**
 * Shared logic for SSL pinning functionality
 * Contains common methods used by both CLI and Expo modules
 */
class SharedLogic {
    private static let useSSLPinningKey = "useSSLPinning"
    private static let userDefaults = UserDefaults.standard
    
    /**
     * Set SSL pinning enabled/disabled state
     */
    static func setUseSSLPinning(_ usePinning: Bool) {
        userDefaults.set(usePinning, forKey: useSSLPinningKey)
        userDefaults.synchronize()
    }
    
    /**
     * Get current SSL pinning state
     */
    static func getUseSSLPinning() -> Bool {
        return userDefaults.bool(forKey: useSSLPinningKey)
    }
    
    /**
     * Parse SSL pinning configuration from JSON string
     */
    static func parseSslPinningConfig(_ configJsonString: String) -> [String: Any]? {
        guard let jsonData = configJsonString.data(using: .utf8) else {
            return nil
        }
        
        do {
            let config = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]
            return config
        } catch {
            return nil
        }
    }
    
    /**
     * Validate SSL pinning configuration
     */
    static func validateSslPinningConfig(_ config: [String: Any]) -> Bool {
        guard let sha256Keys = config["sha256Keys"] as? [String: [String]] else {
            return false
        }
        
        return !sha256Keys.isEmpty
    }
    
    /**
     * Create TrustKit configuration for SSL pinning
     */
    static func createTrustKitConfig(from config: [String: Any]) -> [String: Any]? {
        guard let sha256Keys = config["sha256Keys"] as? [String: [String]] else {
            return nil
        }
        
        var pinnedDomains: [String: Any] = [:]
        
        for (domain, pins) in sha256Keys {
            let cleanedPins = pins.map { $0.replacingOccurrences(of: "sha256/", with: "") }
            pinnedDomains[domain] = [
                "TSKIncludeSubdomains": true,
                "TSKEnforcePinning": true,
                "TSKDisableDefaultReportUri": true,
                "TSKPublicKeyHashes": cleanedPins
            ]
        }
        
        return [
            "TSKSwizzleNetworkDelegates": true,
            "TSKPinnedDomains": pinnedDomains
        ]
    }
} 