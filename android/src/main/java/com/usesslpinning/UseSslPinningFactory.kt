package com.usesslpinning

import android.content.Context
import android.util.Log
import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.ReactCookieJarContainer
import okhttp3.CertificatePinner
import okhttp3.OkHttpClient
import org.json.JSONObject

class UseSslPinningFactory(
  private val context: Context,
  private val configJsonString: String
) : OkHttpClientFactory {

  override fun createNewNetworkModuleClient(): OkHttpClient {
    val sharedPreferences = context.getSharedPreferences("AppSettings", Context.MODE_PRIVATE)
    val useSSLPinning = sharedPreferences.getBoolean("useSSLPinning", true)

    val clientBuilder = OkHttpClient.Builder().cookieJar(ReactCookieJarContainer()).apply {
      if (useSSLPinning) {
        val certificatePinnerBuilder = CertificatePinner.Builder()

        try {
          val configJson = JSONObject(configJsonString)
          addCertificatesToPinner(certificatePinnerBuilder, configJson)
          val certificatePinner = certificatePinnerBuilder.build()
          certificatePinner(certificatePinner)
        } catch (e: Exception) {
          e.printStackTrace()
        }
      }
    }.cache(null).build()

    return clientBuilder
  }
  private fun addCertificatesToPinner(certificatePinnerBuilder: CertificatePinner.Builder, configJson: JSONObject) {
    val sha256Keys = configJson.getJSONObject("sha256Keys")
    val hostnames = sha256Keys.keys()
    while (hostnames.hasNext()) {
      val hostname = hostnames.next()
      val keysArray = sha256Keys.getJSONArray(hostname)
      for (i in 0 until keysArray.length()) {
        val sha256Key = keysArray.getString(i)
        certificatePinnerBuilder.add(hostname, sha256Key)
      }
    }
  }
}

