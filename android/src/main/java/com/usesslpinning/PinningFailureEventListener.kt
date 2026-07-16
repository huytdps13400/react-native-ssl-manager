package com.usesslpinning

import android.content.Context
import okhttp3.Call
import okhttp3.EventListener
import java.io.IOException
import javax.net.ssl.SSLPeerUnverifiedException

/**
 * Observes enforced pin failures. OkHttp's `CertificatePinner` throws
 * `SSLPeerUnverifiedException` whose message lists the served chain's SPKI
 * pins ("Peer certificate chain:") — parse them so reports carry what the
 * server actually presented.
 */
class PinningFailureEventListener(private val context: Context) : EventListener() {

    override fun callFailed(call: Call, ioe: IOException) {
        if (ioe !is SSLPeerUnverifiedException) return
        val message = ioe.message ?: return
        if (!message.contains("Certificate pinning failure")) return

        val host = call.request().url.host
        val servedPins = PIN_PATTERN
            .findAll(message.substringBefore("Pinned certificates for"))
            .map { it.value }
            .distinct()
            .toList()

        PinningFailureReporter.report(
            SslConfigStore.get(context),
            host,
            enforced = true,
            servedPins = servedPins,
            message = "Blocked connection to $host — certificate did not match the configured pins",
        )
    }

    companion object {
        private val PIN_PATTERN = Regex("sha256/[A-Za-z0-9+/=]{43,44}")

        fun factory(context: Context): Factory = Factory { PinningFailureEventListener(context) }
    }
}
