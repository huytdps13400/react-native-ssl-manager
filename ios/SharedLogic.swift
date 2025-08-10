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
     * Auto-initialize SSL pinning when enabled
     */
    static func setUseSSLPinning(_ usePinning: Bool) {
        userDefaults.set(usePinning, forKey: useSSLPinningKey)
        userDefaults.synchronize()
        
        // Auto-initialize SSL pinning when enabled
        if usePinning {
            do {
                let _ = try initializeSslPinningFromBundle()
                NSLog("✅ SSL Pinning auto-initialized successfully")
            } catch {
                NSLog("❌ Failed to auto-initialize SSL Pinning: %@", error.localizedDescription)
            }
        } else {
            NSLog("🔓 SSL Pinning disabled")
        }
    }
    
    /**
     * Get current SSL pinning state
     */
    static func getUseSSLPinning() -> Bool {
        // Check if key exists, if not return default true
        if userDefaults.object(forKey: useSSLPinningKey) == nil {
            NSLog("🔍 SSL setting not found, using default: true")
            return true // Default to enabled
        }
        let value = userDefaults.bool(forKey: useSSLPinningKey)
        NSLog("🔍 SSL setting from UserDefaults: %@", value ? "true" : "false")
        return value
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
     * Initialize SSL pinning from bundle (auto-read ssl_config.json)
     */
    static func initializeSslPinningFromBundle() throws -> [String: Any] {
        // Try to read ssl_config.json from main bundle (auto-copied by script phase)
        guard let path = Bundle.main.path(forResource: "ssl_config", ofType: "json"),
              let configData = NSData(contentsOfFile: path),
              let configJsonString = String(data: configData as Data, encoding: .utf8) else {
            NSLog("❌ ssl_config.json not found in main bundle")
            NSLog("💡 Make sure ssl_config.json exists at project root")
            NSLog("💡 Run 'pod install' to apply script phase")
            throw SSLPinningError.invalidConfiguration
        }
        
        NSLog("📄 Using ssl_config.json from main bundle (auto-copied by script)")
        return try initializeSslPinning(configJsonString)
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
                    NSLog("🔧 Initializing TrustKit with config...")
                    NSLog("🔧 Domains to pin: %@", Array(pinnedDomains.keys))
                    
                    // Initialize TrustKit with the configuration
                    NSLog("🔧 About to call TrustKit.initSharedInstance...")
                    TrustKit.initSharedInstance(withConfiguration: trustKitConfig)
                    SharedLogic.sharedTrustKit = TrustKit.sharedInstance()
                    
                    NSLog("🔧 TrustKit instance after init: %@", SharedLogic.sharedTrustKit ?? "nil")
                    
                    // Verify TrustKit is properly initialized
                    if let trustKit = SharedLogic.sharedTrustKit {
                        NSLog("✅ TrustKit initialized successfully")
                        NSLog("🔧 TrustKit instance: %@", trustKit)
                        
                        // Set up validation callback
                        trustKit.pinningValidatorCallback = { result, notedHostname, policy in
                            NSLog("🌐 TrustKit callback TRIGGERED for domain: %@", notedHostname)
                            NSLog("🔍 Trust decision: %d", result.finalTrustDecision.rawValue)
                            switch result.finalTrustDecision {
                            case .shouldBlockConnection:
                                NSLog("⛔️ SSL Pinning BLOCKED connection for domain: %@", notedHostname)
                                NSLog("⛔️ Policy details: %@", policy)
                            case .shouldAllowConnection:
                                NSLog("✅ SSL Pinning ALLOWED connection for domain: %@", notedHostname)
                                NSLog("✅ Policy details: %@", policy)
                            default:
                                NSLog("⚠️ Unexpected SSL Pinning result for domain: %@", notedHostname)
                            }
                        }
                        
                        NSLog("✅ TrustKit callback configured")
                    } else {
                        NSLog("❌ TrustKit initialization failed - instance is nil")
                        throw SSLPinningError.invalidConfiguration
                    }
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