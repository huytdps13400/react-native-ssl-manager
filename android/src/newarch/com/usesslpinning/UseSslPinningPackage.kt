package com.usesslpinning

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class UseSslPinningPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return when (name) {
      UseSslPinningModuleImpl.NAME -> UseSslPinningModule(reactContext)
      else -> null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      val isTurboModule = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED

      val moduleInfo = ReactModuleInfo(
        UseSslPinningModuleImpl.NAME,
        UseSslPinningModuleImpl.NAME,
        false,
        true,
        true,
        false,
        isTurboModule
      )

      mapOf(
        UseSslPinningModuleImpl.NAME to moduleInfo
      )
    }
  }
}
