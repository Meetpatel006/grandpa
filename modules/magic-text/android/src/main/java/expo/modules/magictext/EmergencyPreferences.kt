package expo.modules.magictext

import android.content.Context
import org.json.JSONArray
import java.util.UUID

private const val PREFS_NAME = "grandparents_emergency"
private const val KEY_DEVICE_ID = "device_id"
private const val KEY_GROUP_ID = "group_id"
private const val KEY_INVITE_CODE = "invite_code"
private const val KEY_LABEL = "label"
private const val KEY_VIP_NUMBERS = "vip_numbers"
private const val KEY_MAGIC_KEYWORD = "magic_keyword"
private const val KEY_LAST_HANDLED_TOKEN = "last_handled_command_token"
private const val KEY_LAST_TRIGGER_AT = "last_trigger_at"
private const val KEY_LAST_TRIGGER_SOURCE = "last_trigger_source"

object EmergencyPreferences {
  fun getDeviceId(context: Context): String {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val existing = prefs.getString(KEY_DEVICE_ID, null)
    if (!existing.isNullOrBlank()) {
      return existing
    }

    val generated = "android-${UUID.randomUUID()}"
    prefs.edit().putString(KEY_DEVICE_ID, generated).apply()
    return generated
  }

  fun getReceiverConfig(context: Context): Map<String, Any?> {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return mapOf(
      "groupId" to prefs.getString(KEY_GROUP_ID, null),
      "inviteCode" to prefs.getString(KEY_INVITE_CODE, null),
      "label" to prefs.getString(KEY_LABEL, null),
      "vipNumbers" to getVipNumbers(context),
      "magicKeyword" to prefs.getString(KEY_MAGIC_KEYWORD, "#UNMUTE#"),
      "lastHandledCommandToken" to prefs.getString(KEY_LAST_HANDLED_TOKEN, null),
      "lastTriggerAt" to getNullableLong(prefs.getLong(KEY_LAST_TRIGGER_AT, -1L)),
      "lastTriggerSource" to prefs.getString(KEY_LAST_TRIGGER_SOURCE, null),
    )
  }

  fun saveReceiverConfig(
    context: Context,
    groupId: String,
    inviteCode: String,
    label: String,
    vipNumbers: List<String>,
  ) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit()
      .putString(KEY_GROUP_ID, groupId)
      .putString(KEY_INVITE_CODE, inviteCode)
      .putString(KEY_LABEL, label)
      .putString(KEY_VIP_NUMBERS, JSONArray(vipNumbers).toString())
      .putString(KEY_MAGIC_KEYWORD, "#UNMUTE#")
      .apply()
  }

  fun clearReceiverConfig(context: Context) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit()
      .remove(KEY_GROUP_ID)
      .remove(KEY_INVITE_CODE)
      .remove(KEY_LABEL)
      .remove(KEY_VIP_NUMBERS)
      .remove(KEY_LAST_HANDLED_TOKEN)
      .remove(KEY_LAST_TRIGGER_AT)
      .remove(KEY_LAST_TRIGGER_SOURCE)
      .apply()
  }

  fun setLastHandledCommandToken(context: Context, token: String) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit().putString(KEY_LAST_HANDLED_TOKEN, token).apply()
  }

  fun recordTrigger(context: Context, source: String, triggeredAt: Long) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit()
      .putLong(KEY_LAST_TRIGGER_AT, triggeredAt)
      .putString(KEY_LAST_TRIGGER_SOURCE, source)
      .apply()
  }

  fun getVipNumbers(context: Context): List<String> {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val serialized = prefs.getString(KEY_VIP_NUMBERS, "[]") ?: "[]"
    val parsed = JSONArray(serialized)
    return buildList {
      for (index in 0 until parsed.length()) {
        val value = parsed.optString(index).trim()
        if (value.isNotBlank()) {
          add(value)
        }
      }
    }
  }

  private fun getNullableLong(value: Long): Long? {
    return if (value < 0L) null else value
  }
}
