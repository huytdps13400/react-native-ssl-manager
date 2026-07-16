package com.usesslpinning

import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Collections
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.ConcurrentHashMap

/**
 * Dispatches pin-validation failures to the registered JS callback and, when
 * `reportUris` is configured, POSTs an HPKP-style JSON report. Delivery is
 * best-effort: reporting never throws into the calling request path, and
 * identical failures are deduplicated per session.
 */
object PinningFailureReporter {

    /**
     * Single handler slot (host, enforced, servedPins, message, timestampMs).
     * Registered by the Nitro HybridObject; the JS layer fans out.
     */
    @Volatile
    var handler: ((String, Boolean, List<String>, String, Long) -> Unit)? = null

    private val reportedKeys: MutableSet<String> =
        Collections.newSetFromMap(ConcurrentHashMap<String, Boolean>())

    // Plain client: reports must not themselves be pin-validated, or a report
    // about a failing domain could never leave the device.
    private val reportClient: OkHttpClient by lazy { OkHttpClient() }

    fun report(
        config: SslConfig?,
        host: String,
        enforced: Boolean,
        servedPins: List<String>,
        message: String,
    ) {
        val timestamp = System.currentTimeMillis()
        try {
            handler?.invoke(host, enforced, servedPins, message, timestamp)
        } catch (_: Throwable) {
            // A throwing JS callback must never affect the request path.
        }

        val uris = config?.reportUris ?: return
        if (uris.isEmpty()) return

        val dedupKey = "$host|$enforced|${servedPins.sorted().joinToString(",")}"
        if (!reportedKeys.add(dedupKey)) return

        val knownPins =
            config.sha256Keys[host] ?: config.entryForRequestHost(host)?.second ?: emptyList()
        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        isoFormat.timeZone = TimeZone.getTimeZone("UTC")
        val body = JSONObject()
            .put("hostname", host)
            .put("enforced", enforced)
            .put("known-pins", JSONArray(knownPins))
            .put("served-pins", JSONArray(servedPins))
            .put("message", message)
            .put("date-time", isoFormat.format(Date(timestamp)))
            .toString()

        for (uri in uris) {
            try {
                val request = Request.Builder()
                    .url(uri)
                    .post(body.toRequestBody("application/json".toMediaType()))
                    .build()
                reportClient.newCall(request).enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) {
                        // Best-effort delivery only.
                    }

                    override fun onResponse(call: Call, response: Response) {
                        response.close()
                    }
                })
            } catch (_: Exception) {
                // Malformed URI or enqueue failure — never propagate.
            }
        }
    }
}
