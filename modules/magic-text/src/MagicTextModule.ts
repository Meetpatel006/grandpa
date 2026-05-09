import { NativeModule, requireNativeModule } from "expo";

import {
  AndroidPermissionAccess,
  FcmTokenSnapshot,
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
  startLiveBridgeServiceAsync(
    label: string,
    deviceId: string,
    siteUrl: string,
  ): Promise<LiveBridgeStatus>;
  stopLiveBridgeServiceAsync(): Promise<LiveBridgeStatus>;
  getLiveBridgeServiceStatusAsync(): Promise<LiveBridgeStatus>;
  getFcmTokenAsync(): Promise<FcmTokenSnapshot>;
}

export default requireNativeModule<MagicTextModule>("MagicText");
