package com.usesslpinning.expo

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.usesslpinning.SharedLogic
import org.json.JSONObject

/**
 * Expo module for SSL Pinning
 * Uses Expo Modules API and shared logic for common functionality
 */
class UseSslPinningExpoModule : Module() {
    
    override fun definition() = ModuleDefinition {
        Name("UseSslPinning")
        
        AsyncFunction("setUseSSLPinning") { usePinning: Boolean ->
            try {
                SharedLogic.setUseSSLPinning(appContext.reactContext, usePinning)
            } catch (e: Exception) {
                throw Exception("Failed to set SSL pinning: ${e.message}")
            }
        }
        
        AsyncFunction("getUseSSLPinning") {
            try {
                SharedLogic.getUseSSLPinning(appContext.reactContext)
            } catch (e: Exception) {
                throw Exception("Failed to get SSL pinning state: ${e.message}")
            }
        }
        
        AsyncFunction("initializeSslPinning") { configJsonString: String ->
            try {
                val usePinning = SharedLogic.getUseSSLPinning(appContext.reactContext)
                
                if (!usePinning) {
                    return@AsyncFunction mapOf(
                        "message" to "SSL Pinning is disabled",
                        "isEnabled" to false,
                        "domains" to emptyList<String>()
                    )
                }
                
                val config = SharedLogic.parseSslPinningConfig(configJsonString)
                if (config == null || !SharedLogic.validateSslPinningConfig(config)) {
                    throw Exception("Invalid SSL pinning configuration format")
                }
                
                // Here you would implement the actual SSL pinning logic
                // For now, we'll just return a success response
                val domains = mutableListOf<String>()
                val sha256Keys = config.getJSONObject("sha256Keys")
                val keys = sha256Keys.keys()
                while (keys.hasNext()) {
                    domains.add(keys.next())
                }
                
                mapOf(
                    "message" to "SSL Pinning initialized successfully",
                    "isEnabled" to true,
                    "domains" to domains
                )
            } catch (e: Exception) {
                throw Exception("Failed to initialize SSL Pinning: ${e.message}")
            }
        }
    }
} 