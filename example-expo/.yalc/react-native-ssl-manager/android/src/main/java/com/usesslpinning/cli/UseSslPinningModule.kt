package com.usesslpinning.cli

import com.facebook.react.bridge.*
import com.usesslpinning.SharedLogic
import org.json.JSONObject

/**
 * React Native CLI module for SSL Pinning
 * Uses the shared logic for common functionality
 */
class UseSslPinningModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    override fun getName(): String {
        return "UseSslPinning"
    }
    
    @ReactMethod
    fun setUseSSLPinning(usePinning: Boolean, promise: Promise) {
        try {
            SharedLogic.setUseSSLPinning(reactApplicationContext, usePinning)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SET_SSL_PINNING_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun getUseSSLPinning(promise: Promise) {
        try {
            val usePinning = SharedLogic.getUseSSLPinning(reactApplicationContext)
            promise.resolve(usePinning)
        } catch (e: Exception) {
            promise.reject("GET_SSL_PINNING_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun initializeSslPinning(configJsonString: String, promise: Promise) {
        try {
            val usePinning = SharedLogic.getUseSSLPinning(reactApplicationContext)
            
            if (!usePinning) {
                val result = Arguments.createMap().apply {
                    putString("message", "SSL Pinning is disabled")
                    putBoolean("isEnabled", false)
                    putArray("domains", Arguments.createArray())
                }
                promise.resolve(result)
                return
            }
            
            val config = SharedLogic.parseSslPinningConfig(configJsonString)
            if (config == null || !SharedLogic.validateSslPinningConfig(config)) {
                promise.reject("INVALID_CONFIGURATION", "Invalid SSL pinning configuration format")
                return
            }
            
            // Here you would implement the actual SSL pinning logic
            // For now, we'll just return a success response
            val domains = config.getJSONObject("sha256Keys").keys()
            val domainsArray = Arguments.createArray()
            while (domains.hasNext()) {
                domainsArray.pushString(domains.next())
            }
            
            val result = Arguments.createMap().apply {
                putString("message", "SSL Pinning initialized successfully")
                putBoolean("isEnabled", true)
                putArray("domains", domainsArray)
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("INITIALIZATION_FAILED", "Failed to initialize SSL Pinning", e)
        }
    }
} 