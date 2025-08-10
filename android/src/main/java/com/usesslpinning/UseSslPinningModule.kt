package com.usesslpinning

import android.content.Context 
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.modules.network.OkHttpClientProvider
import android.util.Log

class UseSslPinningModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    init {
        try {
            OkHttpClientProvider.setOkHttpClientFactory(SslPinningFactory(reactContext))
            Log.d(NAME, "✅ SSL Factory setup complete - will auto-check settings per request")
        } catch (e: Exception) {
            Log.e(NAME, "❌ Failed to setup SSL Factory", e)
        }
    }

    override fun getName(): String {
        return NAME
    }

    @ReactMethod
    fun setUseSSLPinning(usePinning: Boolean) {
        Log.d(NAME, "🎚️ setUseSSLPinning called with: $usePinning")
        
        val sharedPreferences = reactApplicationContext.getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
        val oldValue = sharedPreferences.getBoolean("useSSLPinning", true)
        
        sharedPreferences.edit().putBoolean("useSSLPinning", usePinning).apply()
        
        Log.d(NAME, "✅ SSL setting updated: $oldValue → $usePinning")
        
        Log.d(NAME, "🔄 FORCING new factory creation to bypass RN client cache...")
        OkHttpClientProvider.setOkHttpClientFactory(SslPinningFactory(reactApplicationContext))
        Log.d(NAME, "✅ NEW factory instance created - client cache bypassed!")
    }

    @ReactMethod
    fun getUseSSLPinning(promise: Promise) {
        val sharedPreferences = reactApplicationContext.getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
        val usePinning = sharedPreferences.getBoolean("useSSLPinning", true)
        promise.resolve(usePinning)
    }


    companion object {
        const val NAME = "UseSslPinning"
    }
}