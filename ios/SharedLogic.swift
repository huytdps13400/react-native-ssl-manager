import Foundation
import TrustKit
import TrustKit.TSKPinningValidator
import TrustKit.TSKPinningValidatorCallback

enum SSLPinningError: Error {
    case invalidConfiguration
    case invalidPinConfiguration(domain: String)
    
    var message: String {
        switch self {
        case .invalidConfiguration:
            return "Invalid SSL pinning configuration format"
        case .invalidPinConfiguration(let domain):
            return "Invalid pin configuration for domain: \(domain)"
        }
    }
}

/**
 * Shared logic for SSL pinning functionality
 * Contains common methods used by both CLI and Expo modules
 */
class SharedLogic {
    static var sharedTrustKit: TrustKit?
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
     * Clean JSON string from various formatting issues
     */
    static func cleanJsonString(_ jsonString: String) -> String {
        var cleaned = jsonString
            .replacingOccurrences(of: "\n", with: "")
            .replacingOccurrences(of: "| ", with: "")
            .replacingOccurrences(of: "\\ ", with: "")
            .replacingOccurrences(of: "\\\"", with: "\"")
        
        // Remove any remaining backslashes before quotes
        cleaned = cleaned.replacingOccurrences(of: "\\(?!\")", with: "")
        
        // Clean up any double spaces
        cleaned = cleaned.replacingOccurrences(of: "  ", with: " ")
        
        NSLog("Original JSON: %@", jsonString)
        NSLog("Cleaned JSON: %@", cleaned)
        
        return cleaned
    }
    
    /**
     * Validate and clean pins for a domain
     */
    static func validateAndCleanPins(_ pins: [String], for domain: String) throws -> [String] {
        guard !pins.isEmpty else {
            NSLog("❌ No pins provided for domain: %@", domain)
            throw SSLPinningError.invalidPinConfiguration(domain: domain)
        }
        
        return try pins.map { pin -> String in
            var cleanPin = pin.trimmingCharacters(in: .whitespacesAndNewlines)
            NSLog("🔍 Processing pin for domain %@: %@", domain, cleanPin)
            
            // Verify pin format
            guard cleanPin.starts(with: "sha256/") else {
                NSLog("❌ Invalid pin format (missing sha256/) for domain %@: %@", domain, cleanPin)
                throw SSLPinningError.invalidPinConfiguration(domain: domain)
            }
            
            // Remove sha256/ prefix for TrustKit
            cleanPin = cleanPin.replacingOccurrences(of: "sha256/", with: "")
            
            // Check base64 format
            guard cleanPin.range(of: "^[A-Za-z0-9+/=]+$", options: .regularExpression) != nil else {
                NSLog("❌ Invalid pin format (not base64) for domain %@: %@", domain, cleanPin)
                throw SSLPinningError.invalidPinConfiguration(domain: domain)
            }
            
            // Check length - SHA256 pins should be 44 characters when base64 encoded
            guard cleanPin.count == 44 else {
                NSLog("❌ Invalid pin length for domain %@ (expected 44, got %d): %@", domain, cleanPin.count, cleanPin)
                throw SSLPinningError.invalidPinConfiguration(domain: domain)
            }
            
            NSLog("✅ Valid pin for domain %@: %@", domain, cleanPin)
            return cleanPin
        }
    }
    
    /**
     * Initialize SSL pinning with TrustKit
     * Ported from original working code with minimal modifications
     */
    static func initializeSslPinning(_ configJsonString: String) throws -> [String: Any] {
        // Check if SSL pinning is enabled
        let isSSLPinningEnabled = getUseSSLPinning()
        
        if isSSLPinningEnabled {
            do {
                // Clean JSON first
                let cleanedJson = cleanJsonString(configJsonString)
                
                // Parse JSON configuration
                guard let jsonData = cleanedJson.data(using: .utf8),
                      let config = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any],
                      let sha256Keys = config["sha256Keys"] as? [String: [String]] else {
                    throw SSLPinningError.invalidConfiguration
                }
                
                // Build pinned domains configuration
                var pinnedDomains: [String: Any] = [:]
                
                // Process each domain and its pins from JSON
                for (domain, pins) in sha256Keys {
                    let cleanedPins = try validateAndCleanPins(pins, for: domain)
                    
                    pinnedDomains[domain] = [
                        kTSKIncludeSubdomains: true,
                        kTSKEnforcePinning: true,
                        kTSKDisableDefaultReportUri: true,
                        kTSKPublicKeyHashes: cleanedPins
                    ]
                }
                
                let trustKitConfig: [String: Any] = [
                    kTSKSwizzleNetworkDelegates: true,
                    kTSKPinnedDomains: pinnedDomains
                ]
                
                NSLog("✅ TrustKit config: %@", trustKitConfig)
                
                // Initialize TrustKit synchronously to catch initialization errors
                do {
                    // Initialize TrustKit with the configuration
                    TrustKit.initSharedInstance(withConfiguration: trustKitConfig)
                    SharedLogic.sharedTrustKit = TrustKit.sharedInstance()
                    
                    // Set up validation callback
                    TrustKit.sharedInstance().pinningValidatorCallback = { result, notedHostname, policy in
                        switch result.finalTrustDecision {
                        case .shouldBlockConnection:
                            NSLog("⛔️ SSL Pinning failed for domain: %@", notedHostname)
                            NSLog("Policy details: %@", policy)
                        case .shouldAllowConnection:
                            NSLog("✅ SSL Pinning succeeded for domain: %@", notedHostname)
                        default:
                            NSLog("⚠️ Unexpected SSL Pinning result for domain: %@", notedHostname)
                        }
                    }
                    
                    NSLog("✅ TrustKit initialized successfully")
                } catch {
                    NSLog("❌ TrustKit initialization error: %@", error.localizedDescription)
                    throw error
                }
                
                return [
                    "message": "SSL Pinning initialized successfully",
                    "domains": Array(pinnedDomains.keys)
                ]
                
            } catch let error as SSLPinningError {
                NSLog("❌ SSL Pinning Error: %@", error.message)
                throw error
            } catch {
                NSLog("❌ Unexpected Error: %@", error.localizedDescription)
                throw error
            }
        } else {
            NSLog("⚠️ SSL Pinning is disabled")
            return [
                "message": "SSL Pinning is disabled",
                "domains": [],
                "isSSLPinningEnabled": isSSLPinningEnabled
            ]
        }
    }
}