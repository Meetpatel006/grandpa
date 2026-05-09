package expo.modules.magictext

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.google.android.gms.tasks.Tasks
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MagicTextModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MagicText")

    AsyncFunction("getInstallationSnapshotAsync") {
      val context = appContext.reactContext ?: throw IllegalStateException("Context unavailable.")
      mapOf(
        "deviceId" to EmergencyPreferences.getDeviceId(context),
        "receiverConfig" to EmergencyPreferences.getReceiverConfig(context)
      )
    }

    AsyncFunction("saveReceiverConfigAsync") { groupId: String, inviteCode: String, label: String, vipNumbers: List<String> ->
      val context = appContext.reactContext ?: throw IllegalStateException("Context unavailable.")
      EmergencyPreferences.saveReceiverConfig(context, groupId, inviteCode, label, vipNumbers)
      mapOf(
        "deviceId" to EmergencyPreferences.getDeviceId(context),
        "receiverConfig" to EmergencyPreferences.getReceiverConfig(context)
      )
    }

    AsyncFunction("clearReceiverConfigAsync") {
      val context = appContext.reactContext ?: throw IllegalStateException("Context unavailable.")
      EmergencyPreferences.clearReceiverConfig(context)
      null
    }

    AsyncFunction("setLastHandledCommandTokenAsync") { token: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("Context unavailable.")
      EmergencyPreferences.setLastHandledCommandToken(context, token)
      null
    }

    AsyncFunction("triggerEmergencyOverrideAsync") { source: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("Context unavailable.")
      EmergencyOverrideManager.trigger(context, source)
    }

    AsyncFunction("getReceiverConfigAsync") {
      val context = appContext.reactContext ?: throw IllegalStateException("Context unavailable.")
      EmergencyPreferences.getReceiverConfig(context)
    }

    AsyncFunction("hasNotificationPolicyAccessAsync") {
      val context = appContext.reactContext ?: throw IllegalStateException("Context unavailable.")
      val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      mapOf("granted" to notificationManager.isNotificationPolicyAccessGranted)
    }

    AsyncFunction("openNotificationPolicyAccessSettingsAsync") {
      val context = appContext.reactContext ?: throw IllegalStateException("Context unavailable.")
      val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      null
    }

    AsyncFunction("startLiveBridgeServiceAsync") { label: String, deviceId: String, siteUrl: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("Context unavailable.")
      val intent = Intent(context, LiveBridgeService::class.java).apply {
        putExtra(LiveBridgeService.EXTRA_LABEL, label)
        putExtra(LiveBridgeService.EXTRA_DEVICE_ID, deviceId)
        putExtra(LiveBridgeService.EXTRA_SITE_URL, siteUrl)
      }
      ContextCompat.startForegroundService(context, intent)
      mapOf("running" to true)
    }

    AsyncFunction("stopLiveBridgeServiceAsync") {
      val context = appContext.reactContext ?: throw IllegalStateException("Context unavailable.")
      context.getSharedPreferences("grandparents_live_bridge", Context.MODE_PRIVATE)
        .edit()
        .clear()
        .apply()
      val intent = Intent(context, LiveBridgeService::class.java)
      context.stopService(intent)
      mapOf("running" to false)
    }

    AsyncFunction("getLiveBridgeServiceStatusAsync") {
      mapOf("running" to LiveBridgeServiceState.isRunning)
    }

    AsyncFunction("getFcmTokenAsync") {
      val context = appContext.reactContext ?: throw IllegalStateException("Context unavailable.")
      val cachedToken = context
        .getSharedPreferences(
          GrandparentFirebaseMessagingService.FCM_PREFS_NAME,
          Context.MODE_PRIVATE
        )
        .getString(GrandparentFirebaseMessagingService.KEY_FCM_TOKEN, null)

      if (!cachedToken.isNullOrBlank()) {
        return@AsyncFunction mapOf("token" to cachedToken)
      }

      val token = Tasks.await(FirebaseMessaging.getInstance().token)
      context
        .getSharedPreferences(
          GrandparentFirebaseMessagingService.FCM_PREFS_NAME,
          Context.MODE_PRIVATE
        )
        .edit()
        .putString(GrandparentFirebaseMessagingService.KEY_FCM_TOKEN, token)
        .apply()

      mapOf("token" to token)
    }
  }
}
