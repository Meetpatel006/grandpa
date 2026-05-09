package expo.modules.magictext

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL

class LiveBridgeService : Service() {
  @Volatile
  private var shouldPoll = false

  private var pollThread: Thread? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    LiveBridgeServiceState.isRunning = true
    ensureChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val servicePrefs = getSharedPreferences(SERVICE_PREFS_NAME, Context.MODE_PRIVATE)
    val receiverLabel = intent?.getStringExtra(EXTRA_LABEL)?.takeIf { it.isNotBlank() }
      ?: servicePrefs.getString(EXTRA_LABEL, null)?.takeIf { it.isNotBlank() }
      ?: "Receiver device"
    val deviceId = intent?.getStringExtra(EXTRA_DEVICE_ID)?.takeIf { it.isNotBlank() }
      ?: servicePrefs.getString(EXTRA_DEVICE_ID, null)?.takeIf { it.isNotBlank() }
    val siteUrl = intent?.getStringExtra(EXTRA_SITE_URL)?.takeIf { it.isNotBlank() }
      ?: servicePrefs.getString(EXTRA_SITE_URL, null)?.takeIf { it.isNotBlank() }

    if (deviceId != null && siteUrl != null) {
      servicePrefs.edit()
        .putString(EXTRA_LABEL, receiverLabel)
        .putString(EXTRA_DEVICE_ID, deviceId)
        .putString(EXTRA_SITE_URL, siteUrl)
        .apply()
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        buildNotification(receiverLabel),
        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
      )
    } else {
      startForeground(NOTIFICATION_ID, buildNotification(receiverLabel))
    }

    if (deviceId != null && siteUrl != null) {
      startPolling(deviceId, siteUrl)
    }

    return START_STICKY
  }

  override fun onDestroy() {
    shouldPoll = false
    pollThread?.interrupt()
    pollThread = null
    LiveBridgeServiceState.isRunning = false
    super.onDestroy()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val notificationManager =
      getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    val existingChannel = notificationManager.getNotificationChannel(CHANNEL_ID)
    if (existingChannel != null) {
      return
    }

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Live bridge",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Keeps the emergency live bridge active."
      setShowBadge(false)
      lockscreenVisibility = Notification.VISIBILITY_PRIVATE
    }

    notificationManager.createNotificationChannel(channel)
  }

  private fun buildNotification(receiverLabel: String): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    } ?: Intent(Intent.ACTION_VIEW, Uri.parse("grandparents://receiver")).apply {
      setPackage(packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or immutablePendingIntentFlag()
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Live bridge active")
      .setContentText("$receiverLabel is listening for emergency commands.")
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .build()
  }

  private fun startPolling(deviceId: String, siteUrl: String) {
    if (shouldPoll && pollThread?.isAlive == true) {
      return
    }

    shouldPoll = true
    pollThread = Thread {
      while (shouldPoll && !Thread.currentThread().isInterrupted) {
        try {
          pollOnce(deviceId, siteUrl)
          Thread.sleep(POLL_INTERVAL_MS)
        } catch (_: InterruptedException) {
          Thread.currentThread().interrupt()
        } catch (_: Throwable) {
          try {
            Thread.sleep(RETRY_INTERVAL_MS)
          } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
          }
        }
      }
    }.apply {
      name = "LiveBridgeServicePoller"
      isDaemon = true
      start()
    }
  }

  private fun pollOnce(deviceId: String, siteUrl: String) {
    val lastHandledToken =
      EmergencyPreferences.getReceiverConfig(this)["lastHandledCommandToken"] as? String
    val commandUrl = buildCommandUrl(siteUrl, deviceId, lastHandledToken)
    val response = getJson(commandUrl)
    val command = response.optJSONObject("command") ?: return
    val token = command.optString("token").takeIf { it.isNotBlank() } ?: return
    val groupId = command.optString("groupId").takeIf { it.isNotBlank() } ?: return

    val result = EmergencyOverrideManager.trigger(this, "convex")
    if (result["executed"] == true) {
      EmergencyPreferences.setLastHandledCommandToken(this, token)
      NativeCommandAcknowledger.acknowledge(siteUrl, groupId, deviceId, token)
    }
  }

  private fun getJson(url: String): JSONObject {
    val connection = URL(url).openConnection() as HttpURLConnection
    connection.requestMethod = "GET"
    connection.connectTimeout = NETWORK_TIMEOUT_MS
    connection.readTimeout = NETWORK_TIMEOUT_MS

    return connection.use {
      val stream = if (it.responseCode in 200..299) it.inputStream else it.errorStream
      if (stream == null) {
        throw IllegalStateException("Empty HTTP response.")
      }
      JSONObject(stream.bufferedReader().use { reader -> reader.readText() })
    }
  }

  private fun buildCommandUrl(
    siteUrl: String,
    deviceId: String,
    lastHandledToken: String?
  ): String {
    val encodedDeviceId = urlEncode(deviceId)
    val tokenQuery = lastHandledToken?.takeIf { it.isNotBlank() }?.let {
      "&lastHandledCommandToken=${urlEncode(it)}"
    } ?: ""

    return "${normalizeSiteUrl(siteUrl)}/native/receiver-command?deviceId=$encodedDeviceId$tokenQuery"
  }

  private fun normalizeSiteUrl(siteUrl: String): String {
    return siteUrl.trim().trimEnd('/')
  }

  private fun urlEncode(value: String): String {
    return URLEncoder.encode(value, "UTF-8")
  }

  private fun immutablePendingIntentFlag(): Int {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_IMMUTABLE
    } else {
      0
    }
  }

  private inline fun <T> HttpURLConnection.use(block: (HttpURLConnection) -> T): T {
    try {
      return block(this)
    } finally {
      disconnect()
    }
  }

  companion object {
    private const val CHANNEL_ID = "live_bridge_channel"
    private const val SERVICE_PREFS_NAME = "grandparents_live_bridge"
    private const val NOTIFICATION_ID = 2042
    private const val POLL_INTERVAL_MS = 5000L
    private const val RETRY_INTERVAL_MS = 10000L
    private const val NETWORK_TIMEOUT_MS = 10000
    const val EXTRA_LABEL = "receiver_label"
    const val EXTRA_DEVICE_ID = "device_id"
    const val EXTRA_SITE_URL = "site_url"
  }
}
