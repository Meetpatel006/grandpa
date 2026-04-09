package expo.modules.magictext

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.PhoneNumberUtils
import android.telephony.TelephonyManager

class VipCallReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) {
      return
    }

    val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
    val incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)

    if (state != TelephonyManager.EXTRA_STATE_RINGING || incomingNumber.isNullOrBlank()) {
      return
    }

    val vipNumbers = EmergencyPreferences.getVipNumbers(context)
    val isVip = vipNumbers.any { vip ->
      PhoneNumberUtils.compare(context, vip, incomingNumber)
    }

    if (isVip) {
      EmergencyOverrideManager.trigger(context, "vip_call")
    }
  }
}
