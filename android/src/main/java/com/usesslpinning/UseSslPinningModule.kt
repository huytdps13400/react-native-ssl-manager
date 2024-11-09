package com.usesslpinning

import android.content.Context // Thêm dòng này
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.modules.network.OkHttpClientProvider

class UseSslPinningModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return NAME
    }

    @ReactMethod
    fun setUseSSLPinning(usePinning: Boolean) {
        val sharedPreferences = reactApplicationContext.getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
        sharedPreferences.edit().putBoolean("useSSLPinning", usePinning).apply()
    }

    @ReactMethod
    fun getUseSSLPinning(promise: Promise) {
        val sharedPreferences = reactApplicationContext.getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
        val usePinning = sharedPreferences.getBoolean("useSSLPinning", true)
        promise.resolve(usePinning)
    }

  @ReactMethod
  fun initializeSslPinning(configJsonString: String, promise: Promise) {
    try {
      OkHttpClientProvider.setOkHttpClientFactory(UseSslPinningFactory(reactApplicationContext, configJsonString))
      Log.d("MyLibrary", "SSL Pinning initialized successfully")
      promise.resolve("SSL Pinning initialized successfully")
    } catch (e: Exception) {
      promise.reject("SSL_PINNING_ERROR", "Failed to initialize SSL Pinning", e)
    }
  }

    companion object {
        const val NAME = "UseSslPinning"
    }
}
