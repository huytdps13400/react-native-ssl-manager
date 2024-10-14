package com.usesslpinning

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class UseSslPinningModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val sslPinningFactory = UseSslPinningFactory(reactContext)

  override fun getName(): String {
    return NAME
  }

  @ReactMethod
  fun setUseSSLPinning(use: Boolean, promise: Promise) {
    sslPinningFactory.setUseSSLPinning(use)
    promise.resolve(null)
  }

  @ReactMethod
  fun setConfig(config: String, promise: Promise) {
    sslPinningFactory.setConfig(config)
    promise.resolve(null)
  }

  companion object {
    const val NAME = "UseSslPinning"
  }
}