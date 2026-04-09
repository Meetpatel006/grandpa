package expo.modules.magictext

import android.app.NotificationManager
import android.content.Context
import android.media.AudioManager
import android.os.Build

private const val FALLBACK_COOLDOWN_MS = 5000L

object EmergencyOverrideManager {
  fun trigger(context: Context, source: String): Map<String, Any?> {
    val prefs = context.getSharedPreferences("grandparents_emergency", Context.MODE_PRIVATE)
    val now = System.currentTimeMillis()
    val lastTriggerAt = prefs.getLong("last_trigger_at", -1L)

    if (lastTriggerAt > 0 && now - lastTriggerAt < FALLBACK_COOLDOWN_MS) {
      return mapOf(
        "executed" to false,
        "source" to source,
        "triggeredAt" to lastTriggerAt,
        "reason" to "Skipped duplicate fallback trigger."
      )
    }

    val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    audioManager.ringerMode = AudioManager.RINGER_MODE_NORMAL
    val ringMax = audioManager.getStreamMaxVolume(AudioManager.STREAM_RING)
    val notificationMax = audioManager.getStreamMaxVolume(AudioManager.STREAM_NOTIFICATION)
    val alarmMax = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM)
    audioManager.setStreamVolume(AudioManager.STREAM_RING, ringMax, 0)
    audioManager.setStreamVolume(AudioManager.STREAM_NOTIFICATION, notificationMax, 0)
    audioManager.setStreamVolume(AudioManager.STREAM_ALARM, alarmMax, 0)

    val notificationManager =
      context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    val hasPolicyAccess =
      Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
        notificationManager.isNotificationPolicyAccessGranted

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && hasPolicyAccess) {
      notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
    }

    val reason =
      if (!hasPolicyAccess) {
        "Volume raised, but Do Not Disturb access is not granted."
      } else {
        "Emergency override executed."
      }

    EmergencyPreferences.recordTrigger(context, source, now)

    return mapOf(
      "executed" to true,
      "source" to source,
      "triggeredAt" to now,
      "reason" to reason
    )
  }
}
