package com.usesslpinning

import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Graceful-degradation policy shared by SslPinningFactory and PinnedOkHttpClient.
 *
 * Reads the optional global controls from ssl_config.json:
 * - `enforcePinning` (default true): when false, no CertificatePinner is applied
 *   (monitor mode — requests are not blocked on a pin mismatch).
 * - `expiration` (YYYY-MM-DD): after this date pinning is no longer enforced
 *   (fail-open), preventing a permanent lockout when certificates rotate.
 *
 * This mirrors the Network Security Config `pin-set` expiration so the runtime
 * OkHttp path degrades consistently with the OS-level configuration.
 */
object SslPinningPolicy {

    /**
     * Whether a CertificatePinner should be applied for the given configuration.
     */
    fun shouldEnforce(config: JSONObject): Boolean {
        if (!config.optBoolean("enforcePinning", true)) {
            return false
        }
        val expiration = config.optString("expiration", "")
        if (expiration.isNotEmpty() && isExpired(expiration)) {
            return false
        }
        return true
    }

    /**
     * True when [date] (YYYY-MM-DD) is strictly before today.
     * Malformed dates are treated as not expired (fail-safe toward enforcement).
     */
    fun isExpired(date: String): Boolean {
        return try {
            val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            formatter.isLenient = false
            val expiration = formatter.parse(date) ?: return false
            // Compare against the start of today so the configured day is inclusive.
            val today = formatter.parse(formatter.format(Date())) ?: return false
            today.after(expiration)
        } catch (e: Exception) {
            false
        }
    }
}
