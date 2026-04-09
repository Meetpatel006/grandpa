import { NativeModule, requireNativeModule } from "expo";

import {
  InstallationSnapshot,
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
}

export default requireNativeModule<MagicTextModule>("MagicText");
