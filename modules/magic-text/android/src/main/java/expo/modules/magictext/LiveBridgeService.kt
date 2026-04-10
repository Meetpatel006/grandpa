package expo.modules.magictext

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class LiveBridgeService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    LiveBridgeServiceState.isRunning = true
    ensureChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val receiverLabel = intent?.getStringExtra(EXTRA_LABEL)?.takeIf { it.isNotBlank() }
      ?: "Receiver device"

    startForeground(NOTIFICATION_ID, buildNotification(receiverLabel))
    return START_STICKY
  }

  override fun onDestroy() {
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
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Live bridge active")
      .setContentText("$receiverLabel will keep listening for emergency commands.")
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .build()
  }

  companion object {
    private const val CHANNEL_ID = "live_bridge_channel"
    private const val NOTIFICATION_ID = 2042
    const val EXTRA_LABEL = "receiver_label"
  }
}
