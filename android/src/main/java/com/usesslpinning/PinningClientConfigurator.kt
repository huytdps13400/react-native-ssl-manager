package com.usesslpinning

import android.content.Context
import okhttp3.CertificatePinner
import okhttp3.OkHttpClient

/**
 * Applies the active pinning configuration to an OkHttp client builder —
 * shared by `SslPinningFactory` (React Native's networking client) and
 * `PinnedOkHttpClient` (native-module consumers) so both honor the same
 * per-domain options:
 *
 * - enforced, non-expired domains → `CertificatePinner` (blocks mismatches)
 * - audit-mode domains → `AuditPinningInterceptor` (reports, never blocks)
 * - expired domains → skipped entirely (fail-open, mirrors NSC expiration)
 * - enforced failures → `PinningFailureEventListener` (reports the block)
 */
object PinningClientConfigurator {

    fun apply(builder: OkHttpClient.Builder, context: Context) {
        val config = SslConfigStore.get(context) ?: return
        val now = System.currentTimeMillis()

        val enforced = config.enforcedHosts(now)
        if (enforced.isNotEmpty()) {
            val pinner = CertificatePinner.Builder()
            for ((host, pins) in enforced) {
                // `**.host` covers subdomains at any depth; the bare host
                // pattern covers the domain itself.
                val patterns = if (config.optionsFor(host).includeSubdomains) {
                    listOf(host, "**.$host")
                } else {
                    listOf(host)
                }
                for (pattern in patterns) {
                    for (pin in pins) {
                        pinner.add(pattern, pin)
                    }
                }
            }
            builder.certificatePinner(pinner.build())
        }

        if (config.auditHosts(now).isNotEmpty()) {
            builder.addNetworkInterceptor(AuditPinningInterceptor(context))
        }
        builder.eventListenerFactory(PinningFailureEventListener.factory(context))
    }
}
