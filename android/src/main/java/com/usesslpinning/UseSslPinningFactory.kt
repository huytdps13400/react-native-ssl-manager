package com.usesslpinning

import android.content.Context
import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.ReactCookieJarContainer
import okhttp3.CertificatePinner
import okhttp3.OkHttpClient
import org.json.JSONObject
import org.json.JSONTokener
import java.io.InputStream
import java.nio.charset.Charset

class UseSslPinningFactory(private val context: Context) : OkHttpClientFactory {

  override fun createNewNetworkModuleClient(): OkHttpClient {
    val sha256KeysMap = loadConfig(context)
    val clientBuilder = OkHttpClient.Builder()
      .cookieJar(ReactCookieJarContainer())
      .cache(null)

    for ((hostname, keys) in sha256KeysMap) {
      val certificatePinnerBuilder = CertificatePinner.Builder()
      for (key in keys) {
        certificatePinnerBuilder.add(hostname, key)
      }
      clientBuilder.certificatePinner(certificatePinnerBuilder.build())
    }

    return clientBuilder.build()
  }

  private fun loadConfig(context: Context): Map<String, List<String>> {
    val sha256KeysMap = mutableMapOf<String, List<String>>()
    try {
      val assetManager = context.assets
      val inputStream: InputStream = assetManager.open("config.json")
      val size: Int = inputStream.available()
      val buffer = ByteArray(size)
      inputStream.read(buffer)
      inputStream.close()
      val json = String(buffer, Charset.forName("UTF-8"))

      val jsonObject = JSONTokener(json).nextValue() as JSONObject
      val sha256Keys = jsonObject.getJSONObject("sha256Keys")

      val keys = sha256Keys.keys()
      while (keys.hasNext()) {
        val hostname = keys.next()
        val keyArray = sha256Keys.getJSONArray(hostname)
        val keyStrings = List(keyArray.length()) { i -> keyArray.getString(i) }
        sha256KeysMap[hostname] = keyStrings
      }
    } catch (e: Exception) {
      e.printStackTrace()
    }

    return sha256KeysMap
  }
}


