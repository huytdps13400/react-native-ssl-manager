package com.usesslpinning

import android.content.Context

import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.ReactCookieJarContainer
import okhttp3.OkHttpClient

class SslPinningFactory(private val context: Context) : OkHttpClientFactory {

    override fun createNewNetworkModuleClient(): OkHttpClient {
        val sharedPreferences = context.getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
        val useSSLPinning = sharedPreferences.getBoolean("useSSLPinning", true)

        val clientBuilder = OkHttpClient.Builder()
            .cookieJar(ReactCookieJarContainer())
            .cache(null)

        if (useSSLPinning) {
            try {
                PinningClientConfigurator.apply(clientBuilder, context)
            } catch (e: Exception) {
                // SSL pinning setup failed - continue with regular client
            }
        }

        return clientBuilder.build()
    }

    companion object {
        private const val TAG = "SslPinningFactory"
    }
}
