package expo.modules.magictext

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class GrandparentFirebaseMessagingService : FirebaseMessagingService() {
  override fun onNewToken(token: String) {
    super.onNewToken(token)
    getSharedPreferences(FCM_PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_FCM_TOKEN, token)
      .apply()
  }

  override fun onMessageReceived(message: RemoteMessage) {
    super.onMessageReceived(message)

    val data = message.data
    if (data["type"] != "unmute") {
      return
    }

    showEmergencyNotification()

    val result = EmergencyOverrideManager.trigger(this, "fcm")
    if (result["executed"] != true) {
      return
    }

    val token = data["token"]
    if (!token.isNullOrBlank()) {
      EmergencyPreferences.setLastHandledCommandToken(this, token)
    }

    val bridgePrefs = getSharedPreferences(LIVE_BRIDGE_PREFS_NAME, Context.MODE_PRIVATE)
    NativeCommandAcknowledger.acknowledge(
      bridgePrefs.getString(LiveBridgeService.EXTRA_SITE_URL, null),
      data["groupId"],
      EmergencyPreferences.getDeviceId(this),
      token,
    )
  }

  private fun showEmergencyNotification() {
    ensureChannel()

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
      PendingIntent.FLAG_UPDATE_CURRENT or immutablePendingIntentFlag(),
    )

    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Emergency unmute received")
      .setContentText("Receiver audio was restored.")
      .setSmallIcon(android.R.drawable.stat_sys_warning)
      .setContentIntent(pendingIntent)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setAutoCancel(true)
      .build()

    val notificationManager =
      getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    notificationManager.notify(NOTIFICATION_ID, notification)
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val notificationManager =
      getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (notificationManager.getNotificationChannel(CHANNEL_ID) != null) {
      return
    }

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Emergency unmute",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "Shows urgent receiver unmute events."
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }

    notificationManager.createNotificationChannel(channel)
  }

  private fun immutablePendingIntentFlag(): Int {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_IMMUTABLE
    } else {
      0
    }
  }

  companion object {
    const val FCM_PREFS_NAME = "grandparents_fcm"
    const val KEY_FCM_TOKEN = "fcm_token"
    private const val LIVE_BRIDGE_PREFS_NAME = "grandparents_live_bridge"
    private const val CHANNEL_ID = "emergency_unmute_channel"
    private const val NOTIFICATION_ID = 3042
  }
}
