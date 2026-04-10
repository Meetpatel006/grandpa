import { NativeModule, requireNativeModule } from "expo";

import {
  AndroidPermissionAccess,
  InstallationSnapshot,
  LiveBridgeStatus,
  MagicTextModuleEvents,
  ReceiverNativeConfig,
  TriggerOverrideResult,
} from "./MagicText.types";

declare class MagicTextModule extends NativeModule<MagicTextModuleEvents> {
  getInstallationSnapshotAsync(): Promise<InstallationSnapshot>;
  saveReceiverConfigAsync(
    groupId: string,
    inviteCode: string,
    label: string,
    vipNumbers: string[],
  ): Promise<InstallationSnapshot>;
  clearReceiverConfigAsync(): Promise<void>;
  setLastHandledCommandTokenAsync(token: string): Promise<void>;
  triggerEmergencyOverrideAsync(source: string): Promise<TriggerOverrideResult>;
  getReceiverConfigAsync(): Promise<ReceiverNativeConfig>;
  hasNotificationPolicyAccessAsync(): Promise<AndroidPermissionAccess>;
  openNotificationPolicyAccessSettingsAsync(): Promise<void>;
  startLiveBridgeServiceAsync(label: string): Promise<LiveBridgeStatus>;
  stopLiveBridgeServiceAsync(): Promise<LiveBridgeStatus>;
  getLiveBridgeServiceStatusAsync(): Promise<LiveBridgeStatus>;
}

export default requireNativeModule<MagicTextModule>("MagicText");
