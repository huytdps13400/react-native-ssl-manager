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
@objc class SharedLogic: NSObject {
    static var sharedTrustKit: TrustKit?
    private static let useSSLPinningKey = "useSSLPinning"
    private static let userDefaults = UserDefaults.standard
    
    /**
     * Set SSL pinning enabled/disabled state
     * Auto-initialize SSL pinning when enabled
     */
    @objc static func setUseSSLPinning(_ usePinning: Bool) {
        userDefaults.set(usePinning, forKey: useSSLPinningKey)
        userDefaults.synchronize()
        
        // Auto-initialize SSL pinning when enabled
        if usePinning {
            do {
                let _ = try initializeSslPinningFromBundle()

            } catch {

            }
        } else {

        }
    }
    
    /**
     * Get current SSL pinning state
     */
    @objc static func getUseSSLPinning() -> Bool {
        // Check if key exists, if not return default true
        if userDefaults.object(forKey: useSSLPinningKey) == nil {

            return true // Default to enabled
        }
        let value = userDefaults.bool(forKey: useSSLPinningKey)

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
        


        
        return cleaned
    }
    
    /**
     * Validate and clean pins for a domain
     */
    static func validateAndCleanPins(_ pins: [String], for domain: String) throws -> [String] {
        guard !pins.isEmpty else {

            throw SSLPinningError.invalidPinConfiguration(domain: domain)
        }
        
        return try pins.map { pin -> String in
            var cleanPin = pin.trimmingCharacters(in: .whitespacesAndNewlines)

            
            // Verify pin format
            guard cleanPin.starts(with: "sha256/") else {

                throw SSLPinningError.invalidPinConfiguration(domain: domain)
            }
            
            // Remove sha256/ prefix for TrustKit
            cleanPin = cleanPin.replacingOccurrences(of: "sha256/", with: "")
            
            // Check base64 format
            guard cleanPin.range(of: "^[A-Za-z0-9+/=]+$", options: .regularExpression) != nil else {

                throw SSLPinningError.invalidPinConfiguration(domain: domain)
            }
            
            // Check length - SHA256 pins should be 44 characters when base64 encoded
            guard cleanPin.count == 44 else {

                throw SSLPinningError.invalidPinConfiguration(domain: domain)
            }
            

            return cleanPin
        }
    }
    
    /**
     * Initialize SSL pinning from bundle (auto-read ssl_config.json)
     */
    @objc static func initializeSslPinningFromBundle() throws -> [String: Any] {
        // Try to read ssl_config.json from main bundle (auto-copied by script phase)
        guard let path = Bundle.main.path(forResource: "ssl_config", ofType: "json"),
              let configData = NSData(contentsOfFile: path),
              let configJsonString = String(data: configData as Data, encoding: .utf8) else {



            throw SSLPinningError.invalidConfiguration
        }
        

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
                

                
                // Initialize TrustKit synchronously to catch initialization errors
                do {


                    
                    // Initialize TrustKit with the configuration

                    TrustKit.initSharedInstance(withConfiguration: trustKitConfig)
                    SharedLogic.sharedTrustKit = TrustKit.sharedInstance()
                    

                    
                    // Verify TrustKit is properly initialized
                    if let trustKit = SharedLogic.sharedTrustKit {


                        
                        // Set up validation callback
                        trustKit.pinningValidatorCallback = { result, notedHostname, policy in


                            switch result.finalTrustDecision {
                            case .shouldBlockConnection:
                                break
                            case .shouldAllowConnection:
                                break
                            default:
                                break
                            }
                        }
                        

                    } else {

                        throw SSLPinningError.invalidConfiguration
                    }
                } catch {

                    throw error
                }
                
                return [
                    "message": "SSL Pinning initialized successfully",
                    "domains": Array(pinnedDomains.keys)
                ]
                
            } catch let error as SSLPinningError {

                throw error
            } catch {

                throw error
            }
        } else {

            return [
                "message": "SSL Pinning is disabled",
                "domains": [],
                "isSSLPinningEnabled": isSSLPinningEnabled
            ]
        }
    }
}