package com.usesslpinning

import android.content.Context

import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.ReactCookieJarContainer
import okhttp3.CertificatePinner
import okhttp3.OkHttpClient
import org.json.JSONObject
import java.io.IOException

class SslPinningFactory(private val context: Context) : OkHttpClientFactory {
    
    private val instanceId = System.currentTimeMillis()

    override fun createNewNetworkModuleClient(): OkHttpClient {

        
        val sharedPreferences = context.getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
        val useSSLPinning = sharedPreferences.getBoolean("useSSLPinning", true)
        


        val clientBuilder = OkHttpClient.Builder()
            .cookieJar(ReactCookieJarContainer())
            .cache(null)

        if (useSSLPinning) {

            try {
                val configJsonString = getConfigJsonString()
                if (configJsonString != null) {
                    val certificatePinnerBuilder = CertificatePinner.Builder()
                    addCertificatesToPinner(certificatePinnerBuilder, JSONObject(configJsonString))
                    val certificatePinner = certificatePinnerBuilder.build()
                    clientBuilder.certificatePinner(certificatePinner)

                } else {

                }
            } catch (e: Exception) {
                // SSL pinning setup failed - continue with regular client
            }
        } else {

        }


        val client = clientBuilder.build()

        
        return client
    }

    private fun getConfigJsonString(): String? {
        val sharedPreferences = context.getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
        val runtimeConfig = sharedPreferences.getString("sslConfig", null)
        if (!runtimeConfig.isNullOrEmpty()) {

            return runtimeConfig
        }

        return try {
            val inputStream = context.assets.open("ssl_config.json")
            val size = inputStream.available()
            val buffer = ByteArray(size)
            inputStream.read(buffer)
            inputStream.close()

            String(buffer, Charsets.UTF_8)
        } catch (e: IOException) {

            null
        }
    }

    private fun addCertificatesToPinner(certificatePinnerBuilder: CertificatePinner.Builder, configJson: JSONObject) {
        val sha256Keys = configJson.getJSONObject("sha256Keys")
        val hostnames = sha256Keys.keys()
        while (hostnames.hasNext()) {
            val hostname = hostnames.next()
            val keysArray = sha256Keys.getJSONArray(hostname)
            for (i in 0 until keysArray.length()) {
                val sha256Key = keysArray.getString(i)
                certificatePinnerBuilder.add(hostname, sha256Key)

            }
        }
    }

    companion object {
        private const val TAG = "SslPinningFactory"
    }
}