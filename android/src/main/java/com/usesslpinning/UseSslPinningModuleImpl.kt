package com.usesslpinning

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.network.OkHttpClientProvider

object UseSslPinningModuleImpl {
    const val NAME = "UseSslPinning"
    
    fun initialize(reactContext: ReactApplicationContext) {
        try {
            OkHttpClientProvider.setOkHttpClientFactory(SslPinningFactory(reactContext))
        } catch (e: Exception) {
            // SSL Factory setup failed - continue without custom factory
        }
    }
    
    fun setUseSSLPinning(reactContext: ReactApplicationContext, usePinning: Boolean, promise: Promise) {
        val sharedPreferences = reactContext.getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
        sharedPreferences.edit().putBoolean("useSSLPinning", usePinning).apply()
        
        // Force new factory creation to bypass RN client cache
        OkHttpClientProvider.setOkHttpClientFactory(SslPinningFactory(reactContext))
        
        promise.resolve(null)
    }
    
    fun getUseSSLPinning(reactContext: ReactApplicationContext, promise: Promise) {
        val sharedPreferences = reactContext.getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
        val usePinning = sharedPreferences.getBoolean("useSSLPinning", true)
        promise.resolve(usePinning)
    }
}
