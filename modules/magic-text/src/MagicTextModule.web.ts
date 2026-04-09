import {
  AndroidPermissionAccess,
  InstallationSnapshot,
  ReceiverNativeConfig,
  TriggerOverrideResult,
} from "./MagicText.types";

let installationSnapshot: InstallationSnapshot = {
  deviceId: "web-simulator",
  receiverConfig: {
    groupId: null,
    inviteCode: null,
    label: null,
    vipNumbers: [],
    magicKeyword: "#UNMUTE#",
    lastHandledCommandToken: null,
    lastTriggerAt: null,
    lastTriggerSource: null,
  },
};

const MagicTextModule = {
  async getInstallationSnapshotAsync() {
    return installationSnapshot;
  },
  async saveReceiverConfigAsync(
    groupId: string,
    inviteCode: string,
    label: string,
    vipNumbers: string[],
  ) {
    installationSnapshot = {
      ...installationSnapshot,
      receiverConfig: {
        ...installationSnapshot.receiverConfig,
        groupId,
        inviteCode,
        label,
        vipNumbers,
      },
    };
    return installationSnapshot;
  },
  async clearReceiverConfigAsync() {
    installationSnapshot = {
      ...installationSnapshot,
      receiverConfig: {
        ...installationSnapshot.receiverConfig,
        groupId: null,
        inviteCode: null,
        label: null,
        vipNumbers: [],
      },
    };
  },
  async setLastHandledCommandTokenAsync(token: string) {
    installationSnapshot = {
      ...installationSnapshot,
      receiverConfig: {
        ...installationSnapshot.receiverConfig,
        lastHandledCommandToken: token,
      },
    };
  },
  async triggerEmergencyOverrideAsync(source: string): Promise<TriggerOverrideResult> {
    const triggeredAt = Date.now();
    installationSnapshot = {
      ...installationSnapshot,
      receiverConfig: {
        ...installationSnapshot.receiverConfig,
        lastTriggerAt: triggeredAt,
        lastTriggerSource: source,
      },
    };
    return {
      executed: true,
      source,
      triggeredAt,
      reason: "Web shim executed.",
    };
  },
  async getReceiverConfigAsync(): Promise<ReceiverNativeConfig> {
    return installationSnapshot.receiverConfig;
  },
  async hasNotificationPolicyAccessAsync(): Promise<AndroidPermissionAccess> {
    return { granted: true };
  },
  async openNotificationPolicyAccessSettingsAsync(): Promise<void> {
    return;
  },
};

export default MagicTextModule;
