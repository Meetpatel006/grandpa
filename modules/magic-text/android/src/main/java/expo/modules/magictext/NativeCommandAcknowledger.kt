package expo.modules.magictext

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

object NativeCommandAcknowledger {
  private const val NETWORK_TIMEOUT_MS = 10000

  fun acknowledge(siteUrl: String?, groupId: String?, deviceId: String?, token: String?) {
    if (siteUrl.isNullOrBlank() || groupId.isNullOrBlank() || deviceId.isNullOrBlank() || token.isNullOrBlank()) {
      return
    }

    val connection =
      URL("${siteUrl.trim().trimEnd('/')}/native/ack-command").openConnection() as HttpURLConnection
    val body = JSONObject()
      .put("groupId", groupId)
      .put("deviceId", deviceId)
      .put("token", token)
      .toString()
      .toByteArray(StandardCharsets.UTF_8)

    connection.requestMethod = "POST"
    connection.connectTimeout = NETWORK_TIMEOUT_MS
    connection.readTimeout = NETWORK_TIMEOUT_MS
    connection.doOutput = true
    connection.setRequestProperty("Content-Type", "application/json")
    connection.setRequestProperty("Content-Length", body.size.toString())

    try {
      connection.outputStream.use { output -> output.write(body) }
      if (connection.responseCode !in 200..299) {
        throw IllegalStateException("Ack failed with HTTP ${connection.responseCode}.")
      }
    } finally {
      connection.disconnect()
    }
  }
}
