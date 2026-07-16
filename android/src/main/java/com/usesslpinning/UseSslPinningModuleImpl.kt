package com.usesslpinning

import android.content.Context
import com.facebook.react.modules.network.OkHttpClientProvider
import org.json.JSONArray
import org.json.JSONObject

object UseSslPinningModuleImpl {
    const val NAME = "UseSslPinning"

    private const val PREFS = "AppSettings"
    private const val KEY_USE_PINNING = "useSSLPinning"
    private const val KEY_CONFIG = "sslConfig"

    /**
     * Install the pinned OkHttpClientFactory. Safe to call from app startup
     * (androidx.startup Initializer) as well as from the Nitro HybridObject.
     */
    fun initialize(context: Context) {
        try {
            OkHttpClientProvider.setOkHttpClientFactory(SslPinningFactory(context.applicationContext))
        } catch (e: Exception) {
            // SSL factory setup failed — continue without the custom factory.
        }
    }

    /**
     * Persist whether SSL pinning is enabled and rebuild the factory so the
     * change takes effect on the next request. Throws on persistence failure.
     */
    fun setUseSSLPinning(context: Context, usePinning: Boolean) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_USE_PINNING, usePinning).apply()

        // Force new factory creation to bypass RN client cache.
        OkHttpClientProvider.setOkHttpClientFactory(SslPinningFactory(context.applicationContext))
        PinnedOkHttpClient.invalidate()
        SslConfigStore.invalidate()
    }

    fun getUseSSLPinning(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_USE_PINNING, true)
    }

    /**
     * Persist a runtime SSL configuration and refresh the client. The keys map
     * hostnames to their pinned SHA-256 keys. Throws on invalid configuration.
     */
    fun setSSLConfig(context: Context, sha256Keys: Map<String, Array<String>>) {
        require(sha256Keys.isNotEmpty()) { "Config must contain at least one host in sha256Keys" }
        sha256Keys.forEach { (host, keys) ->
            require(host.isNotBlank()) { "Config contains a blank hostname" }
            require(keys.isNotEmpty()) { "Host \"$host\" must have at least one SHA-256 key" }
        }

        val config = buildConfigJson(sha256Keys)
        persistAndRefresh(context, config)
    }

    /**
     * Persist a runtime SSL configuration from its full JSON string form,
     * including extended per-domain options (`domains`) and `reportUris`.
     * Validates the structure before persisting; throws on invalid input.
     */
    fun setSSLConfigJson(context: Context, configJson: String) {
        val parsed = try {
            JSONObject(configJson)
        } catch (e: Exception) {
            throw IllegalArgumentException("Config is not valid JSON", e)
        }
        val sha256Keys = parsed.optJSONObject("sha256Keys")
            ?: throw IllegalArgumentException("Config must contain a sha256Keys map")
        require(sha256Keys.length() > 0) { "Config must contain at least one host in sha256Keys" }
        val hosts = sha256Keys.keys()
        while (hosts.hasNext()) {
            val host = hosts.next()
            require(host.isNotBlank()) { "Config contains a blank hostname" }
            val pins = sha256Keys.getJSONArray(host)
            require(pins.length() > 0) { "Host \"$host\" must have at least one SHA-256 key" }
        }

        persistAndRefresh(context, configJson)
    }

    private fun persistAndRefresh(context: Context, configJson: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_CONFIG, configJson).apply()

        // Rebuild the factory and invalidate cached clients so new pins apply.
        SslConfigStore.invalidate()
        OkHttpClientProvider.setOkHttpClientFactory(SslPinningFactory(context.applicationContext))
        PinnedOkHttpClient.invalidate()
    }

    /**
     * Return the domains in the active configuration (runtime config if set,
     * otherwise the bundled ssl_config.json asset). Throws on read failure.
     */
    fun getPinnedDomains(context: Context): Array<String> {
        val configJson = readActiveConfig(context)
        if (configJson == null || !configJson.has("sha256Keys")) {
            return emptyArray()
        }
        val domains = mutableListOf<String>()
        val keys = configJson.getJSONObject("sha256Keys").keys()
        while (keys.hasNext()) {
            domains.add(keys.next())
        }
        return domains.toTypedArray()
    }

    private fun buildConfigJson(sha256Keys: Map<String, Array<String>>): String {
        val sha256Object = JSONObject()
        sha256Keys.forEach { (host, keys) ->
            sha256Object.put(host, JSONArray(keys.toList()))
        }
        return JSONObject().put("sha256Keys", sha256Object).toString()
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
