package com.usesslpinning

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject

/**
 * Shared logic for SSL pinning functionality
 * Contains common methods used by both CLI and Expo modules
 */
object SharedLogic {
    private const val USE_SSL_PINNING_KEY = "useSSLPinning"
    
    /**
     * Get SharedPreferences instance
     */
    fun getSharedPreferences(context: Context): SharedPreferences {
        return context.getSharedPreferences("SslPinningPrefs", Context.MODE_PRIVATE)
    }
    
    /**
     * Set SSL pinning enabled/disabled state
     */
    fun setUseSSLPinning(context: Context, usePinning: Boolean) {
        val prefs = getSharedPreferences(context)
        prefs.edit().putBoolean(USE_SSL_PINNING_KEY, usePinning).apply()
    }
    
    /**
     * Get current SSL pinning state
     */
    fun getUseSSLPinning(context: Context): Boolean {
        val prefs = getSharedPreferences(context)
        return prefs.getBoolean(USE_SSL_PINNING_KEY, false)
    }
    
    /**
     * Parse SSL pinning configuration from JSON string
     */
    fun parseSslPinningConfig(configJsonString: String): JSONObject? {
        return try {
            JSONObject(configJsonString)
        } catch (e: Exception) {
            null
        }
    }
    
    /**
     * Validate SSL pinning configuration
     */
    fun validateSslPinningConfig(config: JSONObject): Boolean {
        return try {
            config.has("sha256Keys") && config.getJSONObject("sha256Keys").length() > 0
        } catch (e: Exception) {
            false
        }
    }
} 