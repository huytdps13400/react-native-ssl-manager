package com.usesslpinning

import android.content.Context 
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.modules.network.OkHttpClientProvider


class UseSslPinningModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    init {
        try {
            OkHttpClientProvider.setOkHttpClientFactory(SslPinningFactory(reactContext))
        } catch (e: Exception) {
            // SSL Factory setup failed - continue without custom factory
        }
    }

    override fun getName(): String {
        return NAME
    }

    @ReactMethod
    fun setUseSSLPinning(usePinning: Boolean, promise: Promise) {
        val sharedPreferences = reactApplicationContext.getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
        sharedPreferences.edit().putBoolean("useSSLPinning", usePinning).apply()
        
        // Force new factory creation to bypass RN client cache
        OkHttpClientProvider.setOkHttpClientFactory(SslPinningFactory(reactApplicationContext))
        
        promise.resolve(null)
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