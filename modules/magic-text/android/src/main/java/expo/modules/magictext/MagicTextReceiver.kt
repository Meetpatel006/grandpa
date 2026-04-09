package expo.modules.magictext

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

class MagicTextReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
      return
    }

    val expectedKeyword =
      EmergencyPreferences.getReceiverConfig(context)["magicKeyword"] as? String ?: "#UNMUTE#"
    val message = Telephony.Sms.Intents.getMessagesFromIntent(intent).joinToString(separator = "") {
      it.messageBody ?: ""
    }

    if (message.contains(expectedKeyword, ignoreCase = false)) {
      EmergencyOverrideManager.trigger(context, "sms")
    }
  }
}
