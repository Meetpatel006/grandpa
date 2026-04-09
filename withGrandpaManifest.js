const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

const SMS_RECEIVER_NAME = "expo.modules.magictext.MagicTextReceiver";
const CALL_RECEIVER_NAME = "expo.modules.magictext.VipCallReceiver";

function ensureReceiver(application, receiver) {
  application.receiver = application.receiver || [];
  const alreadyPresent = application.receiver.some(
    (entry) => entry.$["android:name"] === receiver.$["android:name"],
  );

  if (!alreadyPresent) {
    application.receiver.push(receiver);
  }
}

module.exports = function withGrandpaManifest(config) {
  return withAndroidManifest(config, (pluginConfig) => {
    const manifest = pluginConfig.modResults.manifest;
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    ensureReceiver(application, {
      $: {
        "android:name": SMS_RECEIVER_NAME,
        "android:enabled": "true",
        "android:exported": "true",
        "android:permission": "android.permission.BROADCAST_SMS",
      },
      "intent-filter": [
        {
          action: [
            {
              $: {
                "android:name": "android.provider.Telephony.SMS_RECEIVED",
              },
            },
          ],
        },
      ],
    });

    ensureReceiver(application, {
      $: {
        "android:name": CALL_RECEIVER_NAME,
        "android:enabled": "true",
        "android:exported": "true",
      },
      "intent-filter": [
        {
          action: [
            {
              $: {
                "android:name": "android.intent.action.PHONE_STATE",
              },
            },
          ],
        },
      ],
    });

    return pluginConfig;
  });
};
