package com.usesslpinning

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.network.OkHttpClientProvider
import org.json.JSONException
import org.json.JSONObject

object UseSslPinningModuleImpl {
    const val NAME = "UseSslPinning"

    private const val PREFS = "AppSettings"
    private const val KEY_USE_PINNING = "useSSLPinning"
    private const val KEY_CONFIG = "sslConfig"

    /**
     * Install the pinned OkHttpClientFactory. Safe to call from app startup
     * (androidx.startup Initializer) as well as from the module constructor.
     */
    fun initialize(context: Context) {
        try {
            OkHttpClientProvider.setOkHttpClientFactory(SslPinningFactory(context.applicationContext))
        } catch (e: Exception) {
            // SSL Factory setup failed - continue without custom factory
        }
    }

    fun initialize(reactContext: ReactApplicationContext) {
        initialize(reactContext as Context)
    }

    fun setUseSSLPinning(reactContext: ReactApplicationContext, usePinning: Boolean, promise: Promise) {
        val sharedPreferences = reactContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        sharedPreferences.edit().putBoolean(KEY_USE_PINNING, usePinning).apply()

        // Force new factory creation to bypass RN client cache
        OkHttpClientProvider.setOkHttpClientFactory(SslPinningFactory(reactContext))
        PinnedOkHttpClient.invalidate()

        promise.resolve(null)
    }

    fun getUseSSLPinning(reactContext: ReactApplicationContext, promise: Promise) {
        val sharedPreferences = reactContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        promise.resolve(sharedPreferences.getBoolean(KEY_USE_PINNING, true))
    }

    /**
     * Persist a runtime SSL configuration (JSON string) and refresh the client.
     * Rejects when the configuration is malformed.
     */
    fun setSSLConfig(reactContext: ReactApplicationContext, config: String, promise: Promise) {
        try {
            // Validate before persisting so callers get immediate feedback.
            val parsed = JSONObject(config)
            if (!parsed.has("sha256Keys")) {
                promise.reject("INVALID_CONFIGURATION", "Config must contain a sha256Keys object")
                return
            }

            val sharedPreferences = reactContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            sharedPreferences.edit().putString(KEY_CONFIG, config).apply()

            // Rebuild the factory and invalidate cached clients so new pins apply.
            OkHttpClientProvider.setOkHttpClientFactory(SslPinningFactory(reactContext))
            PinnedOkHttpClient.invalidate()

            promise.resolve(null)
        } catch (e: JSONException) {
            promise.reject("INVALID_CONFIGURATION", "Invalid SSL configuration JSON: ${e.message}", e)
        }
    }

    /**
     * Resolve with the list of domains in the active configuration (runtime
     * config if set, otherwise the bundled ssl_config.json asset).
     */
    fun getPinnedDomains(reactContext: ReactApplicationContext, promise: Promise) {
        try {
            val configJson = readActiveConfig(reactContext)
            val domains = com.facebook.react.bridge.Arguments.createArray()
            if (configJson != null && configJson.has("sha256Keys")) {
                val keys = configJson.getJSONObject("sha256Keys").keys()
                while (keys.hasNext()) {
                    domains.pushString(keys.next())
                }
            }
            promise.resolve(domains)
        } catch (e: Exception) {
            promise.reject("CONFIG_READ_ERROR", "Failed to read SSL configuration: ${e.message}", e)
        }
    }

    private fun readActiveConfig(context: Context): JSONObject? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val runtime = prefs.getString(KEY_CONFIG, null)
        if (!runtime.isNullOrEmpty()) {
            return JSONObject(runtime)
        }
        return try {
            val bytes = context.assets.open("ssl_config.json").use { it.readBytes() }
            JSONObject(String(bytes, Charsets.UTF_8))
        } catch (e: Exception) {
            null
        }
    }
}
