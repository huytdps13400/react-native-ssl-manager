import ExpoModulesCore
import TrustKit

public class UseSslPinningModule: Module {
  private let userDefaults = UserDefaults.standard
  private let useSSLPinningKey = "useSSLPinning"

  public func definition() -> ModuleDefinition {
    Name("UseSslPinning")

    AsyncFunction("initializeSslPinning") { (configJsonString: String, promise: Promise) in
      self.initializeSslPinning(configJsonString, promise: promise)
    }

    Function("setUseSSLPinning") { (usePinning: Bool) in
      self.setUseSSLPinning(usePinning)
    }

    AsyncFunction("getUseSSLPinning") { (promise: Promise) in
      let usePinning = self.userDefaults.bool(forKey: self.useSSLPinningKey)
      promise.resolve(usePinning)
    }
  }

  private func initializeSslPinning(_ configJsonString: String, promise: Promise) {
    let isSSLPinningEnabled = userDefaults.bool(forKey: useSSLPinningKey)

    if isSSLPinningEnabled {
      do {
        guard let jsonData = configJsonString.data(using: .utf8),
              let config = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any],
              let sha256Keys = config["sha256Keys"] as? [String: [String]] else {
          promise.reject("INVALID_CONFIGURATION", "Invalid SSL pinning configuration format")
          return
        }

        var pinnedDomains: [String: Any] = [:]
        for (domain, pins) in sha256Keys {
          let cleanedPins = pins.map { $0.replacingOccurrences(of: "sha256/", with: "") }
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
          TrustKit.initSharedInstance(withConfiguration: trustKitConfig)
          promise.resolve([
            "message": "SSL Pinning initialized successfully",
            "isEnabled": true,
            "domains": Array(pinnedDomains.keys)
          ])
        }
      } catch {
        promise.reject("INITIALIZATION_FAILED", "Failed to initialize SSL Pinning", error)
      }
    } else {
      promise.resolve([
        "message": "SSL Pinning is disabled",
        "isEnabled": false,
        "domains": []
      ])
    }
  }

  private func setUseSSLPinning(_ usePinning: Bool) {
    userDefaults.set(usePinning, forKey: useSSLPinningKey)
    userDefaults.synchronize()
  }
}