import Foundation
import NitroModules

/**
 * Nitro HybridObject implementation for the SslManager spec.
 *
 * Delegates all behavior to `SharedLogic` (the cross-runtime SSL pinning logic).
 * Each method runs off the JS thread on a private serial queue via
 * `Promise.parallel`, so UserDefaults access, JSON parsing, and TrustKit
 * initialization never block the caller and are serialized against each other.
 *
 * Note: the PRIMARY launch-time pinning bootstrap happens via the Objective-C
 * `+load` hook (see `SslManagerBootstrap.mm`). The `init()` call below is only a
 * redundant safety net and must not be relied upon for launch-time pinning.
 */
final class HybridSslManager: HybridSslManagerSpec {
    private static let queue = DispatchQueue(label: "com.sslmanager.nitro")

    override init() {
        super.init()

        // Redundant safety net: the authoritative initialization runs at app
        // launch via the Objective-C +load bootstrap. This covers the unlikely
        // case where the bootstrap object was not linked/loaded.
        SharedLogic.bootstrapIfEnabled()
    }

    func setUseSSLPinning(usePinning: Bool) throws -> Promise<Void> {
        return Promise.parallel(Self.queue) {
            SharedLogic.setUseSSLPinning(usePinning)
        }
    }

    func getUseSSLPinning() throws -> Promise<Bool> {
        return Promise.parallel(Self.queue) {
            return SharedLogic.getUseSSLPinning()
        }
    }

    func setSSLConfig(config: SslPinningConfig) throws -> Promise<Void> {
        let sha256Keys = config.sha256Keys
        return Promise.parallel(Self.queue) {
            let configObject: [String: Any] = ["sha256Keys": sha256Keys]
            let configData = try JSONSerialization.data(withJSONObject: configObject, options: [])
            guard let configJsonString = String(data: configData, encoding: .utf8) else {
                throw RuntimeError.error(withMessage: "Failed to serialize SSL configuration to JSON")
            }
            do {
                try SharedLogic.setSSLConfig(configJsonString)
            } catch let error as SSLPinningError {
                throw RuntimeError.error(withMessage: "\(error.code): \(error.message)")
            }
        }
    }

    func getPinnedDomains() throws -> Promise<[String]> {
        return Promise.parallel(Self.queue) {
            return SharedLogic.getPinnedDomains()
        }
    }
}
