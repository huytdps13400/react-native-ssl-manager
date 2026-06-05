import Foundation
import TrustKit
import TrustKit.TSKPinningValidator
import TrustKit.TSKPinningValidatorCallback

enum SSLPinningError: Error {
    case invalidConfiguration
    case invalidPinConfiguration(domain: String)
    case configNotFound

    var code: String {
        switch self {
        case .invalidConfiguration:
            return "INVALID_CONFIGURATION"
        case .invalidPinConfiguration:
            return "INVALID_PIN_CONFIGURATION"
        case .configNotFound:
            return "CONFIG_NOT_FOUND"
        }
    }

    var message: String {
        switch self {
        case .invalidConfiguration:
            return "Invalid SSL pinning configuration format"
        case .invalidPinConfiguration(let domain):
            return "Invalid pin configuration for domain: \(domain)"
        case .configNotFound:
            return "ssl_config.json was not found in the app bundle or runtime config"
        }
    }
}

/**
 * Shared logic for SSL pinning functionality
 * Contains common methods used by both CLI and Expo modules
 */
@objc(SharedLogic)
class SharedLogic: NSObject {
    static var sharedTrustKit: TrustKit?
    private static let useSSLPinningKey = "useSSLPinning"
    private static let sslConfigKey = "sslConfig"
    private static let userDefaults = UserDefaults.standard

    // TrustKit can only be initialized once per process. Guard against repeated
    // initialization (bootstrap + JS call) which would otherwise crash.
    private static var trustKitInitialized = false

    /**
     * Bootstrap entry point invoked at app launch (via Objective-C +load).
     * Non-throwing: any failure is swallowed so launch is never blocked.
     */
    @objc static func bootstrapIfEnabled() {
        guard getUseSSLPinning() else { return }
        do {
            let _ = try initializeSslPinning()
        } catch {
            // Config missing or invalid at launch — continue silently.
        }
    }

    /**
     * Set SSL pinning enabled/disabled state
     * Auto-initialize SSL pinning when enabled.
     *
     * Note: TrustKit cannot be un-initialized within a running process, so
     * disabling at runtime takes effect on the next app launch.
     */
    @objc static func setUseSSLPinning(_ usePinning: Bool) {
        userDefaults.set(usePinning, forKey: useSSLPinningKey)
        userDefaults.synchronize()

        if usePinning {
            do {
                let _ = try initializeSslPinning()
            } catch {
                // Initialization failed — state is still persisted.
            }
        }
    }

    /**
     * Get current SSL pinning state
     */
    @objc static func getUseSSLPinning() -> Bool {
        if userDefaults.object(forKey: useSSLPinningKey) == nil {
            return true // Default to enabled
        }
        return userDefaults.bool(forKey: useSSLPinningKey)
    }

    /**
     * Persist a runtime SSL configuration (JSON string) and (re)initialize.
     * Throws if the configuration is invalid.
     */
    @objc static func setSSLConfig(_ jsonString: String) throws {
        // Validate before persisting so callers get immediate feedback.
        let _ = try parseConfig(jsonString)
        userDefaults.set(jsonString, forKey: sslConfigKey)
        userDefaults.synchronize()

        if getUseSSLPinning() {
            let _ = try initializeSslPinning()
        }
    }

    /**
     * Return the list of domains in the active configuration (runtime or bundle).
     * Returns an empty array when no configuration is available.
     */
    @objc static func getPinnedDomains() -> [String] {
        guard let configJsonString = loadConfigJsonString(),
              let sha256Keys = try? parseConfig(configJsonString) else {
            return []
        }
        return Array(sha256Keys.keys)
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
     * Parse a configuration JSON string into the full configuration object.
     * Tries a direct parse first and only falls back to string-cleaning when
     * the direct parse fails (handles escaped/embedded JSON edge cases).
     * The object must contain a `sha256Keys` map.
     */
    static func parseFullConfig(_ jsonString: String) throws -> [String: Any] {
        func extract(_ candidate: String) -> [String: Any]? {
            guard let data = candidate.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any],
                  json["sha256Keys"] is [String: [String]] else {
                return nil
            }
            return json
        }

        if let json = extract(jsonString) {
            return json
        }
        if let json = extract(cleanJsonString(jsonString)) {
            return json
        }
        throw SSLPinningError.invalidConfiguration
    }

