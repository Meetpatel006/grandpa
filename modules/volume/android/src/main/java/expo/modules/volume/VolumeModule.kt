package expo.modules.volume

import android.content.Context
import android.app.NotificationManager
import android.media.AudioManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class VolumeModule : Module() {
  private fun maximizeStream(audioManager: AudioManager, stream: Int) {
    try {
      val maxVolume = audioManager.getStreamMaxVolume(stream)
      if (maxVolume > 0) {
        audioManager.setStreamVolume(stream, maxVolume, 0)
      }
    } catch (_: Throwable) {
      // Some streams are device-specific or restricted.
    }
  }

  override fun definition() = ModuleDefinition {
    Name("Volume")

    Function("unmutePhone") {
      val context = appContext.reactContext ?: return@Function null
      val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

      audioManager.ringerMode = AudioManager.RINGER_MODE_NORMAL
      maximizeStream(audioManager, AudioManager.STREAM_RING)
      maximizeStream(audioManager, AudioManager.STREAM_NOTIFICATION)
      maximizeStream(audioManager, AudioManager.STREAM_ALARM)
      maximizeStream(audioManager, AudioManager.STREAM_MUSIC)
      maximizeStream(audioManager, AudioManager.STREAM_SYSTEM)
      maximizeStream(audioManager, AudioManager.STREAM_VOICE_CALL)
      maximizeStream(audioManager, AudioManager.STREAM_DTMF)

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
        notificationManager.isNotificationPolicyAccessGranted) {
        notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
      }

      null
    }
  }
}
