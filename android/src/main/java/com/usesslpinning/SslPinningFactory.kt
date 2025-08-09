package com.usesslpinning

import android.content.Context
import android.util.Log
import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.ReactCookieJarContainer
import okhttp3.CertificatePinner
import okhttp3.OkHttpClient
import org.json.JSONObject
import java.io.IOException

class SslPinningFactory(private val context: Context) : OkHttpClientFactory {
    
    private val instanceId = System.currentTimeMillis()

    override fun createNewNetworkModuleClient(): OkHttpClient {
        Log.d(TAG, "🏭 Factory[$instanceId] Creating new OkHttpClient...")
        
        val sharedPreferences = context.getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
        val useSSLPinning = sharedPreferences.getBoolean("useSSLPinning", true)
        
        Log.d(TAG, "🔍 Factory[$instanceId] Current SSL setting: useSSLPinning = $useSSLPinning")

        val clientBuilder = OkHttpClient.Builder()
            .cookieJar(ReactCookieJarContainer())
            .cache(null)

        if (useSSLPinning) {
            Log.d(TAG, "🔒 Factory[$instanceId] SSL ENABLED - Setting up certificate pinning...")
            try {
                val configJsonString = getConfigJsonString()
                if (configJsonString != null) {
                    val certificatePinnerBuilder = CertificatePinner.Builder()
                    addCertificatesToPinner(certificatePinnerBuilder, JSONObject(configJsonString))
                    val certificatePinner = certificatePinnerBuilder.build()
                    clientBuilder.certificatePinner(certificatePinner)
                    Log.d(TAG, "✅ Factory[$instanceId] SSL Pinning APPLIED successfully")
                } else {
                    Log.w(TAG, "⚠️ Factory[$instanceId] No SSL config found - SSL pinning NOT applied")
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Factory[$instanceId] Failed to apply SSL pinning", e)
            }
        } else {
            Log.d(TAG, "🔓 Factory[$instanceId] SSL DISABLED - Creating plain OkHttpClient without SSL pinning")
        }


        val client = clientBuilder.build()
        Log.d(TAG, "🚀 Factory[$instanceId] OkHttpClient created (SSL: ${if (useSSLPinning) "ENABLED" else "DISABLED"})")
        
        return client
    }

    private fun getConfigJsonString(): String? {
        val sharedPreferences = context.getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
        val runtimeConfig = sharedPreferences.getString("sslConfig", null)
        if (!runtimeConfig.isNullOrEmpty()) {
            Log.d(TAG, "📋 Using config from SharedPreferences")
            return runtimeConfig
        }

        return try {
            val inputStream = context.assets.open("ssl_config.json")
            val size = inputStream.available()
            val buffer = ByteArray(size)
            inputStream.read(buffer)
            inputStream.close()
            Log.d(TAG, "📄 Using config from assets")
            String(buffer, Charsets.UTF_8)
        } catch (e: IOException) {
            Log.d(TAG, "📄 ssl_config.json not found in assets")
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
                Log.d(TAG, "🔑 Added certificate pin for $hostname")
            }
        }
    }

    companion object {
        private const val TAG = "SslPinningFactory"
    }
}