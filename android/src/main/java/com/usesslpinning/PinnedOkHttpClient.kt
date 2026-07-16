package com.usesslpinning

import android.content.Context
import okhttp3.OkHttpClient

/**
 * Public singleton providing a pinned OkHttpClient for native module authors.
 *
 * Usage:
 *   val client = PinnedOkHttpClient.getInstance(context)
 *
 * The client honors the full active configuration from ssl_config.json (or the
 * runtime config) via [PinningClientConfigurator]: enforced domains get a
 * CertificatePinner, audit-mode domains get report-only validation, expired
 * pin-sets fail open. When pinning is disabled, a plain OkHttpClient is
 * returned.
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
                PinningClientConfigurator.apply(builder, context)
            } catch (_: Exception) {
                // SSL pinning setup failed — return plain client
            }
        }

        return builder.build()
    }
}
