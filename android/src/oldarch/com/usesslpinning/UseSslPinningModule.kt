package com.usesslpinning

import android.content.Context 
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.modules.network.OkHttpClientProvider
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = UseSslPinningModuleImpl.NAME)
class UseSslPinningModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {

    init {
        UseSslPinningModuleImpl.initialize(reactContext)
    }

    override fun getName(): String {
        return UseSslPinningModuleImpl.NAME
    }

    @ReactMethod
    fun setUseSSLPinning(usePinning: Boolean, promise: Promise) {
        UseSslPinningModuleImpl.setUseSSLPinning(reactApplicationContext, usePinning, promise)
    }

    @ReactMethod
    fun getUseSSLPinning(promise: Promise) {
        UseSslPinningModuleImpl.getUseSSLPinning(reactApplicationContext, promise)
    }

    @ReactMethod
    fun setSSLConfig(config: String, promise: Promise) {
        UseSslPinningModuleImpl.setSSLConfig(reactApplicationContext, config, promise)
    }

    @ReactMethod
    fun getPinnedDomains(promise: Promise) {
        UseSslPinningModuleImpl.getPinnedDomains(reactApplicationContext, promise)
    }
}