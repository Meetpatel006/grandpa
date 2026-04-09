package expo.modules.volume

import android.content.Context
import android.app.NotificationManager
import android.media.AudioManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class VolumeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Volume")

    Function("unmutePhone") {
      val context = appContext.reactContext ?: return@Function
      val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

      audioManager.ringerMode = AudioManager.RINGER_MODE_NORMAL
      audioManager.setStreamVolume(
        AudioManager.STREAM_RING,
        audioManager.getStreamMaxVolume(AudioManager.STREAM_RING),
        0
      )
      audioManager.setStreamVolume(
        AudioManager.STREAM_NOTIFICATION,
        audioManager.getStreamMaxVolume(AudioManager.STREAM_NOTIFICATION),
        0
      )
      audioManager.setStreamVolume(
        AudioManager.STREAM_ALARM,
        audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM),
        0
      )

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
        notificationManager.isNotificationPolicyAccessGranted) {
        notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
      }
    }
  }
}
