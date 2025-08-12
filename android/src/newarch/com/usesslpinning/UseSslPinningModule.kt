package com.usesslpinning

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = UseSslPinningModuleImpl.NAME)
class UseSslPinningModule(reactContext: ReactApplicationContext) : 
    NativeUseSslPinningSpec(reactContext) {

    init {
        UseSslPinningModuleImpl.initialize(reactContext)
    }

    override fun getName(): String {
        return UseSslPinningModuleImpl.NAME
    }

    override fun setUseSSLPinning(usePinning: Boolean, promise: Promise) {
        UseSslPinningModuleImpl.setUseSSLPinning(reactApplicationContext, usePinning, promise)
    }

    override fun getUseSSLPinning(promise: Promise) {
        UseSslPinningModuleImpl.getUseSSLPinning(reactApplicationContext, promise)
    }
}
