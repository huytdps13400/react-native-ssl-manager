package com.usesslpinning

import android.content.Context
import androidx.startup.Initializer

/**
 * Installs the pinned OkHttpClientFactory at application startup, independent of
 * the React Native module lifecycle.
 *
 * React Native instantiates native modules lazily (especially under the New
 * Architecture), so relying on the module constructor means pinning would not be
 * enforced until JavaScript first touches the module. This androidx.startup
 * Initializer runs from a ContentProvider before Application.onCreate completes —
 * before the React Native bridge is built — guaranteeing the pinned factory is
 * in place for the first network request.
 */
class SslPinningInitializer : Initializer<Unit> {
    override fun create(context: Context) {
        UseSslPinningModuleImpl.initialize(context.applicationContext)
    }

    override fun dependencies(): List<Class<out Initializer<*>>> = emptyList()
}
