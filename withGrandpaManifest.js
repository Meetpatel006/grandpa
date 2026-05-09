const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

const SMS_RECEIVER_NAME = "expo.modules.magictext.MagicTextReceiver";
const CALL_RECEIVER_NAME = "expo.modules.magictext.VipCallReceiver";
const LIVE_BRIDGE_SERVICE_NAME = "expo.modules.magictext.LiveBridgeService";
const FCM_SERVICE_NAME = "expo.modules.magictext.GrandparentFirebaseMessagingService";

function ensurePermission(manifest, name) {
  manifest["uses-permission"] = manifest["uses-permission"] || [];
  const alreadyPresent = manifest["uses-permission"].some(
    (entry) => entry.$["android:name"] === name,
  );

  if (!alreadyPresent) {
    manifest["uses-permission"].push({
      $: {
        "android:name": name,
      },
    });
  }
}

function ensureReceiver(application, receiver) {
  application.receiver = application.receiver || [];
  const alreadyPresent = application.receiver.some(
    (entry) => entry.$["android:name"] === receiver.$["android:name"],
  );

  if (!alreadyPresent) {
    application.receiver.push(receiver);
  }
}

function ensureService(application, service) {
  application.service = application.service || [];
  const alreadyPresent = application.service.some(
    (entry) => entry.$["android:name"] === service.$["android:name"],
  );

  if (!alreadyPresent) {
    application.service.push(service);
  }
}

function ensureMainApplication(manifest) {
  manifest.application = manifest.application || [];

  if (manifest.application.length === 0) {
    manifest.application.push({
      $: {
        "android:name": ".MainApplication",
      },
    });
  }

  if (!manifest.application[0].$) {
    manifest.application[0].$ = {};
  }

  return manifest.application[0];
}

module.exports = function withGrandpaManifest(config) {
  return withAndroidManifest(config, (pluginConfig) => {
    const manifest = pluginConfig.modResults.manifest;
    const application =
      AndroidConfig.Manifest.getMainApplication(manifest) ??
      ensureMainApplication(manifest);

    [
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
      "android.permission.POST_NOTIFICATIONS",
    ].forEach((permission) => ensurePermission(manifest, permission));

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

    ensureService(application, {
      $: {
        "android:name": LIVE_BRIDGE_SERVICE_NAME,
        "android:enabled": "true",
        "android:exported": "false",
        "android:foregroundServiceType": "dataSync",
        "android:stopWithTask": "false",
      },
    });

    ensureService(application, {
      $: {
        "android:name": FCM_SERVICE_NAME,
        "android:enabled": "true",
        "android:exported": "false",
      },
      "intent-filter": [
        {
          action: [
            {
              $: {
                "android:name": "com.google.firebase.MESSAGING_EVENT",
              },
            },
          ],
        },
      ],
    });

    return pluginConfig;
  });
};
