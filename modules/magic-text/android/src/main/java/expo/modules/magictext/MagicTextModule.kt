package expo.modules.magictext

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
  }
}
