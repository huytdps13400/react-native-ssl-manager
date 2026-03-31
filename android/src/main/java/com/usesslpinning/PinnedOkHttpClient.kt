package com.usesslpinning

import android.content.Context
import okhttp3.CertificatePinner
import okhttp3.OkHttpClient
import org.json.JSONObject
import java.io.IOException

/**
 * Public singleton providing a pinned OkHttpClient for native module authors.
 *
 * Usage:
 *   val client = PinnedOkHttpClient.getInstance(context)
 *
 * The client is configured with CertificatePinner from ssl_config.json when
 * SSL pinning is enabled. When disabled, a plain OkHttpClient is returned.
 *
 * The singleton is invalidated when the pinning state changes via setUseSSLPinning.
 */
object PinnedOkHttpClient {

    @Volatile
    private var instance: OkHttpClient? = null

    @Volatile
    private var lastPinningState: Boolean? = null

    /**
     * Returns a singleton OkHttpClient configured with certificate pinning
     * from ssl_config.json (when SSL pinning is enabled).
     */
    @JvmStatic
    fun getInstance(context: Context): OkHttpClient {
        val prefs = context.getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
        val useSSLPinning = prefs.getBoolean("useSSLPinning", true)

        // Invalidate if pinning state changed
        if (useSSLPinning != lastPinningState) {
            instance = null
        }

        return instance ?: synchronized(this) {
            instance ?: buildClient(context, useSSLPinning).also {
                instance = it
                lastPinningState = useSSLPinning
            }
        }
    }

    /**
     * Invalidate the cached client. Called when setUseSSLPinning changes state.
     */
    @JvmStatic
    fun invalidate() {
        synchronized(this) {
            instance = null
            lastPinningState = null
        }
    }

    private fun buildClient(context: Context, useSSLPinning: Boolean): OkHttpClient {
        val builder = OkHttpClient.Builder()

        if (useSSLPinning) {
            try {
                val configJson = readSslConfig(context)
                if (configJson != null) {
                    val pinnerBuilder = CertificatePinner.Builder()
                    val sha256Keys = configJson.getJSONObject("sha256Keys")
                    val hostnames = sha256Keys.keys()
                    while (hostnames.hasNext()) {
                        val hostname = hostnames.next()
                        val keysArray = sha256Keys.getJSONArray(hostname)
                        for (i in 0 until keysArray.length()) {
                            pinnerBuilder.add(hostname, keysArray.getString(i))
                        }
                    }
                    builder.certificatePinner(pinnerBuilder.build())
                }
            } catch (_: Exception) {
                // SSL pinning setup failed — return plain client
            }
        }

        return builder.build()
    }

    private fun readSslConfig(context: Context): JSONObject? {
        // Check runtime config first (set via JS API)
        val prefs = context.getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
        val runtimeConfig = prefs.getString("sslConfig", null)
        if (!runtimeConfig.isNullOrEmpty()) {
            return JSONObject(runtimeConfig)
        }

        // Fall back to bundled asset
        return try {
            val inputStream = context.assets.open("ssl_config.json")
            val bytes = inputStream.readBytes()
            inputStream.close()
            JSONObject(String(bytes, Charsets.UTF_8))
        } catch (_: IOException) {
            null
        }
    }
}
