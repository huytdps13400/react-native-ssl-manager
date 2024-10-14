package com.usesslpinning

import android.content.Context
import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.ReactCookieJarContainer
import okhttp3.CertificatePinner
import okhttp3.OkHttpClient
import org.json.JSONObject
import java.io.InputStream

class UseSslPinningFactory(private val context: Context) : OkHttpClientFactory {

    private var useSSLPinning: Boolean = true
    private var config: JSONObject? = null

    fun setUseSSLPinning(use: Boolean) {
        useSSLPinning = use
    }

    fun setConfig(newConfig: String) {
        config = try {
            JSONObject(newConfig)
        } catch (ex: Exception) {
            ex.printStackTrace()
            null
        }
    }

    override fun createNewNetworkModuleClient(): OkHttpClient {
        val clientBuilder = OkHttpClient.Builder().cookieJar(ReactCookieJarContainer()).apply {
            if (useSSLPinning && config != null) {
                val certificatePinnerBuilder = CertificatePinner.Builder()

                val sha256Keys = config!!.getJSONObject("sha256Keys")
                for (domain in sha256Keys.keys()) {
                    val keys = sha256Keys.getJSONArray(domain)
                    for (i in 0 until keys.length()) {
                        certificatePinnerBuilder.add(domain, keys.getString(i))
                    }
                }

                val certificatePinner = certificatePinnerBuilder.build()
                certificatePinner(certificatePinner)
            }
        }.cache(null).build()

        return clientBuilder
    }

    private fun loadConfig(context: Context): JSONObject? {
        return try {
            val inputStream: InputStream = context.assets.open("ssl_config.json")
            val json = inputStream.bufferedReader().use { it.readText() }
            JSONObject(json)
        } catch (ex: Exception) {
            ex.printStackTrace()
            null
        }
    }
}