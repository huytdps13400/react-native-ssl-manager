import Foundation
import TrustKit
import TrustKit.TSKPinningValidator
import TrustKit.TSKPinningValidatorCallback

// Add SSLPinningError enum definition
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

@objc(UseSslPinning)
class UseSslPinning: NSObject {
    private static var sharedTrustKit: TrustKit?
    private let userDefaults = UserDefaults.standard
    private let useSSLPinningKey = "useSSLPinning"
    
    private func cleanJsonString(_ jsonString: String) -> String {
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
    
    private func validateAndCleanPins(_ pins: [String], for domain: String) throws -> [String] {
        return try pins.map { pin -> String in
            var cleanPin = pin.trimmingCharacters(in: .whitespacesAndNewlines)
            
            // Verify pin format
            guard cleanPin.starts(with: "sha256/") else {
                NSLog("Invalid pin format (missing sha256/): %@", cleanPin)
                throw SSLPinningError.invalidPinConfiguration(domain: domain)
            }
            
            // Remove sha256/ prefix for TrustKit
            cleanPin = cleanPin.replacingOccurrences(of: "sha256/", with: "")
            
            // Verify base64 format
            guard cleanPin.range(of: "^[A-Za-z0-9+/=]+$", options: .regularExpression) != nil else {
                NSLog("Invalid pin format (not base64): %@", cleanPin)
                throw SSLPinningError.invalidPinConfiguration(domain: domain)
            }
            
            return cleanPin
        }
    }
    
    @objc
    func initializeSslPinning(_ configJsonString: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        // Check if SSL pinning is enabled
        let isSSLPinningEnabled = userDefaults.bool(forKey: useSSLPinningKey)
        
        if isSSLPinningEnabled {
            do {
                // Parse JSON configuration
                guard let jsonData = configJsonString.data(using: .utf8),
                      let config = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any],
                      let sha256Keys = config["sha256Keys"] as? [String: [String]] else {
                    throw SSLPinningError.invalidConfiguration
                }
                
                // Build pinned domains configuration
                var pinnedDomains: [String: Any] = [:]
                
                // Process each domain and its pins from JSON
                for (domain, pins) in sha256Keys {
                    let cleanedPins = try pins.map { pin -> String in
                        // Validate and clean the pin
                        var cleanPin = pin.trimmingCharacters(in: .whitespacesAndNewlines)
                        
                        // Verify pin format
                        guard cleanPin.starts(with: "sha256/") else {
                            NSLog("Invalid pin format for domain %@: %@", domain, cleanPin)
                            throw SSLPinningError.invalidPinConfiguration(domain: domain)
                        }
                        
                        // Remove sha256/ prefix for TrustKit
                        cleanPin = cleanPin.replacingOccurrences(of: "sha256/", with: "")
                        
                        return cleanPin
                    }
                    
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
                
                DispatchQueue.main.async {
                    // Initialize TrustKit with the configuration
                    TrustKit.initSharedInstance(withConfiguration: trustKitConfig)
                    
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
                    
                    NSLog("✅ TrustKit initialized with config: %@", trustKitConfig)
                    resolve([
                        "message": "SSL Pinning initialized successfully",
                        "domains": Array(pinnedDomains.keys)
                    ])
                }
                
            } catch let error as SSLPinningError {
                NSLog("❌ SSL Pinning Error: %@", error.message)
                reject("SSL_PINNING_ERROR", error.message, error)
            } catch {
                NSLog("❌ Unexpected Error: %@", error.localizedDescription)
                reject("SSL_PINNING_ERROR", "Unexpected error during SSL pinning initialization", error)
            }
        } else {
            NSLog("⚠️ SSL Pinning is disabled",isSSLPinningEnabled)
            resolve([
                "message": "SSL Pinning is disabled",
                "domains": [],
                "isSSLPinningEnabled": isSSLPinningEnabled
            ])
        }
    }
    
    @objc
    func setUseSSLPinning(_ usePinning: Bool) {
        userDefaults.set(usePinning, forKey: useSSLPinningKey)
        userDefaults.synchronize()
    }
    
    @objc
    func getUseSSLPinning(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
        let usePinning = userDefaults.bool(forKey: useSSLPinningKey)
        resolve(usePinning)
    }
}
