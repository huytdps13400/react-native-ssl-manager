package com.usesslpinning

import android.content.Context
import okhttp3.CertificatePinner
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Report-only pin validation for domains configured with
 * `enforcePinning: false`. Runs as a NETWORK interceptor so the TLS handshake
 * is available; computes the served chain's SPKI pins and reports mismatches
 * without ever failing the request. Enforced domains are handled by
 * `CertificatePinner` + `PinningFailureEventListener` instead.
 */
class AuditPinningInterceptor(private val context: Context) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val response = chain.proceed(chain.request())
        try {
            val config = SslConfigStore.get(context) ?: return response
            val requestHost = chain.request().url.host
            val (configHost, expectedPins) = config.entryForRequestHost(requestHost)
                ?: return response
            val options = config.optionsFor(configHost)
            if (options.enforcePinning) return response
            if (config.isExpired(configHost, System.currentTimeMillis())) return response

            val handshake = chain.connection()?.handshake() ?: response.handshake ?: return response
            val servedPins = handshake.peerCertificates.map { CertificatePinner.pin(it) }
            if (servedPins.none { it in expectedPins }) {
                PinningFailureReporter.report(
                    config,
                    requestHost,
                    enforced = false,
                    servedPins = servedPins,
                    message = "Audit: certificate for $requestHost did not match the configured pins (connection allowed)",
                )
            }
        } catch (_: Exception) {
            // Audit mode must never break a request.
        }
        return response
    }
}