    /**
     * Parse a configuration JSON string into its sha256Keys map.
     */
    static func parseConfig(_ jsonString: String) throws -> [String: [String]] {
        let json = try parseFullConfig(jsonString)
        guard let sha256Keys = json["sha256Keys"] as? [String: [String]] else {
            throw SSLPinningError.invalidConfiguration
        }
        return sha256Keys
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
     * Resolve the active configuration JSON: prefer the runtime config set via
     * setSSLConfig, then fall back to the bundled ssl_config.json.
     */
    static func loadConfigJsonString() -> String? {
        if let runtime = userDefaults.string(forKey: sslConfigKey), !runtime.isEmpty {
            return runtime
        }

        guard let path = Bundle.main.path(forResource: "ssl_config", ofType: "json"),
              let configData = NSData(contentsOfFile: path),
              let configJsonString = String(data: configData as Data, encoding: .utf8) else {
            return nil
        }
        return configJsonString
    }

    /**
     * Initialize SSL pinning from bundle (auto-read ssl_config.json).
     * Kept for backwards compatibility — delegates to initializeSslPinning().
     */
    @objc static func initializeSslPinningFromBundle() throws -> [String: Any] {
        return try initializeSslPinning()
    }

    /**
     * Initialize SSL pinning with TrustKit using the active configuration.
     */
    @objc static func initializeSslPinning() throws -> [String: Any] {
        guard let configJsonString = loadConfigJsonString() else {
            throw SSLPinningError.configNotFound
        }
        return try initializeSslPinning(configJsonString)
    }

    /**
     * Initialize SSL pinning with TrustKit
     */
    static func initializeSslPinning(_ configJsonString: String) throws -> [String: Any] {
        // Check if SSL pinning is enabled
        let isSSLPinningEnabled = getUseSSLPinning()

        guard isSSLPinningEnabled else {
            return [
                "message": "SSL Pinning is disabled",
                "domains": [],
                "isSSLPinningEnabled": isSSLPinningEnabled
            ]
        }

        let config = try parseFullConfig(configJsonString)
        guard let sha256Keys = config["sha256Keys"] as? [String: [String]] else {
            throw SSLPinningError.invalidConfiguration
        }

        // Build pinned domains configuration
        var pinnedDomains: [String: Any] = [:]
        for (domain, pins) in sha256Keys {
            let cleanedPins = try validateAndCleanPins(pins, for: domain)
            let domainConfig: [String: Any] = [
                kTSKIncludeSubdomains: true,
                kTSKEnforcePinning: true,
                kTSKDisableDefaultReportUri: true,
                kTSKPublicKeyHashes: cleanedPins
            ]
            pinnedDomains[domain] = domainConfig
        }

        // TrustKit can only be initialized once per process. Re-initialization
        // is a no-op (the new config applies on next launch) and avoids crashes.
        if trustKitInitialized {
            return [
                "message": "SSL Pinning already initialized (changes apply on next launch)",
                "domains": Array(pinnedDomains.keys),
                "alreadyInitialized": true
            ]
        }

        let trustKitConfig: [String: Any] = [
            kTSKSwizzleNetworkDelegates: true,
            kTSKPinnedDomains: pinnedDomains
        ]

        TrustKit.initSharedInstance(withConfiguration: trustKitConfig)
        SharedLogic.sharedTrustKit = TrustKit.sharedInstance()
        trustKitInitialized = true

        guard let trustKit = SharedLogic.sharedTrustKit else {
            throw SSLPinningError.invalidConfiguration
        }

        // Set up validation callback (currently a no-op observer hook)
        trustKit.pinningValidatorCallback = { result, _, _ in
            switch result.finalTrustDecision {
            case .shouldBlockConnection:
                break
            case .shouldAllowConnection:
                break
            default:
                break
            }
        }

        return [
            "message": "SSL Pinning initialized successfully",
            "domains": Array(pinnedDomains.keys)
        ]
    }
}
