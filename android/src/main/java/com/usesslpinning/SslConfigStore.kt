package com.usesslpinning

import android.content.Context
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * Per-domain pinning options from the extended config's `domains` map.
 * Defaults preserve legacy behavior: enforced, no expiration, subdomains
 * included.
 */
data class DomainOptions(
    val enforcePinning: Boolean = true,
    val expirationDate: String? = null,
    val includeSubdomains: Boolean = true,
)

/**
 * Parsed SSL pinning configuration: `sha256Keys` plus the optional extended
 * `domains` metadata and `reportUris`.
 */
class SslConfig(
    val sha256Keys: Map<String, List<String>>,
    val domainOptions: Map<String, DomainOptions>,
    val reportUris: List<String>,
) {
    fun optionsFor(host: String): DomainOptions = domainOptions[host] ?: DomainOptions()

    /**
     * Whether the domain's pin-set expiration date has passed (fail-open
     * point). The pin-set is active through the end of the given day, UTC —
     * mirroring Android NSC `pin-set expiration` semantics.
     */
    fun isExpired(host: String, nowMs: Long): Boolean {
        val date = optionsFor(host).expirationDate ?: return false
        return try {
            val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            format.timeZone = TimeZone.getTimeZone("UTC")
            val endOfDay = format.parse("${date}T23:59:59.999Z") ?: return false
            endOfDay.time < nowMs
        } catch (_: Exception) {
            false
        }
    }

    /** Hosts whose pins are actively enforced (not audit-mode, not expired). */
    fun enforcedHosts(nowMs: Long): Map<String, List<String>> =
        sha256Keys.filterKeys { optionsFor(it).enforcePinning && !isExpired(it, nowMs) }

    /** Hosts in audit (report-only) mode that have not expired. */
    fun auditHosts(nowMs: Long): Map<String, List<String>> =
        sha256Keys.filterKeys { !optionsFor(it).enforcePinning && !isExpired(it, nowMs) }

    /**
     * The config entry covering a request host: an exact match, or a parent
     * domain whose options include subdomains. Returns configHost to pins.
     */
    fun entryForRequestHost(requestHost: String): Pair<String, List<String>>? {
        sha256Keys[requestHost]?.let { return requestHost to it }
        val parent = sha256Keys.entries.firstOrNull { (configHost, _) ->
            optionsFor(configHost).includeSubdomains && requestHost.endsWith(".$configHost")
        } ?: return null
        return parent.key to parent.value
    }

    companion object {
        fun parse(json: JSONObject): SslConfig? {
            val sha256Json = json.optJSONObject("sha256Keys") ?: return null
            val sha256Keys = mutableMapOf<String, List<String>>()
            val hostIterator = sha256Json.keys()
            while (hostIterator.hasNext()) {
                val host = hostIterator.next()
                val pinsArray = sha256Json.getJSONArray(host)
                sha256Keys[host] = (0 until pinsArray.length()).map { pinsArray.getString(it) }
            }

            val domainOptions = mutableMapOf<String, DomainOptions>()
            json.optJSONObject("domains")?.let { domainsJson ->
                val domainIterator = domainsJson.keys()
                while (domainIterator.hasNext()) {
                    val host = domainIterator.next()
                    val options = domainsJson.getJSONObject(host)
                    domainOptions[host] = DomainOptions(
                        enforcePinning = options.optBoolean("enforcePinning", true),
                        expirationDate = options.optString("expirationDate", "").ifEmpty { null },
                        includeSubdomains = options.optBoolean("includeSubdomains", true),
                    )
                }
            }

            val reportUris = mutableListOf<String>()
            json.optJSONArray("reportUris")?.let { uris ->
                for (i in 0 until uris.length()) reportUris.add(uris.getString(i))
            }

            return SslConfig(sha256Keys, domainOptions, reportUris)
        }
    }
}

/**
 * Cached reader for the active configuration (runtime SharedPreferences value
 * first, then the bundled `ssl_config.json` asset). Invalidated whenever the
 * config or pinning state changes so every OkHttp layer sees fresh options.
 */
object SslConfigStore {
    @Volatile
    private var cached: SslConfig? = null

    fun get(context: Context): SslConfig? {
        cached?.let { return it }
        synchronized(this) {
            cached?.let { return it }
            val loaded = load(context)
            cached = loaded
            return loaded
        }
    }

    fun invalidate() {
        synchronized(this) { cached = null }
    }

    private fun load(context: Context): SslConfig? {
        val prefs = context.getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
        val runtime = prefs.getString("sslConfig", null)
        val jsonString = if (!runtime.isNullOrEmpty()) {
            runtime
        } else {
            try {
                context.assets.open("ssl_config.json").use { String(it.readBytes(), Charsets.UTF_8) }
            } catch (_: Exception) {
                return null
            }
        }
        return try {
            SslConfig.parse(JSONObject(jsonString))
        } catch (_: Exception) {
            null
        }
    }
}
