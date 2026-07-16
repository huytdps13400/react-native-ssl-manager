package com.margelo.nitro.sslmanager

import android.content.Context
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import com.usesslpinning.PinningFailureReporter
import com.usesslpinning.UseSslPinningModuleImpl

@Keep
@DoNotStrip
class HybridSslManager : HybridSslManagerSpec() {

    private val context: Context
        get() = NitroModules.applicationContext
            ?: throw IllegalStateException("No ApplicationContext set! Is the Nitro module installed correctly?")

    override fun setUseSSLPinning(usePinning: Boolean): Promise<Unit> {
        val appContext = context
        return Promise.async {
            UseSslPinningModuleImpl.setUseSSLPinning(appContext, usePinning)
        }
    }

    override fun getUseSSLPinning(): Promise<Boolean> {
        val appContext = context
        return Promise.async {
            UseSslPinningModuleImpl.getUseSSLPinning(appContext)
        }
    }

    override fun setSSLConfig(config: SslPinningConfig): Promise<Unit> {
        val appContext = context
        return Promise.async {
            UseSslPinningModuleImpl.setSSLConfig(appContext, config.sha256Keys)
        }
    }

    override fun getPinnedDomains(): Promise<Array<String>> {
        val appContext = context
        return Promise.async {
            UseSslPinningModuleImpl.getPinnedDomains(appContext)
        }
    }

    override fun setSSLConfigJson(configJson: String): Promise<Unit> {
        val appContext = context
        return Promise.async {
            UseSslPinningModuleImpl.setSSLConfigJson(appContext, configJson)
        }
    }

    override fun setPinningFailureCallback(callback: (event: PinningFailureEvent) -> Unit) {
        PinningFailureReporter.handler = { host, enforced, servedPins, message, timestampMs ->
            callback(
                PinningFailureEvent(
                    host,
                    enforced,
                    servedPins.toTypedArray(),
                    message,
                    timestampMs.toDouble()
                )
            )
        }
    }

    override fun clearPinningFailureCallback() {
        PinningFailureReporter.handler = null
    }

    companion object {
        init {
            NitroSslManagerOnLoad.initializeNative()
        }
    }
}
